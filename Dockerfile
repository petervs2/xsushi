# Stage 1: Build React
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

RUN npx create-react-app . --template minimal

COPY frontend/src/App.js src/
COPY frontend/src/index.js src/
COPY frontend/src/index.css src/

COPY frontend/public/ public/

RUN npm install recharts date-fns
RUN npm run build

# Stage 2: Python app
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .

COPY --from=frontend-build /app/frontend/build/index.html ./static/
COPY --from=frontend-build /app/frontend/build/static ./static/
COPY frontend/src/favicon.ico ./static/
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
