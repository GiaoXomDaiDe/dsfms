FROM node:22-alpine3.19

WORKDIR /app

RUN apk add --no-cache libreoffice

RUN libreoffice --version

COPY package*.json ./
COPY prisma ./prisma/

RUN npm i --force

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 4000

CMD ["node", "dist/src/main.js"]


