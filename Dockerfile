# Stage 1: build the SPA (Frontend/webapp/dist) — not committed to git
FROM node:20-slim AS webapp-build

WORKDIR /webapp
COPY Frontend/webapp/package.json Frontend/webapp/package-lock.json ./
RUN npm ci
COPY Frontend/webapp/ ./
RUN npm run build

# Stage 2: Python app, serves the built SPA at "/"
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY app/requirements.txt /app/app/requirements.txt
RUN pip install --no-cache-dir -r /app/app/requirements.txt

COPY . /app
COPY --from=webapp-build /webapp/dist /app/Frontend/webapp/dist

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
