---
name: containerizing-with-docker
description: Expert Docker containerization specialist for creating production-ready Docker images and multi-container applications. Use when users need to containerize applications (frontend, backend, databases), create Dockerfiles, set up docker-compose configurations, optimize images, or deploy containerized applications. Handles React, Vue, Node.js, Python, FastAPI, and various database systems (PostgreSQL, MySQL, MongoDB).
---

# Docker Containerization Expert

This skill provides comprehensive Docker containerization capabilities for creating production-ready container images and multi-container orchestration.

## Core Workflow

When containerizing an application, follow this sequence:

1. **Analyze the application structure** - Identify application type (frontend/backend/database), tech stack, and dependencies
2. **Select the appropriate template** - Use bundled scripts to generate optimized Dockerfiles and compose files
3. **Create supporting configurations** - Add .dockerignore, nginx.conf, environment files as needed
4. **Build and test** - Verify the container builds and runs correctly
5. **Optimize** - Analyze and optimize image size and security
6. **Document** - Provide clear instructions for deployment

## Quick Start Commands

### Generate a Dockerfile

```bash
# Frontend applications
python3 scripts/generate_dockerfile.py react -o frontend/Dockerfile
python3 scripts/generate_dockerfile.py nodejs-frontend -o frontend/Dockerfile

# Backend applications
python3 scripts/generate_dockerfile.py nodejs-backend -o backend/Dockerfile
python3 scripts/generate_dockerfile.py python-backend -o backend/Dockerfile
python3 scripts/generate_dockerfile.py fastapi -o backend/Dockerfile

# Databases
python3 scripts/generate_dockerfile.py postgres -o db/Dockerfile
python3 scripts/generate_dockerfile.py mysql -o db/Dockerfile
python3 scripts/generate_dockerfile.py mongodb -o db/Dockerfile
```

### Generate a docker-compose.yml

```bash
# Full-stack applications
python3 scripts/generate_compose.py fullstack-nodejs-postgres
python3 scripts/generate_compose.py fullstack-python-mysql
python3 scripts/generate_compose.py fullstack-nodejs-mongodb

# Microservices architecture
python3 scripts/generate_compose.py microservices
```

### Optimize images

```bash
# Analyze an image for optimization opportunities
python3 scripts/optimize_image.py analyze -i myimage:latest

# Create a comprehensive .dockerignore file
python3 scripts/optimize_image.py create-dockerignore
```

## Workflow by Application Type

### Frontend Applications (React, Vue, Angular)

1. Generate Dockerfile for the frontend:
   ```bash
   python3 scripts/generate_dockerfile.py react -o Dockerfile
   ```

2. Copy the nginx configuration:
   ```bash
   cp assets/nginx.conf ./nginx.conf
   ```

3. Create .dockerignore:
   ```bash
   python3 scripts/optimize_image.py create-dockerignore
   ```

4. Customize nginx.conf if API proxy is needed (uncomment the proxy section)

5. Build and run:
   ```bash
   docker build -t myapp-frontend .
   docker run -p 3000:80 myapp-frontend
   ```

### Backend Applications (Node.js, Python, FastAPI)

1. Generate appropriate Dockerfile:
   ```bash
   # For Node.js
   python3 scripts/generate_dockerfile.py nodejs-backend -o Dockerfile
   
   # For Python/FastAPI
   python3 scripts/generate_dockerfile.py fastapi -o Dockerfile
   ```

2. Create .env file from template:
   ```bash
   cp assets/.env.example .env
   # Edit .env with actual values
   ```

3. Create .dockerignore:
   ```bash
   python3 scripts/optimize_image.py create-dockerignore
   ```

4. Build and run:
   ```bash
   docker build -t myapp-backend .
   docker run -p 4000:4000 --env-file .env myapp-backend
   ```

### Full-Stack Applications

1. Ensure project structure follows this pattern:
   ```
   project/
   ├── frontend/
   ├── backend/
   └── docker-compose.yml
   ```

2. Generate docker-compose.yml:
   ```bash
   python3 scripts/generate_compose.py fullstack-nodejs-postgres
   ```

