# build front-end
FROM node:lts-alpine AS builder

COPY ./ /app
WORKDIR /app

RUN apk add --no-cache git \
    && npm install pnpm -g \
    && pnpm install \
    && pnpm run build \
    && pnpm install jsonwebtoken \
    && pnpm install jwt-token \
    && pnpm install google-auth-library \
    && rm -rf /root/.npm /root/.pnpm-store /usr/local/share/.cache /tmp/*

# service
FROM node:lts-alpine

COPY /service /app
COPY --from=builder /app/dist /app/public

WORKDIR /app
RUN apk add --no-cache git \
    && npm install pnpm -g \
    && pnpm install --only=production \
    && pnpm install jsonwebtoken \
    && pnpm install jwt-token \
    && pnpm install google-auth-library \
    && rm -rf /root/.npm /root/.pnpm-store /usr/local/share/.cache /tmp/*

EXPOSE 3002

CMD ["pnpm", "run", "start"]
