# Quick Start Guide

## Prerequisites
- Go 1.21+
- Docker & Docker Compose
- PostgreSQL client tools (optional)

## One-Command Setup

```bash
# Clone and run setup script
git clone <repository>
cd arx/PLANS
chmod +x supervisor-implementation.md

# Extract and run the setup script (lines containing setup.sh)
# Or manually run the commands from supervisor-implementation.md
```

## Manual Setup Steps

### 1. Project Structure
```bash
mkdir -p supervisor/{cmd,internal/{database,routing,api,models,websocket,health,config},db/{migrations,queries},config,docs,scripts}
cd supervisor
go mod init arx-supervisor
```

### 2. Dependencies
```bash
# Core dependencies
go get -u github.com/gin-gonic/gin
go get -u github.com/lib/pq
go get -u github.com/jackc/pgx/v5/stdlib
go get -u github.com/sirupsen/logrus
go get -u github.com/gorilla/websocket
go get -u github.com/google/uuid
go get -u github.com/joho/godotenv

# Development tools
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/cosmtrek/air@latest
```

### 3. Database Setup
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Generate sqlc code (after creating migrations)
sqlc generate

# Run migrations
goose postgres "user=postgres password=password dbname=arx_supervisor sslmode=disable" up
```

### 4. Development
```bash
# Start with hot reloading
air

# Or build and run manually
go build -o bin/supervisor ./cmd/main.go
./bin/supervisor
```

## Key Features Already Implemented

✅ **sqlc Integration**: Type-safe SQL queries  
✅ **Goose Migrations**: Version-controlled database schema  
✅ **UUID Primary Keys**: Using UUID as unique identifier  
✅ **Non-unique Names**: Optional node name field for human reference  
✅ **Docker Compose**: Complete database setup included  
✅ **Real-time WebSocket**: Live dashboard updates  
✅ **Health Monitoring**: Automatic node health checks  
✅ **Admin API**: Complete CRUD operations  
✅ **JSON Request Data**: Full request/response lifecycle storage  
✅ **Node Auto-Discovery**: Intelligent node registration  
✅ **Enhanced Monitoring**: Comprehensive analytics and audit trails  

## API Endpoints

### Public API
- `POST /api/v1/route` - Route requests to nearest node
- `GET /api/v1/nodes` - List all nodes
- `POST /api/v1/nodes/register` - Register new node
- `GET /api/v1/health` - Supervisor health check

### Admin API  
- `GET /admin/api/v1/nodes` - List all nodes
- `POST /admin/api/v1/nodes` - Create new node
- `PUT /admin/api/v1/nodes/:id` - Update node (using UUID)
- `DELETE /admin/api/v1/nodes/:id` - Delete node (using UUID)
- `GET /admin/api/v1/dashboard/metrics` - Dashboard metrics
- `GET /admin/api/v1/requests/export` - Export routing data

### Node Management API
- `POST /admin/api/v1/nodes/register` - Register new node
- `POST /admin/api/v1/nodes/{id}/activate` - Activate node
- `POST /admin/api/v1/nodes/{id}/deactivate` - Deactivate node
- `GET /admin/api/v1/nodes/{id}/status` - Get node status

### WebSocket
- `GET /admin/api/v1/realtime` - Real-time updates

## Database Schema

The schema uses UUID as primary identifier with an optional non-unique name, plus enhanced request tracking:

```sql
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Unique identifier
    name VARCHAR(255) NOT NULL,                      -- Human-readable name (not unique)
    location_x FLOAT NOT NULL,
    location_y FLOAT NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    capacity INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'inactive',
    -- ... other fields
);

CREATE TABLE routing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(100) NOT NULL,
    coordinates_x FLOAT NOT NULL,
    coordinates_y FLOAT NOT NULL,
    selected_node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    distance FLOAT,
    load_score FLOAT,
    status VARCHAR(20) DEFAULT 'pending',
    response_time_ms INTEGER,
    request_data JSONB,                    -- Full request payload for monitoring
    response_data JSONB,                   -- Response data for monitoring
    metadata JSONB,                        -- Additional metadata (headers, timing, etc.)
    client_info JSONB,                      -- Client identification info
    processing_metrics JSONB,                -- Detailed processing metrics
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

All configuration via environment variables:

```bash
# Server
SERVER_PORT=8080
SERVER_HOST=0.0.0.0

# Database  
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=arx_supervisor
DB_SSLMODE=disable

# Routing
K_NEAREST=3
MAX_DISTANCE=50.0
LOAD_WEIGHT=0.6
DISTANCE_WEIGHT=0.4

# Health Checks
HEALTH_CHECK_INTERVAL=30
HEALTH_TIMEOUT=5
HEALTH_FAILURE_THRESHOLD=3
```

