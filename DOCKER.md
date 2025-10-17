# Docker Setup Guide

This guide explains how to run the dashboard using Docker.

## What is Docker?

Docker allows you to run the entire application (frontend + backend) in isolated containers with one command. No need to install Node.js, npm, or manage dependencies manually.

## Prerequisites

1. **Install Docker Desktop**
   - Windows/Mac: Download from https://www.docker.com/products/docker-desktop
   - Linux: Install Docker Engine and Docker Compose

2. **Verify Installation**
   ```bash
   docker --version
   docker-compose --version
   ```

## File Structure

```
Dashboard/
├── docker-compose.yml       # Orchestrates both services
├── .env                     # Database configuration
├── backend/
│   ├── Dockerfile          # Backend container setup
│   └── ...
└── frontend/
    ├── Dockerfile          # Frontend container setup
    ├── nginx.conf          # Web server config
    └── ...
```

## Configuration

### 1. Edit `.env` File

The `.env` file in the root directory contains your database credentials:

```env
DB_HOST=your_database_host
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
PORT=3001
```

**Important Notes:**
- For AWS RDS, use the full hostname (e.g., `database.xxxxx.us-east-1.rds.amazonaws.com`)
- Do NOT include `http://` in DB_HOST
- Make sure your database allows connections from Docker containers

## Running the Application

### Start Everything (One Command)

```bash
docker-compose up -d
```

**What this does:**
1. Builds both frontend and backend Docker images
2. Creates isolated containers for each service
3. Connects them in a private network
4. Starts the services in detached mode (runs in background)

### Access the Application

- **Frontend Dashboard:** http://localhost
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/api/health

### View Running Containers

```bash
docker ps
```

Expected output:
```
CONTAINER ID   IMAGE                    STATUS          PORTS
abc123...      dashboard-frontend       Up 2 minutes    0.0.0.0:80->80/tcp
def456...      dashboard-backend        Up 2 minutes    0.0.0.0:3001->3001/tcp
```

## Managing the Application

### Stop the Application

```bash
docker-compose down
```

This stops and removes the containers but keeps the images.

### View Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart backend only
docker-compose restart backend

# Restart frontend only
docker-compose restart frontend
```

### Rebuild After Code Changes

If you modify the code, rebuild the images:

```bash
docker-compose up -d --build
```

Or rebuild specific service:

```bash
docker-compose up -d --build backend
```

## Troubleshooting

### Port Already in Use

If port 80 or 3001 is already in use, edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "3002:3001"  # Changed from 3001:3001

  frontend:
    ports:
      - "8080:80"    # Changed from 80:80
```

Then access frontend at http://localhost:8080

### Database Connection Failed

1. Check `.env` file has correct credentials
2. Ensure database host is accessible from Docker
3. For AWS RDS, check security group allows inbound traffic
4. Remove `http://` from DB_HOST if present

View backend logs to see the error:
```bash
docker-compose logs backend
```

### Container Won't Start

Check logs for errors:
```bash
docker-compose logs
```

Remove and recreate everything:
```bash
docker-compose down
docker-compose up -d --build
```

### Frontend Shows Connection Error

The frontend is trying to connect to the backend. Check:

1. Backend is running: `docker ps`
2. Backend health check: http://localhost:3001/api/health
3. Backend logs: `docker-compose logs backend`

## Advanced Usage

### Run in Foreground (See Logs Live)

```bash
docker-compose up
```

Press Ctrl+C to stop.

### Remove Everything (Clean Slate)

```bash
# Stop and remove containers, networks
docker-compose down

# Also remove images
docker-compose down --rmi all

# Also remove volumes (careful!)
docker-compose down -v
```

### Access Container Shell

```bash
# Backend container
docker exec -it dashboard-backend sh

# Frontend container
docker exec -it dashboard-frontend sh
```

### Check Resource Usage

```bash
docker stats
```

## Production Deployment

For production, consider:

1. **Use environment-specific .env files**
   ```bash
   docker-compose --env-file .env.production up -d
   ```

2. **Enable SSL/HTTPS**
   - Add certificates to nginx configuration
   - Update `frontend/nginx.conf`

3. **Set resource limits** in `docker-compose.yml`:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
   ```

4. **Use Docker secrets** for sensitive data instead of .env

5. **Add health checks**:
   ```yaml
   services:
     backend:
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
         interval: 30s
         timeout: 10s
         retries: 3
   ```

## Benefits of Docker

✅ **No dependency conflicts** - Everything runs in isolation
✅ **Consistent environment** - Works the same on all machines
✅ **Easy deployment** - One command to start everything
✅ **Easy scaling** - Can run multiple instances
✅ **Easy updates** - Just rebuild and restart

## Next Steps

- Set up automatic deployment with GitHub Actions
- Add database container to docker-compose (if needed)
- Configure reverse proxy (nginx/traefik) for multiple apps
- Set up monitoring with Docker logging drivers
