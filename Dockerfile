# Stage 1: Build React
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Создаём React-проект внутри контейнера
RUN npx create-react-app . --template minimal

# Копируем кастомные файлы src (перезапишут дефолтные)
COPY frontend/src/App.js src/
COPY frontend/src/index.js src/
COPY frontend/src/index.css src/

# Копируем public/ для SEO и title
COPY frontend/public/ public/

# Устанавливаем дополнительные deps, очищаем кэш и билдим
RUN npm install recharts date-fns
RUN npm run build

# Stage 2: Python app
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .

# Копируем build React правильно: index.html в корень static, static/ содержимое в static/
COPY --from=frontend-build /app/frontend/build/index.html ./static/
COPY --from=frontend-build /app/frontend/build/static ./static/
COPY frontend/src/favicon.ico ./static/
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]