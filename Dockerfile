# Stage 1: Build React
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Create React project inside container
RUN npx create-react-app . --template minimal

# Copy custom src files (override defaults)
COPY frontend/src/App.js src/
COPY frontend/src/index.js src/
COPY frontend/src/index.css src/

# Copy public/ for SEO and title
COPY frontend/public/ public/

# Install additional deps and build
RUN npm install recharts date-fns
RUN npm run build

# Stage 2: Python app
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Install system deps for Playwright on Debian slim/ARM64
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcairo-gobject2 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 libgcc1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    fonts-liberation fonts-noto-color-emoji xdg-utils \
    && rm -rf /var/lib/apt/lists/*
RUN playwright install chromium
COPY main.py .

# Copy React build to static
COPY --from=frontend-build /app/frontend/build/index.html ./static/
COPY --from=frontend-build /app/frontend/build/static ./static/
COPY frontend/src/favicon.ico ./static/
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
