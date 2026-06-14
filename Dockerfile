# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1

# Install dependencies separately from project source for better layer caching.
COPY uv.lock pyproject.toml /app/
RUN uv sync --frozen --no-install-project --no-dev

# Copy the rest of the source.
COPY . /app/
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Render injects $PORT (10000 by default). Fall back to 8080 locally.
EXPOSE 10000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
