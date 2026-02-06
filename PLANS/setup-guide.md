# Project Setup Guide

This document provides the complete setup instructions for implementing both the supervisor and admin dashboard projects.

## Prerequisites

- Go 1.21+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose

## Quick Start with Docker Compose

```bash
# Clone and setup
git clone <repository>
cd arx
mkdir -p supervisor admin-dashboard

# Copy plans to respective directories
cp PLANS/supervisor-implementation.md supervisor/README.md
cp PLANS/admin-dashboard-implementation.md admin-dashboard/README.md

# Build and run everything
docker-compose up -d
```

## Manual Setup Instructions

### 1. Supervisor Setup

```bash
cd supervisor
go mod init arx-supervisor

# Install dependencies
go get -u github.com/gin-gonic/gin
go get -u gorm.io/gorm
go get -u gorm.io/driver/postgres
go get -u github.com/sirupsen/logrus
go get -u github.com/gorilla/websocket
go get -u github.com/google/uuid

# Create directory structure
mkdir -p cmd internal/{database,routing,api,models,health,websocket} config docs
```

### 2. Admin Dashboard Setup

```bash
cd admin-dashboard
npm init -y

# Install dependencies
npm install react@18 react-dom@18
npm install -D @types/react @types/react-dom typescript vite @vitejs/plugin-react
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material @mui/x-charts
npm install react-router-dom zustand @types/ws ws axios
npm install chart.js react-chartjs-2 leaflet react-leaflet
npm install date-fns lodash
npm install -D @types/lodash

# Create directory structure
mkdir -p src/{components,pages,services,stores,utils,types}
mkdir -p src/components/{NodeMap,MetricsDashboard,RequestTable,NodeManager,Layout}
```

## Database Initialization

Create `init.sql` file:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database if not exists (handled by Docker environment)
```

## Environment Variables

### Supervisor (.env)
```bash
SERVER_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=arx_supervisor
K_NEAREST=3
HEALTH_CHECK_INTERVAL=30
LOG_LEVEL=info
```

### Admin Dashboard (.env)
```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=ws://localhost:8080/admin/api/v1/realtime
```

## Development Workflow

### Supervisor Development
```bash
cd supervisor

# Run with live reload
go run cmd/main.go

# Build for production
go build -o bin/supervisor ./cmd/main.go

# Run tests
go test ./...
```

### Admin Dashboard Development
```bash
cd admin-dashboard

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Build Docker image
npm run docker:build
```

## Production Deployment

### Using Docker Compose
```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment Variables
```bash
# Supervisor
SERVER_PORT=8080
DB_HOST=postgres
DB_PORT=5432
DB_USER=arx_user
DB_PASSWORD=secure_password
DB_NAME=arx_supervisor_prod
K_NEAREST=3
HEALTH_CHECK_INTERVAL=30
LOG_LEVEL=warn

# Admin Dashboard (NGINX)
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://api.yourdomain.com/admin/api/v1/realtime
```

## Monitoring & Logs

### Supervisor Logs
```bash
# View supervisor logs
docker-compose logs -f supervisor

# Access log files
docker exec -it supervisor tail -f /var/log/supervisor.log
```

### Database Access
```bash
# Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d arx_supervisor

# Redis CLI
docker exec -it redis redis-cli
```

## Performance Tuning

### Supervisor Optimization
- Use connection pooling for database
- Implement caching with Redis
- Configure health check intervals based on load
- Set appropriate timeout values for API calls

### Dashboard Optimization
- Implement virtual scrolling for large datasets
- Use React.memo for expensive components
- Optimize WebSocket message handling
- Implement chart data aggregation

## Scaling Considerations

### Horizontal Scaling
- Multiple supervisor instances behind load balancer
- Shared database with connection pooling
- Redis for session management and caching
- Auto-scaling based on metrics

### Database Scaling
- Read replicas for reporting queries
- Partitioning by region or time
- Regular maintenance and cleanup
- Backup and recovery procedures

## Security Notes

- No authentication implemented as requested
- Consider adding API keys for production
- Use HTTPS in production
- Implement rate limiting
- Set up network security groups

## Troubleshooting

### Common Issues
1. **WebSocket Connection Failed**: Check CORS settings and firewall rules
2. **Database Connection**: Verify credentials and network connectivity
3. **Node Health Checks**: Ensure endpoints are accessible from supervisor
4. **Map Not Loading**: Check Leaflet configuration and tile server

### Health Check Endpoints
- Supervisor: `GET /api/v1/health`
- Dashboard: `GET /` (should load main interface)

## Support & Documentation

For detailed implementation guides, refer to:
- `PLANS/supervisor-implementation.md`
- `PLANS/admin-dashboard-implementation.md`
- Individual README files in each project directory