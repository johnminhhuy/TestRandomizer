FROM python:3.13-slim

RUN apt-get update && \
    apt-get install -y g++ default-jdk && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "10000"]