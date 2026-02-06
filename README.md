# ARX: Experiment Grounds for AR

ARX is a comprehensive platform for building and testing location-based 
augmented reality applications with edge computing capabilities. This project 
provides a complete ecosystem for indoor positioning, video processing, and 
distributed AR experiences.

## Architecture Overview

ARX consists of several interconnected components:

- **Supervisor Service**: Location-based routing and load balancing for edge nodes
- **Admin Dashboard**: Real-time monitoring and management interface
- **Edge Processing Nodes**: Distributed video processing with adaptive routing
- **Mobile AR Applications**: React Native apps with on-device AI processing

## Key Features

🗺️ **Location-Based Routing**: Intelligent routing to nearest edge nodes using coordinate proximity  
📊 **Real-Time Monitoring**: Live dashboard with WebSocket updates  
⚡ **Adaptive Processing**: Dynamic load balancing between on-device and edge processing  
🤖 **AI Integration**: Gemma 3n for on-device semantic feature extraction  
🔧 **Modern Stack**: Go backend with PostgreSQL, React frontend with TypeScript  

## Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### One-Command Setup
```bash
# Clone and setup
git clone <repository>
cd arx

# Start all services
docker-compose up -d

# Access services
# Supervisor API: http://localhost:8080
# Admin Dashboard: http://localhost:3000
```

### Manual Setup

#### Supervisor Service
```bash
cd supervisor
go mod init arx-supervisor
go get -u github.com/gin-gonic/gin github.com/lib/pq github.com/jackc/pgx/v5/stdlib
sqlc generate
goose postgres "user=postgres password=password dbname=arx_supervisor sslmode=disable" up
go run cmd/main.go
```

#### Admin Dashboard
```bash
cd admin-ui
npm install
npm run dev
```

## Components

### 1. Supervisor Service
- **Location Registry**: Real-time node coordination and health monitoring
- **Routing Engine**: K-nearest algorithm with load balancing
- **WebSocket Hub**: Real-time updates and event streaming
- **API Gateway**: RESTful endpoints for routing and node management

**API Endpoints:**
- `POST /api/v1/route` - Route requests based on coordinates
- `GET /api/v1/nodes` - List all registered nodes
- `GET /admin/api/v1/dashboard/metrics` - System metrics

### 2. Admin Dashboard
- **Node Management**: Add, edit, and monitor edge nodes
- **Real-Time Metrics**: Live performance charts and system health
- **Request Tracking**: Monitor routing decisions and performance
- **Interactive Map**: Visual node placement and coverage areas

**Features:**
- Real-time WebSocket updates
- Interactive node map with Leaflet
- Performance metrics with Chart.js
- Responsive Material-UI design

### 3. Edge Processing Nodes
- **Video Processing**: OpenCV-based frame analysis
- **Semantic Feature Extraction**: Gemma 3n on-device processing
- **Adaptive Load Management**: Dynamic processing strategies
- **Health Reporting**: Real-time status and metrics

### 4. Mobile AR Applications
- **React Native**: Cross-platform mobile apps
- **On-Device AI**: MediaPipe integration with Gemma 3n
- **Sensor Fusion**: GPS, compass, and accelerometer data
- **Edge Communication**: WebSocket connectivity to processing nodes

## Database Schema

The system uses PostgreSQL with UUID-based identifiers:

```sql
-- Nodes registry
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location_x FLOAT NOT NULL,
    location_y FLOAT NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    capacity INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'inactive',
    -- Additional fields...
);

-- Routing requests tracking
CREATE TABLE routing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(100) NOT NULL,
    coordinates_x FLOAT NOT NULL,
    coordinates_y FLOAT NOT NULL,
    selected_node_id UUID REFERENCES nodes(id),
    -- Performance and audit fields...
);
```

## Configuration

### Environment Variables
```bash
# Supervisor
SERVER_PORT=8080
DB_HOST=localhost
DB_PASSWORD=password
K_NEAREST=3

# Admin Dashboard
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=ws://localhost:8080/admin/api/v1/realtime
```

### Docker Compose Services
- **PostgreSQL**: Primary database with UUID extension
- **Redis**: Caching and session management
- **Supervisor**: Main routing service
- **Admin UI**: Web-based management interface

## Development Workflow

1. **Make changes** to SQL queries → `sqlc generate`
2. **Create migrations** → `goose create add_feature sql`
3. **Run migrations** → `goose up`
4. **Test** → `go test ./...` or `npm test`
5. **Build** → `go build` or `npm run build`

## Routing Algorithm

The supervisor uses a K-nearest neighbor algorithm with load balancing:

1. Calculate Euclidean distance to all healthy nodes
2. Select K=3 nearest nodes
3. Choose node with lowest load score (CPU + memory + connections)
4. Route request and log decision metrics

**Distance Calculation**: `√((x1-x2)² + (y1-y2)²)`  
**Load Score**: Weighted combination of system resources

## Monitoring & Observability

### Real-Time Metrics
- Node health status and CPU/memory usage
- Request routing patterns and response times
- System load distribution
- WebSocket connection status

### Logging
Structured JSON logging with:
- Request tracing IDs
- Performance metrics
- Error context
- System health checks

## Security Notes

- API authentication (optional for development)
- CORS enabled for admin dashboard
- Input validation on all endpoints
- HTTPS recommended for production

## Performance Targets

- **Routing Latency**: < 10ms per request
- **Concurrent Requests**: 100+ simultaneous
- **Node Health Check**: < 100ms response
- **WebSocket Updates**: < 50ms message delivery
- **Database Connections**: 25 max pooled connections

## Scaling Considerations

### Current Scale (10-50 nodes)
- In-memory node registry
- Single supervisor instance
- PostgreSQL with connection pooling

### Future Scaling (100+ nodes)
- Distributed registry with Redis
- Multiple supervisor instances
- Geographic zone-based routing
- Database read replicas

## License

This project is experimental and intended for research and development purposes.

## Getting Help

- Check individual README files in component directories
- Review implementation plans in `PLANS/` directory
- Examine API documentation at `/api/v1/health` endpoint
- Monitor Docker logs with `docker-compose logs -f`
