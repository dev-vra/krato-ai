FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
  && apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && useradd -m -u 10001 krato && chown -R krato /app
USER krato
EXPOSE 7070
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/api/server.js"]
