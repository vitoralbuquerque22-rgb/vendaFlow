FROM denoland/deno:2.5.6

WORKDIR /app/server

COPY server/ /app/server/
COPY base44/ /app/base44/

RUN deno task cache

ENV ENTITIES_DIR=/app/base44/entities \
    FUNCTIONS_DIR=/app/base44/functions \
    AGENTS_DIR=/app/base44/agents \
    GENERATED_DIR=/app/.generated \
    UPLOAD_DIR=/app/data/uploads

EXPOSE 8000
CMD ["deno", "run", "-A", "main.ts"]
