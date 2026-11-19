FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/game.sqlite
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -r /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev && npm cache clean --force && mkdir /data && chown node:node /data
COPY --chown=node:node server.mjs arena.mjs commerce.mjs ./
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node","-e","fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","server.mjs"]
