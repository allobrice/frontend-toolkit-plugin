#!/usr/bin/env python3
"""
Generate optimized Dockerfiles for different application types.
"""

import argparse
import sys
from pathlib import Path

DOCKERFILES = {
    "nodejs-frontend": """# Multi-stage build for Node.js frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
""",

    "react": """# Multi-stage build for React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
""",

    "nodejs-backend": """# Multi-stage build for Node.js backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy application code
COPY . .

# Build if needed (e.g., TypeScript)
RUN npm run build || true

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
""",

    "python-backend": """# Multi-stage build for Python backend
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && \\
    apt-get install -y --no-install-recommends gcc && \\
    rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser

# Copy wheels from builder
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .

# Install dependencies
RUN pip install --no-cache /wheels/*

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD python -c "import requests; requests.get('http://localhost:8000/health')"

CMD ["python", "app.py"]
""",

    "fastapi": """# Multi-stage build for FastAPI application
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && \\
    apt-get install -y --no-install-recommends gcc && \\
    rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser

# Copy wheels from builder
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .

# Install dependencies
RUN pip install --no-cache /wheels/* && \\
    pip install --no-cache uvicorn[standard]

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=2)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
""",

    "postgres": """# PostgreSQL with custom configuration
FROM postgres:16-alpine

# Copy initialization scripts
COPY init-scripts/ /docker-entrypoint-initdb.d/

# Copy custom configuration
COPY postgresql.conf /etc/postgresql/postgresql.conf

# Set environment variables
ENV POSTGRES_DB=myapp
ENV POSTGRES_USER=appuser
ENV POSTGRES_PASSWORD=changeme

# Expose port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \\
  CMD pg_isready -U $POSTGRES_USER -d $POSTGRES_DB

# Use custom configuration
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
""",

    "mysql": """# MySQL with custom configuration
FROM mysql:8.0

# Copy initialization scripts
COPY init-scripts/ /docker-entrypoint-initdb.d/

# Copy custom configuration
COPY my.cnf /etc/mysql/conf.d/custom.cnf

# Set environment variables
ENV MYSQL_DATABASE=myapp
ENV MYSQL_USER=appuser
ENV MYSQL_PASSWORD=changeme
ENV MYSQL_ROOT_PASSWORD=rootchangeme

# Expose port
EXPOSE 3306

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \\
  CMD mysqladmin ping -h localhost -u $MYSQL_USER -p$MYSQL_PASSWORD

CMD ["mysqld"]
""",

    "mongodb": """# MongoDB with custom configuration
FROM mongo:7.0

# Copy initialization scripts
COPY mongo-init.js /docker-entrypoint-initdb.d/

# Set environment variables
ENV MONGO_INITDB_ROOT_USERNAME=admin
ENV MONGO_INITDB_ROOT_PASSWORD=changeme
ENV MONGO_INITDB_DATABASE=myapp

# Expose port
EXPOSE 27017

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=3 \\
  CMD mongosh --eval "db.adminCommand('ping')" --quiet

CMD ["mongod"]
""",
}


def generate_dockerfile(app_type: str, output_path: Path):
    """Generate a Dockerfile for the specified application type."""
    
    if app_type not in DOCKERFILES:
        print(f"Error: Unknown application type '{app_type}'")
        print(f"Available types: {', '.join(DOCKERFILES.keys())}")
        return False
    
    dockerfile_content = DOCKERFILES[app_type]
    
    # Write Dockerfile
    output_path.write_text(dockerfile_content)
    print(f"✅ Generated Dockerfile for {app_type} at {output_path}")
    
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate optimized Dockerfiles")
    parser.add_argument("type", choices=DOCKERFILES.keys(), 
                       help="Type of application")
    parser.add_argument("-o", "--output", default="Dockerfile",
                       help="Output file path (default: Dockerfile)")
    
    args = parser.parse_args()
    
    output_path = Path(args.output)
    
    if output_path.exists():
        response = input(f"{output_path} already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return
    
    success = generate_dockerfile(args.type, output_path)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
