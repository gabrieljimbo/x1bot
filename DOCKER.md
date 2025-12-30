# Docker Setup Guide

This project is containerized using Docker and Docker Compose. This guide explains how to build and run the application using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

1. **Build and start all services:**
```bash
docker-compose up --build
```

2. **Start services in detached mode:**
```bash
docker-compose up -d --build
```

3. **View logs:**
```bash
docker-compose logs -f
```

4. **Stop all services:**
```bash
docker-compose down
```

## Services

The Docker Compose setup includes the following services:

- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **backend**: NestJS backend API (port 3001)
- **frontend**: Next.js frontend application (port 3000)

## Environment Variables

The services use the following environment variables (configured in `docker-compose.yml`):

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port
- `PORT`: Backend server port (default: 3001)
- `FRONTEND_URL`: Frontend URL for CORS
- `CORS_ORIGIN`: Allowed CORS origin
- `WHATSAPP_SESSION_PATH`: Path for WhatsApp session storage
- `PUPPETEER_EXECUTABLE_PATH`: Path to Chromium executable

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3001)
- `PORT`: Frontend server port (default: 3000)

## Volumes

The following volumes are created to persist data:

- `postgres_data`: PostgreSQL database data
- `redis_data`: Redis data
- `whatsapp_sessions`: WhatsApp session authentication files
- `whatsapp_sessions_data`: WhatsApp session cache files

## Database Migrations

Database migrations are automatically run when the backend container starts using the `docker-entrypoint.sh` script.

## Building Individual Services

### Backend only:
```bash
docker-compose build backend
```

### Frontend only:
```bash
docker-compose build frontend
```

## Development Mode

For development, you can still run services locally:

```bash
# Start only database and Redis
docker-compose up postgres redis

# Run backend and frontend locally
pnpm dev:backend
pnpm dev:frontend
```

## Troubleshooting

### Database connection issues
If the backend fails to connect to the database, ensure:
1. The `postgres` service is healthy (check with `docker-compose ps`)
2. The `DATABASE_URL` environment variable is correct
3. Wait a few seconds for the database to be ready

### Port conflicts
If ports 3000, 3001, 5432, or 6379 are already in use, you can modify the port mappings in `docker-compose.yml`.

### Rebuild after dependency changes
If you add or change dependencies, rebuild the containers:
```bash
docker-compose build --no-cache
docker-compose up
```

### View service logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Production Considerations

For production deployments:

1. **Use environment-specific `.env` files** - Don't commit sensitive data
2. **Use Docker secrets** for sensitive information
3. **Configure proper CORS origins** - Update `CORS_ORIGIN` and `FRONTEND_URL`
4. **Use a reverse proxy** (nginx, Traefik) in front of the services
5. **Enable SSL/TLS** for all services
6. **Configure proper resource limits** in `docker-compose.yml`
7. **Use managed database services** instead of containerized PostgreSQL for production