3. Generate Dockerfiles for each service:
   ```bash
   python3 scripts/generate_dockerfile.py react -o frontend/Dockerfile
   python3 scripts/generate_dockerfile.py nodejs-backend -o backend/Dockerfile
   ```

4. Add supporting files:
   ```bash
   cp assets/nginx.conf frontend/nginx.conf
   cp assets/.env.example .env
   ```

5. Start all services:
   ```bash
   docker-compose up -d
   ```

### Database Containers

1. Generate database Dockerfile if customization is needed:
   ```bash
   python3 scripts/generate_dockerfile.py postgres -o db/Dockerfile
   ```

2. Create initialization scripts directory:
   ```bash
   mkdir -p db/init-scripts
   ```

3. Add SQL initialization scripts in `db/init-scripts/`

4. The database is typically included in docker-compose.yml rather than run standalone

## Key Principles

### Multi-Stage Builds
Always use multi-stage builds to:
- Separate build environment from runtime
- Reduce final image size
- Improve security by excluding build tools

### Security Best Practices
- Run containers as non-root users
- Use specific version tags, never `:latest` in production
- Scan images for vulnerabilities
- Keep base images updated
- Never hardcode secrets

### Optimization
- Use Alpine-based images when possible
- Combine RUN commands to reduce layers
- Order Dockerfile instructions by change frequency
- Use .dockerignore to exclude unnecessary files
- Clean package manager caches

### Health Checks
Always include health checks to enable:
- Container orchestration monitoring
- Automatic restart on failure
- Graceful rolling updates

## Resource Files

### Best Practices Guide
For detailed Docker best practices, patterns, and examples by language:
```bash
view references/best-practices.md
```

Topics covered:
- Multi-stage builds patterns
- Layer optimization techniques
- Base image selection
- Security best practices
- Health check patterns
- Environment variable management
- Volume and network configuration
- Language-specific patterns (Node.js, Python, Go)
- Resource limits and logging

### Troubleshooting Guide
For debugging and resolving common Docker issues:
```bash
view references/troubleshooting.md
```

Topics covered:
- Build issues (caching, dependencies, disk space)
- Runtime issues (permissions, ports, connectivity)
- Network and volume problems
- Performance optimization
- Security vulnerabilities
- Docker Compose issues
- Debugging commands and tools

## Common Customizations

### Adding API Proxy to Frontend

Edit `nginx.conf` to uncomment and configure the API proxy section:
```nginx
location /api {
    proxy_pass http://backend:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Adding Environment Variables

Update the docker-compose.yml environment section or use an .env file:
```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
```

### Custom Database Initialization

Create SQL scripts in the appropriate directory:
- PostgreSQL: `db/init-scripts/*.sql`
- MySQL: `db/init-scripts/*.sql`
- MongoDB: `db/mongo-init.js`

### Adding SSL/TLS

For production deployments with HTTPS:
1. Obtain SSL certificates
2. Mount certificates in nginx container
3. Update nginx.conf to listen on 443
4. Add SSL configuration directives

## Validation Checklist

Before considering the containerization complete:

- [ ] All services build successfully
- [ ] Containers start without errors
- [ ] Health checks pass
- [ ] Services can communicate with each other
- [ ] Data persists across container restarts (if needed)
- [ ] .dockerignore excludes unnecessary files
- [ ] No secrets hardcoded in Dockerfiles or compose files
- [ ] Non-root users configured for security
- [ ] Resource limits set appropriately
- [ ] Logs are accessible via `docker logs`

## Deployment Preparation

For production deployment, ensure:
1. Use specific version tags (e.g., `myapp:v1.2.3`)
2. Set appropriate resource limits
3. Configure proper restart policies
4. Set up volume backups for databases
5. Configure logging drivers
6. Use secrets management (Docker secrets, environment files)
7. Set up monitoring and alerting

## Notes

- The generated Dockerfiles follow industry best practices
- Scripts produce production-ready configurations that should be reviewed and customized
- Always test locally before deploying to production
- Keep Docker and base images updated for security patches
- Monitor resource usage and optimize as needed
