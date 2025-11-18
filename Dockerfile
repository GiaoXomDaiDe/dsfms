FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		python3 \
		make \
		g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN set -eux; \
	echo "deb http://deb.debian.org/debian $(. /etc/os-release && echo $VERSION_CODENAME) contrib" >> /etc/apt/sources.list; \
	apt-get update; \
	echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections; \
	apt-get install -y --no-install-recommends \
		fontconfig \
		fonts-liberation \
		ttf-mscorefonts-installer \
		libreoffice; \
	fc-cache -f; \
	apt-get clean; \
	rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/src/main.js"]


