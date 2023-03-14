# build front-end
FROM node:lts-alpine AS builder

COPY ./ /app
WORKDIR /app

RUN apk add --no-cache git \
    && npm install pnpm -g \
    && pnpm install \
    && pnpm run build \
    && rm -rf /root/.npm /root/.pnpm-store /usr/local/share/.cache /tmp/* \
    && nmp install jsonwebtoken \
    && nmp install jwt-token

# service
FROM node:lts-alpine

COPY /service /app
COPY --from=builder /app/dist /app/public

WORKDIR /app
RUN apk add --no-cache git \
    && npm install pnpm -g \
    && pnpm install --only=production \
    && rm -rf /root/.npm /root/.pnpm-store /usr/local/share/.cache /tmp/* \
    && nmp install jsonwebtoken \
    && nmp install jwt-token


EXPOSE 3002

CMD ["pnpm", "run", "start"]
