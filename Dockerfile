# Portable deployment target — works on Fly.io, Railway, Cloud Run, or any host
# that takes a container. Render can use this too, but its native Node runtime
# (see render.yaml) is simpler there.
FROM node:22-slim

WORKDIR /app

# Install dependencies first so this layer is cached across code-only changes.
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

COPY . .
RUN npm run build

# The database lives on a mounted volume, never in the image — the image is
# replaced on every deploy and would take the data with it.
ENV NODE_ENV=production
ENV DATABASE_FILE=/data/roadmap.sqlite
VOLUME /data

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
