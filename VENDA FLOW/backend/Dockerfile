FROM denoland/deno:2.5.6

WORKDIR /app
COPY . /app

RUN deno task cache

ENV UPLOAD_DIR=/app/data/uploads

EXPOSE 8000
CMD ["deno", "run", "-A", "src/main.ts"]
