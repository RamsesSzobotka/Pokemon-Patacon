FROM oven/bun:latest

WORKDIR /app

COPY package.json .

RUN bun install

COPY . .

EXPOSE 5173

CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
