# Per assignment: only a Dockerfile (NOT a built image) is committed to source.
# Reference: https://www.digitalocean.com/community/tutorials/how-to-build-a-node-js-application-with-docker
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx,sys;sys.exit(0 if httpx.get('http://localhost:8001/healthz').status_code==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
