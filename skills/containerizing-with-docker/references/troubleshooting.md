# Docker Troubleshooting Guide

## Common Build Issues

### Build fails with "no space left on device"
```bash
# Clean up unused resources
docker system prune -a --volumes

# Check disk usage
docker system df
```

### Layer caching not working
```bash
# Force rebuild without cache
docker build --no-cache -t myimage .

# Or clear build cache
docker builder prune
```

### COPY fails with "no such file or directory"
- Check .dockerignore isn't excluding needed files
- Verify file paths are relative to build context
- Ensure files exist in the context directory

### Dependencies failing to install
```bash
# For Node.js - clear npm cache
RUN npm cache clean --force

# For Python - use --no-cache-dir
RUN pip install --no-cache-dir -r requirements.txt

# For Alpine - update package index
RUN apk update && apk add --no-cache package-name
```

## Runtime Issues

### Container exits immediately
```bash
# Check logs
docker logs <container-id>

# Run interactively to debug
docker run -it myimage sh

# Check the CMD/ENTRYPOINT
docker inspect myimage | grep -A 5 "Cmd"
```

### Permission denied errors
```bash
# Ensure correct file ownership
COPY --chown=appuser:appgroup . .

# Or fix permissions
RUN chown -R appuser:appgroup /app
```

### Port already in use
```bash
# Find process using port
lsof -i :8080

# Or use different host port
docker run -p 8081:8080 myimage
```

### Cannot connect to database
- Check network connectivity: `docker network ls`
- Verify service name resolution
- Ensure database is healthy: `docker ps`
- Check environment variables
- Review connection strings

## Network Issues

### Services cannot communicate
```bash
# List networks
docker network ls

# Inspect network
docker network inspect <network-name>

# Connect container to network
docker network connect <network-name> <container-name>
```

### DNS resolution fails
```yaml
# Add custom DNS
services:
  app:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

## Volume Issues

### Data not persisting
```bash
# Check volume mounts
docker inspect <container-id> | grep Mounts -A 10

# List volumes
docker volume ls

# Inspect volume
docker volume inspect <volume-name>
```

### Permission issues with volumes
```yaml
# Use user ID mapping
services:
  app:
    user: "1000:1000"
    volumes:
      - ./data:/app/data
```

## Performance Issues

### Slow build times
```bash
# Use BuildKit for parallel builds
DOCKER_BUILDKIT=1 docker build -t myimage .

# Optimize layer caching (see best-practices.md)
```

### Container using too much memory
```yaml
# Set memory limits
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
```

### Slow container startup
- Reduce image size (multi-stage builds)
- Optimize health check intervals
- Review startup scripts

## Docker Compose Issues

### Services not starting in order
```yaml
# Use depends_on with health checks
services:
  app:
    depends_on:
      db:
        condition: service_healthy
```

### Environment variables not loaded
```yaml
# Explicitly load env file
services:
  app:
    env_file:
      - .env
```

### Changes not reflected
```bash
# Rebuild images
docker-compose build --no-cache

# Recreate containers
docker-compose up --force-recreate
```

## Security Issues

### Image vulnerabilities
```bash
# Scan image
docker scan myimage:latest

# Use minimal base images (Alpine)
# Keep base images updated
```

### Running as root
```dockerfile
# Add non-root user
RUN adduser --disabled-password appuser
USER appuser
```

## Debugging Commands

```bash
# View container logs
docker logs -f <container-id>

# Execute command in running container
docker exec -it <container-id> sh

# Inspect container details
docker inspect <container-id>

# View resource usage
docker stats

# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# List all containers (including stopped)
docker ps -a

# Remove all stopped containers
docker container prune

# View image layers
docker history <image-name>
```

## Health Check Debugging

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' <container-id>

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' <container-id>
```

## Common Error Messages

### "exec user process caused: no such file or directory"
- Line endings issue (CRLF vs LF)
- Solution: Convert scripts to LF line endings

### "standard_init_linux.go: exec user process caused: exec format error"
- Wrong architecture or corrupted binary
- Rebuild for correct platform

### "OCI runtime create failed"
- Usually a configuration issue
- Check CMD/ENTRYPOINT syntax
- Verify file paths exist

## Best Practices for Debugging

1. Start with logs: `docker logs -f <container-id>`
2. Check if it works locally: `docker run -it myimage sh`
3. Verify configuration: `docker inspect <container-id>`
4. Test connectivity: `docker exec <id> ping <service>`
5. Review resource usage: `docker stats`
