import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { openDb } from '../src/db.js';
import { createApp } from '../src/index.js';
import { ensureSeedUsers } from '../src/seed.js';
import { signupPolicy, inviteCodeMatches } from '../src/signup-policy.js';

describe('signup policy resolution', () => {
  test('defaults to invite mode', () => {
    assert.equal(signupPolicy({ INVITE_CODE: 'abc' }).mode, 'invite');
  });

  test('invite mode without a code fails closed, not open', () => {
    const policy = signupPolicy({ SIGNUP_MODE: 'invite' });
    assert.equal(policy.mode, 'closed');
    assert.equal(policy.enabled, false);
    assert.match(policy.reason, /INVITE_CODE/);
  });

  test('empty environment fails closed', () => {
    const policy = signupPolicy({});
    assert.equal(policy.enabled, false);
  });

  test('open mode is opt-in only', () => {
    assert.equal(signupPolicy({ SIGNUP_MODE: 'open' }).enabled, true);
    assert.equal(signupPolicy({ SIGNUP_MODE: 'open' }).requiresInvite, false);
  });

  test('unrecognised mode is treated as closed', () => {
    assert.equal(signupPolicy({ SIGNUP_MODE: 'yes-please' }).enabled, false);
  });

  test('invite code comparison rejects wrong and near-miss codes', () => {
    const policy = signupPolicy({ INVITE_CODE: 'let-me-in' });
    assert.equal(inviteCodeMatches(policy, 'let-me-in'), true);
    assert.equal(inviteCodeMatches(policy, 'let-me-in '), false);
    assert.equal(inviteCodeMatches(policy, 'LET-ME-IN'), false);
    assert.equal(inviteCodeMatches(policy, ''), false);
    assert.equal(inviteCodeMatches(policy, undefined), false);
  });
});

describe('signup endpoint', () => {
  let baseUrl;
  let server;

  before(async () => {
    process.env.SIGNUP_MODE = 'invite';
    process.env.INVITE_CODE = 'roadmap-2026';
    const db = openDb(':memory:');
    ensureSeedUsers(db);
    server = createApp(db).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.close();
    delete process.env.SIGNUP_MODE;
    delete process.env.INVITE_CODE;
  });

  const post = async (path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  test('advertises signup availability without leaking the code', async () => {
    const res = await fetch(`${baseUrl}/api/auth/config`);
    const body = await res.json();
    assert.equal(body.signupEnabled, true);
    assert.equal(body.requiresInvite, true);
    assert.equal(body.code, undefined);
    assert.equal(JSON.stringify(body).includes('roadmap-2026'), false);
  });

  test('rejects a missing or wrong invite code', async () => {
    const missing = await post('/api/auth/signup', { email: 'a@b.com', password: 'password123' });
    assert.equal(missing.status, 403);

    const wrong = await post('/api/auth/signup', {
      email: 'a@b.com',
      password: 'password123',
      inviteCode: 'guessing',
    });
    assert.equal(wrong.status, 403);
  });

  test('creates an account with a valid invite code', async () => {
    const res = await post('/api/auth/signup', {
      email: 'jordan@example.com',
      password: 'password123',
      displayName: 'Jordan',
      inviteCode: 'roadmap-2026',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.displayName, 'Jordan');
    assert.equal(res.body.user.portfolioSlug, 'jordan');
    assert.equal(res.body.user.email, 'jordan@example.com');
  });

  test('enforces a minimum password length', async () => {
    const res = await post('/api/auth/signup', {
      email: 'short@example.com',
      password: 'abc',
      inviteCode: 'roadmap-2026',
    });
    assert.equal(res.status, 400);
  });

  test('rejects a duplicate email', async () => {
    const res = await post('/api/auth/signup', {
      email: 'jordan@example.com',
      password: 'password123',
      inviteCode: 'roadmap-2026',
    });
    assert.equal(res.status, 409);
  });

  test('gives distinct portfolio slugs to people with the same name', async () => {
    const res = await post('/api/auth/signup', {
      email: 'jordan2@example.com',
      password: 'password123',
      displayName: 'Jordan',
      inviteCode: 'roadmap-2026',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.portfolioSlug, 'jordan-2');
  });

  test('a new account starts with no progress and can sign in', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'jordan@example.com', password: 'password123' }),
    });
    assert.equal(res.status, 200);

    const cookie = res.headers.get('set-cookie').split(';')[0];
    const progress = await fetch(`${baseUrl}/api/progress`, { headers: { cookie } });
    const body = await progress.json();
    assert.equal(body.progress.length, 0);
    assert.equal(body.summary.totalCompleted, 0);
  });
});
