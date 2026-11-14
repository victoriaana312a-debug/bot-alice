FROM node:22-bookworm-slim

# ffmpeg (áudio), python3 + yt-dlp (extração do YouTube)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]"

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "index.js"]
