FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml README.md ./
COPY ai_agent ./ai_agent
COPY examples ./examples

ENV AI_AGENT_DB=/data/memory.db
VOLUME ["/data"]
EXPOSE 8080

CMD ["python3", "-m", "ai_agent", "serve", "--host", "0.0.0.0", "--port", "8080"]
