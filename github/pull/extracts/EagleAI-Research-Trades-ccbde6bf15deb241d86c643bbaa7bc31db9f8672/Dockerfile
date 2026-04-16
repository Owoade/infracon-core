FROM  python:3.11.8-slim AS builder

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
  gcc \
  python3-dev \
  libpq-dev && \
  rm -rf /var/lib/apt/lists/* && \
  python -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .

RUN pip install --no-cache-dir gunicorn -r requirements.txt

FROM python:3.11.8-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq5 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

COPY . .

ENV PATH="/opt/venv/bin:$PATH" \
  PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

EXPOSE 4001

CMD ["gunicorn", "--bind", "0.0.0.0:4001", "main:app"]