FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=wsgi:app

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

FROM base AS development
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && flask --app wsgi:app run --host=0.0.0.0 --port=8000 --reload"]

FROM base AS production
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && gunicorn --bind 0.0.0.0:8000 --workers 2 wsgi:app"]
