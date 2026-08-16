/**
 * Who is allowed to create an account.
 *
 * The default is deliberately the restrictive one. This app gets deployed to a
 * public URL and hosts a public portfolio page, so "open unless told otherwise"
 * is the wrong default — a misconfigured instance should turn people away, not
 * let strangers in.
 *
 *   SIGNUP_MODE=invite  (default)  an INVITE_CODE must be presented
 *   SIGNUP_MODE=open               anyone with the URL can register
 *   SIGNUP_MODE=closed             only the seeded accounts exist
 *
 * Invite mode with no INVITE_CODE set falls back to closed rather than open,
 * so forgetting the variable can never silently expose the instance.
 */
export function signupPolicy(env = process.env) {
  const mode = (env.SIGNUP_MODE || 'invite').toLowerCase();
  const code = (env.INVITE_CODE || '').trim();

  if (mode === 'open') {
    return { mode: 'open', enabled: true, requiresInvite: false };
  }
  if (mode === 'invite') {
    return code
      ? { mode: 'invite', enabled: true, requiresInvite: true, code }
      : {
          mode: 'closed',
          enabled: false,
          requiresInvite: false,
          reason: 'SIGNUP_MODE=invite but INVITE_CODE is not set',
        };
  }
  return { mode: 'closed', enabled: false, requiresInvite: false };
}

/** Constant-time-ish comparison so the invite code can't be probed by timing. */
export function inviteCodeMatches(policy, supplied) {
  if (!policy.requiresInvite) return true;
  const expected = policy.code || '';
  const given = String(supplied || '');
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}
