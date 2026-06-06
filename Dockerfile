FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    xvfb \
    xauth \
    libgl1-mesa-dev \
    libgles2-mesa-dev \
    libosmesa6-dev \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libxi-dev \
    libxinerama-dev \
    libxrandr-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts && npm rebuild canvas

COPY . .

RUN npm run postinstall 2>/dev/null || true

CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 -ac & export DISPLAY=:99 && npm start"]