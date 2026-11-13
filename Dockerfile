# 1단계: SPA 빌드. VITE_* 값은 이 단계에서 번들에 고정된다(.env는 .dockerignore로 제외).
FROM node:26-alpine AS build
WORKDIR /app
# Node 25부터 corepack이 기본 포함되지 않으므로 pnpm을 직접 고정 설치한다.
RUN npm install -g pnpm@11.7.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 2단계: Caddy가 정적 파일을 서빙하고 /api/*를 백엔드로 넘긴다. TLS는 앞단 리버스 프록시가 맡는다.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
