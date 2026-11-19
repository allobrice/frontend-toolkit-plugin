# Docker Best Practices Reference

## Multi-Stage Builds

Multi-stage builds reduce image size by separating build and runtime environments.

**Pattern:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

## Layer Optimization

**Combine RUN commands:**
```dockerfile
# ❌ Bad - creates multiple layers
RUN apt-get update
RUN apt-get install -y package1
RUN apt-get install -y package2

# ✅ Good - single layer
RUN apt-get update && \
    apt-get install -y package1 package2 && \
    rm -rf /var/lib/apt/lists/*
```

**Order layers by change frequency:**
```dockerfile
# Dependencies change less frequently
COPY package*.json ./
RUN npm ci

# Source code changes more frequently
COPY . .
RUN npm run build
```

## Base Image Selection

**Prefer Alpine for smaller images:**
```dockerfile
FROM node:20-alpine  # ~40MB
# vs
FROM node:20         # ~900MB
```

**Use specific versions:**
```dockerfile
FROM node:20.11.0-alpine3.19  # ✅ Reproducible
FROM node:latest              # ❌ Unpredictable
```

## Security Best Practices

**Run as non-root user:**
```dockerfile
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser
```

**Scan for vulnerabilities:**
```bash
docker scan myimage:latest
```

## Health Checks

**HTTP endpoint:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

**TCP socket:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD nc -z localhost 5432 || exit 1
```

**Custom script:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python /app/healthcheck.py || exit 1
```

## Environment Variables

**Use ARG for build-time, ENV for runtime:**
```dockerfile
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
```

**Never hardcode secrets:**
```dockerfile
# ❌ Bad
ENV DATABASE_PASSWORD=secret123

# ✅ Good - use docker secrets or .env file
ENV DATABASE_PASSWORD_FILE=/run/secrets/db_password
```

## Volume Management

**Use named volumes for data persistence:**
```yaml
volumes:
  postgres-data:
    driver: local
```

**Bind mounts for development:**
```yaml
volumes:
  - ./src:/app/src:ro  # Read-only source code
```

## Networking

**Use bridge networks for isolation:**
```yaml
networks:
  frontend:
  backend:
```

**Expose only necessary ports:**
```dockerfile
EXPOSE 8000  # Application port only
```

## Cache Optimization

**Leverage build cache:**
```dockerfile
# Copy dependency files first
COPY package*.json ./
RUN npm ci

# Copy source code last
COPY . .
```

**Use .dockerignore:**
```
node_modules/
.git/
*.md
tests/
```

## Common Patterns by Language

### Node.js
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
```

### Python
```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache /wheels/*
COPY . .
RUN adduser --disabled-password appuser
USER appuser
CMD ["python", "app.py"]
```

### Go
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
CMD ["./server"]
```

## Docker Compose Patterns

### Development setup
```yaml
version: '3.8'
services:
  app:
    build: .
    volumes:
      - .:/app
    environment:
      - NODE_ENV=development
    command: npm run dev
```

### Production setup
```yaml
version: '3.8'
services:
  app:
    image: myapp:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
```

### Health checks and dependencies
```yaml
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
  
  app:
    depends_on:
      db:
        condition: service_healthy
```

## Resource Limits

**Set memory and CPU limits:**
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Logging

**Configure logging drivers:**
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Image Tagging Strategy

```bash
# Development
myapp:dev-abc123

# Staging
myapp:staging-v1.2.3

# Production
myapp:v1.2.3
myapp:latest
```
