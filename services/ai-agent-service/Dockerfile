FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app ./app
EXPOSE 8004
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx,sys;sys.exit(0 if httpx.get('http://localhost:8004/healthz').status_code==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