## Enhanced Monitoring with JSON Request Data

### Query Examples
```sql
-- Find high-priority requests
SELECT * FROM routing_requests 
WHERE request_data @> '{"priority": "high"}'::jsonb;

-- Average response time by client
SELECT 
  client_info->>'client_id' as client,
  AVG(response_time_ms) as avg_response_ms
FROM routing_requests 
WHERE client_info IS NOT NULL
GROUP BY client_info->>'client_id';

-- Find failed requests
SELECT request_id, created_at, response_data
FROM routing_requests 
WHERE status = 'failed';

-- Request heatmap by location
SELECT 
  coordinates_x, 
  coordinates_y, 
  COUNT(*) as request_count
FROM routing_requests 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY coordinates_x, coordinates_y;
```

### Adding New Nodes

#### Step 1: Register Node
```bash
# Register new node (starts inactive)
curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{
    "endpoint": "http://edge-node-01:8080",
    "name": "Processing Node 1",
    "location": {"x": 10.5, "y": 20.3},
    "capacity": 100,
    "auto_start": false
  }'

# Register and auto-activate
curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{
    "endpoint": "http://edge-node-02:8080",
    "name": "Processing Node 2", 
    "location": {"x": 15.0, "y": 25.0},
    "capacity": 100,
    "auto_start": true
  }'
```

#### Step 2: Manage Node Status
```bash
# Activate node (start receiving requests)
curl -X POST http://localhost:8080/admin/api/v1/nodes/{uuid}/activate

# Deactivate node (stop receiving new requests)
curl -X POST http://localhost:8080/admin/api/v1/nodes/{uuid}/deactivate

# Check current status
curl -X GET http://localhost:8080/admin/api/v1/nodes/{uuid}/status
```

#### Step 3: Docker Compose for Your Swarm
```yaml
# Your edge-nodes-compose.yml
version: '3.8'
services:
  edge-node-01:
    image: your-edge-app:latest
    ports:
      - "8081:8080"
    environment:
      - NODE_ID=edge-01
      - NODE_NAME=Processing Node 1
      - NODE_LOCATION_X=10.5
      - NODE_LOCATION_Y=20.3
      - NODE_CAPACITY=100

  edge-node-02:
    image: your-edge-app:latest
    ports:
      - "8082:8080"
    environment:
      - NODE_ID=edge-02
      - NODE_NAME=Processing Node 2
      - NODE_LOCATION_X=15.0
      - NODE_LOCATION_Y=25.0
      - NODE_CAPACITY=100

  edge-node-03:
    image: your-edge-app:latest
    ports:
      - "8083:8080"
    environment:
      - NODE_ID=edge-03
      - NODE_NAME=Processing Node 3
      - NODE_LOCATION_X=8.0
      - NODE_LOCATION_Y=12.0
      - NODE_CAPACITY=150
```

#### Step 4: Register All Your Nodes
```bash
# Register your swarm nodes
curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{"endpoint": "http://localhost:8081", "name": "Node 1", "location": {"x": 10.5, "y": 20.3}}'

curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{"endpoint": "http://localhost:8082", "name": "Node 2", "location": {"x": 15.0, "y": 25.0}}'

curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{"endpoint": "http://localhost:8083", "name": "Node 3", "location": {"x": 8.0, "y": 12.0}}'

# Activate them when ready
curl -X POST http://localhost:8080/admin/api/v1/nodes/{node-1-uuid}/activate
curl -X POST http://localhost:8080/admin/api/v1/nodes/{node-2-uuid}/activate
curl -X POST http://localhost:8080/admin/api/v1/nodes/{node-3-uuid}/activate
```

## Development Workflow

1. **Make changes** to SQL queries in `db/queries/`
2. **Regenerate code**: `sqlc generate`
3. **Create migrations** for schema changes: `goose create add_new_feature sql`
4. **Run migrations**: `goose up`
5. **Test**: `go test ./...`
6. **Deploy**: `docker build -t arx-supervisor .`

## Monitoring Benefits

With JSON request data storage, you can:
✅ **Track complete request lifecycle** from entry to response  
✅ **Analyze performance** by client, node, geography, time  
✅ **Debug issues** with full request/response data  
✅ **Generate compliance reports** with complete audit trails  
✅ **Build analytics dashboards** with rich data sources  
✅ **Implement ML models** for predictive routing and capacity planning

The supervisor is now ready for implementation with all your requested changes:
- ✅ No GORM - using sqlc for type-safe queries
- ✅ Goose for migrations  
- ✅ Docker Compose for database
- ✅ UUID primary keys as unique identifiers
- ✅ Non-unique name field for human reference