FROM node:22-alpine3.19 AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine3.19 AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache libreoffice

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/src/main.js"]


