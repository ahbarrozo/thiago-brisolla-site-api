FROM oven/bun:latest AS build

WORKDIR /app
COPY package.json bun.lock .env ./
RUN bun install
COPY . .
RUN bun build src/index.ts --outdir dist --target bun

# Production stage
FROM oven/bun:slim
WORKDIR /app

# Copy only the built files and production dependencies
COPY --from=build /app/dist /app/dist
COPY --from=build /app/.env /app

# Set production environment
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["bun", "run", "dist/index.js"]
