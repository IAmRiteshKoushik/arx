# Arx Supervisor

A location-based supervisor service that manages and routes traffic to edge nodes based on coordinate proximity.

## Features

- **Location-based Routing**: Routes requests to the nearest healthy edge nodes based on coordinates
- **Health Monitoring**: Continuously monitors node health and performance metrics
- **Real-time Updates**: WebSocket-based real-time communication for dashboard updates
- **Load Balancing**: Intelligent load balancing considering CPU, memory, and connection metrics
- **Admin Dashboard**: Complete admin interface for node management and monitoring
- **RESTful API**: Public and admin APIs for integration and management

## Architecture

- **PostgreSQL**: Primary database for nodes, routing requests, and metrics
- **Redis**: Caching and real-time data (optional)
- **Go**: High-performance backend service
- **Gin**: HTTP framework for REST APIs
- **WebSocket**: Real-time communication
- **sqlc**: Type-safe SQL code generation

## Quick Start

### Prerequisites

- Go 1.21+
- Podman & Podman Compose (or Docker & Docker Compose)
- PostgreSQL (or use the provided compose setup)

### Setup with Makefile (Recommended)

1. **Clone and setup**:
   ```bash
   cd supervisor
   make quick-start
   ```

2. **Start development server**:
   ```bash
   make dev
   ```

### Manual Setup

1. **Clone and setup**:
   ```bash
   cd supervisor
   ./scripts/setup.sh
   ```

2. **Start database**:
   ```bash
   make db-up
   # or: podman-compose up -d postgres redis
   ```

3. **Run migrations**:
   ```bash
   make db-migrate
   # or: goose postgres "user=postgres password=password dbname=arx_supervisor sslmode=disable host=localhost port=5432" up
   ```

4. **Start development server**:
   ```bash
   make dev
   # or: air
   ```
   
   Or build and run manually:
   ```bash
   make build && make run
   # or: go build -o bin/supervisor ./cmd/main.go && ./bin/supervisor
   ```

### Environment Variables

Copy `.env` file and adjust as needed:

```bash
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=arx_supervisor
DB_SSLMODE=disable
K_NEAREST=3
MAX_DISTANCE=50.0
LOAD_WEIGHT=0.6
DISTANCE_WEIGHT=0.4
HEALTH_CHECK_INTERVAL=30
HEALTH_TIMEOUT=5
HEALTH_FAILURE_THRESHOLD=3
```

## API Endpoints

### Public API

- `POST /api/v1/route` - Route a request to nearest node
- `GET /api/v1/nodes` - Get all healthy nodes
- `POST /api/v1/nodes/register` - Register a new node
- `GET /api/v1/health` - Service health check

### Admin API

- `GET /admin/api/v1/nodes` - Get all nodes
- `POST /admin/api/v1/nodes` - Create a node
- `PUT /admin/api/v1/nodes/:id` - Update a node
- `DELETE /admin/api/v1/nodes/:id` - Delete a node
- `GET /admin/api/v1/dashboard/metrics` - Get dashboard metrics
- `GET /admin/api/v1/requests/export` - Export routing requests

### WebSocket

- `GET /admin/api/v1/realtime` - Real-time updates for admin dashboard

## Usage Examples

### Route a Request

```bash
curl -X POST http://localhost:8080/api/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-123",
    "coordinates": {"x": 10.5, "y": 20.3}
  }'
```

### Register a Node

```bash
curl -X POST http://localhost:8080/api/v1/nodes/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "edge-node-1",
    "location": {"x": 10.0, "y": 20.0},
    "endpoint": "http://edge-node-1:8080"
  }'
```

## Development

### Project Structure

```
supervisor/
├── cmd/                    # Main application
├── internal/
│   ├── api/               # HTTP handlers
│   ├── config/            # Configuration
│   ├── database/          # Database layer
│   ├── health/            # Health monitoring
│   ├── models/            # Data models
│   ├── routing/           # Routing engine
│   └── websocket/         # WebSocket hub
├── db/
│   ├── migrations/        # Database migrations
│   └── queries/           # SQL queries
├── scripts/               # Setup scripts
└── docker-compose.yml     # Development environment
```

### Development with Makefile

The Makefile provides convenient commands for development:

```bash
# Quick start (sets up everything)
make quick-start

# Database management
make db-up          # Start database services
make db-down        # Stop database services  
make db-migrate     # Run migrations
make db-reset       # Reset database completely

# Build & run
make build          # Build binary
make run            # Build and run
make dev            # Development mode with hot reload

# Development tools
make sqlc           # Generate sqlc code
make fmt            # Format Go code
make lint           # Run linter
make test           # Run tests
make clean          # Clean artifacts

# Setup
make tools          # Install development tools
make deps           # Update dependencies
```

### Code Generation

- **sqlc**: Generate type-safe SQL code
  ```bash
  make sqlc
  # or: sqlc generate
  ```

- **goose**: Run database migrations
  ```bash
  make db-migrate
  # or: goose postgres "connection-string" up
  goose postgres "connection-string" down
  ```

### Hot Reloading

Development server with hot reloading:
```bash
make dev
# or: air
```

## Configuration

The service uses environment variables for configuration. See the `.env` file for all available options.

### Routing Configuration

- `K_NEAREST`: Number of nearest nodes to consider (default: 3)
- `MAX_DISTANCE`: Maximum distance for routing (default: 50.0)
- `LOAD_WEIGHT`: Weight for load balancing (default: 0.6)
- `DISTANCE_WEIGHT`: Weight for distance scoring (default: 0.4)

### Health Monitoring

- `HEALTH_CHECK_INTERVAL`: Health check interval in seconds (default: 30)
- `HEALTH_TIMEOUT`: Health check timeout in seconds (default: 5)
- `HEALTH_FAILURE_THRESHOLD`: Failure threshold before marking unhealthy (default: 3)

## License

This project is part of the Arx ecosystem.