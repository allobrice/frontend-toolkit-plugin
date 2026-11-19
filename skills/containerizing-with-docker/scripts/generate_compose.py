#!/usr/bin/env python3
"""
Generate optimized docker-compose.yml for multi-container applications.
"""

import argparse
import sys
from pathlib import Path

COMPOSE_TEMPLATES = {
    "fullstack-nodejs-postgres": """version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:4000
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://appuser:changeme@db:5432/myapp
      - JWT_SECRET=your-secret-key-change-in-production
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=appuser
      - POSTGRES_PASSWORD=changeme
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./db/init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres-data:

networks:
  app-network:
    driver: bridge
""",

    "fullstack-python-mysql": """version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=mysql://appuser:changeme@db:3306/myapp
      - SECRET_KEY=your-secret-key-change-in-production
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_DATABASE=myapp
      - MYSQL_USER=appuser
      - MYSQL_PASSWORD=changeme
      - MYSQL_ROOT_PASSWORD=rootchangeme
    volumes:
      - mysql-data:/var/lib/mysql
      - ./db/init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "3306:3306"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "appuser", "-pchangeme"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysql-data:

networks:
  app-network:
    driver: bridge
""",

    "fullstack-nodejs-mongodb": """version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:4000
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://appuser:changeme@db:27017/myapp
      - JWT_SECRET=your-secret-key-change-in-production
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  db:
    image: mongo:7.0
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=changeme
      - MONGO_INITDB_DATABASE=myapp
    volumes:
      - mongodb-data:/data/db
      - ./db/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js
    ports:
      - "27017:27017"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')", "--quiet"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mongodb-data:

networks:
  app-network:
    driver: bridge
""",

    "microservices": """version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api-gateway
      - frontend
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    expose:
      - "80"
    environment:
      - REACT_APP_API_URL=http://nginx/api
    networks:
      - app-network
    restart: unless-stopped

  api-gateway:
    build:
      context: ./api-gateway
      dockerfile: Dockerfile
    expose:
      - "3000"
    environment:
      - AUTH_SERVICE_URL=http://auth-service:3001
      - USER_SERVICE_URL=http://user-service:3002
      - PRODUCT_SERVICE_URL=http://product-service:3003
    depends_on:
      - auth-service
      - user-service
      - product-service
    networks:
      - app-network
    restart: unless-stopped

  auth-service:
    build:
      context: ./services/auth
      dockerfile: Dockerfile
    expose:
      - "3001"
    environment:
      - DATABASE_URL=postgresql://auth_user:changeme@auth-db:5432/auth_db
      - JWT_SECRET=your-jwt-secret-change-in-production
    depends_on:
      auth-db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  user-service:
    build:
      context: ./services/user
      dockerfile: Dockerfile
    expose:
      - "3002"
    environment:
      - DATABASE_URL=postgresql://user_user:changeme@user-db:5432/user_db
    depends_on:
      user-db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  product-service:
    build:
      context: ./services/product
      dockerfile: Dockerfile
    expose:
      - "3003"
    environment:
      - DATABASE_URL=postgresql://product_user:changeme@product-db:5432/product_db
    depends_on:
      product-db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  auth-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=auth_db
      - POSTGRES_USER=auth_user
      - POSTGRES_PASSWORD=changeme
    volumes:
      - auth-db-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U auth_user -d auth_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  user-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=user_db
      - POSTGRES_USER=user_user
      - POSTGRES_PASSWORD=changeme
    volumes:
      - user-db-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user_user -d user_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  product-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=product_db
      - POSTGRES_USER=product_user
      - POSTGRES_PASSWORD=changeme
    volumes:
      - product-db-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U product_user -d product_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  auth-db-data:
  user-db-data:
  product-db-data:
  redis-data:

networks:
  app-network:
    driver: bridge
""",
}


def generate_compose(stack_type: str, output_path: Path):
    """Generate a docker-compose.yml for the specified stack type."""
    
    if stack_type not in COMPOSE_TEMPLATES:
        print(f"Error: Unknown stack type '{stack_type}'")
        print(f"Available types: {', '.join(COMPOSE_TEMPLATES.keys())}")
        return False
    
    compose_content = COMPOSE_TEMPLATES[stack_type]
    
    # Write docker-compose.yml
    output_path.write_text(compose_content)
    print(f"✅ Generated docker-compose.yml for {stack_type} at {output_path}")
    
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate docker-compose configurations")
    parser.add_argument("type", choices=COMPOSE_TEMPLATES.keys(), 
                       help="Type of application stack")
    parser.add_argument("-o", "--output", default="docker-compose.yml",
                       help="Output file path (default: docker-compose.yml)")
    
    args = parser.parse_args()
    
    output_path = Path(args.output)
    
    if output_path.exists():
        response = input(f"{output_path} already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return
    
    success = generate_compose(args.type, output_path)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
