# AR Supervisor Server Implementation v2 (Merged Origin + Supervisor)

## Overview
A unified Go server combining authentication, AR decoration management, and 
edge server supervision. This single service acts as the central hub for the 
distributed AR system, managing users, content, and coordinating with edge 
servers for optimal performance.

## Technology Stack
- **Language**: Go 1.21+
- **Database**: PostgreSQL 15+
- **Libraries**: 
  - `sqlc` for type-safe SQL
  - `goose` for database migrations
  - `gin-gonic/gin` for HTTP API
  - `golang-jwt/jwt` for JWT authentication
  - `lib/pq` for PostgreSQL driver
  - `gorilla/websocket` for edge server communication
- **Authentication**: JWT-based with role-based access control

## Database Schema Design

### Users Table
```sql
-- migrations/001_create_users.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);
```

### AR Decorations Table
```sql
-- migrations/002_create_decorations.sql
CREATE TABLE ar_decorations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL, -- Latitude with high precision
    lng DECIMAL(11, 8) NOT NULL, -- Longitude with high precision
    radius_meters INTEGER NOT NULL, -- Detection radius in meters
    height_offset DECIMAL(5, 2) DEFAULT 0.0, -- Height from ground level
    
    -- Asset URLs from CDN
    low_res_url VARCHAR(500), -- URL for distant viewing (>50m)
    medium_res_url VARCHAR(500), -- URL for medium distance (20-50m)
    high_res_url VARCHAR(500), -- URL for close viewing (<20m)
    
    -- Rendering properties
    scale_x DECIMAL(5, 2) DEFAULT 1.0,
    scale_y DECIMAL(5, 2) DEFAULT 1.0,
    scale_z DECIMAL(5, 2) DEFAULT 1.0,
    rotation_x DECIMAL(5, 2) DEFAULT 0.0,
    rotation_y DECIMAL(5, 2) DEFAULT 0.0,
    rotation_z DECIMAL(5, 2) DEFAULT 0.0,
    
    -- Metadata
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('3d_model', 'image', 'animation')),
    file_size_bytes BIGINT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

### Edge Servers Table
```sql
-- migrations/003_create_edge_servers.sql
CREATE TABLE edge_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    api_url VARCHAR(500) NOT NULL,
    websocket_url VARCHAR(500) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    service_radius_km DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
    max_connections INTEGER DEFAULT 100,
    current_connections INTEGER DEFAULT 0,
    health_status VARCHAR(50) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'offline', 'unknown')),
    health_check_url VARCHAR(500),
    last_health_check TIMESTAMP WITH TIME ZONE,
    last_ping TIMESTAMP WITH TIME ZONE,
    cpu_usage DECIMAL(5, 2), -- percentage
    memory_usage DECIMAL(5, 2), -- percentage
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Device Connections Table
```sql
-- migrations/004_create_device_connections.sql
CREATE TABLE device_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    edge_server_id UUID REFERENCES edge_servers(id),
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    connection_status VARCHAR(50) DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
    app_version VARCHAR(50),
    device_info TEXT -- JSON with device specs
);
```

### Decoration Synchronization Table
```sql
-- migrations/005_create_decoration_sync.sql
CREATE TABLE decoration_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decoration_id UUID NOT NULL REFERENCES ar_decorations(id) ON DELETE CASCADE,
    edge_server_id UUID NOT NULL REFERENCES edge_servers(id) ON DELETE CASCADE,
    sync_status VARCHAR(50) NOT NULL CHECK (sync_status IN ('pending', 'synced', 'failed', 'outdated')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_version INTEGER DEFAULT 1, -- Increment on updates
    error_message TEXT,
    UNIQUE(decoration_id, edge_server_id)
);
```

### System Metrics Table
```sql
-- migrations/006_create_system_metrics.sql
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_server_id UUID REFERENCES edge_servers(id),
    metric_type VARCHAR(100) NOT NULL, -- 'cpu', 'memory', 'connections', 'bandwidth'
    metric_value DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sessions Table (JWT Tracking)
```sql
-- migrations/007_create_sessions.sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    device_info TEXT,
    ip_address INET
);
```

## Project Structure
```
ar-supervisor-server/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── auth/
│   │   ├── jwt.go
│   │   ├── middleware.go
│   │   └── service.go
│   ├── config/
│   │   └── config.go
│   ├── database/
│   │   ├── connection.go
│   │   └── migrations.go
│   ├── handlers/
│   │   ├── auth.go
│   │   ├── decorations.go
│   │   ├── edge_servers.go
│   │   ├── devices.go
│   │   ├── metrics.go
│   │   └── health.go
│   ├── models/
│   │   └── db.go (sqlc generated)
│   ├── queries/
│   │   └── db.sql (sqlc queries)
│   ├── services/
│   │   ├── auth_service.go
│   │   ├── decoration_service.go
│   │   ├── edge_service.go
│   │   ├── device_service.go
│   │   ├── sync_service.go
│   │   └── metrics_service.go
│   ├── websocket/
│   │   ├── edge_client.go
│   │   └── hub.go
│   └── utils/
│       ├── response.go
│       ├── validation.go
│       ├── geospatial.go
│       └── load_balancer.go
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_decorations.sql
│   ├── 003_create_edge_servers.sql
│   ├── 004_create_device_connections.sql
│   ├── 005_create_decoration_sync.sql
│   ├── 006_create_system_metrics.sql
│   └── 007_create_sessions.sql
├── queries/
│   └── query.sql (sqlc query definitions)
├── scripts/
│   ├── migrate.sh
│   ├── generate.sh
│   └── seed.go
├── go.mod
├── go.sum
└── README.md
```

## API Endpoints Design

### Authentication Endpoints
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/profile
PUT  /api/v1/auth/profile
```

### AR Decoration Management (Admin only)
```
POST   /api/v1/decorations
GET    /api/v1/decorations
GET    /api/v1/decorations/{id}
PUT    /api/v1/decorations/{id}
DELETE /api/v1/decorations/{id}
POST   /api/v1/decorations/{id}/sync
```

### Public Decoration Discovery
```
GET /api/v1/decorations/nearby?lat={lat}&lng={lng}&radius={radius}
GET /api/v1/decorations/bounds?min_lat={min_lat}&max_lat={max_lat}&min_lng={min_lng}&max_lng={max_lng}
GET /api/v1/decorations/region?region={region}
```

### Edge Server Management
```
GET    /api/v1/edge-servers
POST   /api/v1/edge-servers
PUT    /api/v1/edge-servers/{id}
DELETE /api/v1/edge-servers/{id}
POST   /api/v1/edge-servers/{id}/health-check
GET    /api/v1/edge-servers/{id}/status
POST   /api/v1/edge-servers/{id}/ping
```

### Device Management
```
GET    /api/v1/devices
GET    /api/v1/devices/{device_id}
PUT    /api/v1/devices/{device_id}/location
DELETE /api/v1/devices/{device_id}
GET    /api/v1/devices/edge/{edge_id}
```

### Synchronization & Coordination
```
POST /api/v1/sync/decorations/all
POST /api/v1/sync/decorations/edge/{edge_id}
GET  /api/v1/sync/status/{edge_server_id}
POST /api/v1/sync/trigger/{edge_server_id}
```

### Metrics & Monitoring
```
GET /api/v1/metrics/edge/{edge_id}
GET /api/v1/metrics/system
GET /api/v1/metrics/devices/active
GET /api/v1/metrics/load-distribution
```

### WebSocket Endpoints
```
WS /ws/edge/{edge_id}  -- Edge server connections
WS /ws/admin          -- Admin dashboard updates
```

## Key Dependencies
```go
// go.mod
module ar-supervisor-server

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/golang-jwt/jwt/v5 v5.0.0
    github.com/lib/pq v1.10.9
    github.com/pressly/goose/v3 v3.17.0
    github.com/google/uuid v1.3.0
    github.com/gorilla/websocket v1.5.1
    golang.org/x/crypto v0.12.0
    github.com/jackc/pgx/v5 v5.4.3
    sqlc.dev/plugin v0.0.0-20230725165155-5e8d9f9b4e21
    github.com/prometheus/client_golang v1.17.0
)
```

## Core Services Architecture

### 1. Authentication Service
- JWT token management
- Role-based authorization
- Session tracking
- Password security

### 2. Decoration Service
- CRUD operations
- CDN URL validation
- Geospatial indexing
- Asset metadata management

### 3. Edge Service
- Edge server registration
- Health monitoring (ping/pong)
- Load balancing algorithm
- Connection management

### 4. Device Service
- Device registration/tracking
- Location updates
- Connection distribution
- Usage analytics

### 5. Sync Service
- Decoration distribution to edges
- Version control for updates
- Conflict resolution
- Batch synchronization

### 6. Metrics Service
- Performance monitoring
- Resource usage tracking
- Analytics collection
- Historical data

## Load Balancing Algorithm

```go
// Load Balancing Strategy
func SelectBestEdge(userLat, userLng float64) EdgeServer {
    candidates := GetActiveEdgeServersInRadius(userLat, userLng, 50km)
    
    for _, edge := range candidates {
        score := CalculateScore(edge, userLat, userLng)
        // Score = (distance_weight * distance_score) + 
        //         (load_weight * load_score) + 
        //         (health_weight * health_score)
    }
    
    return edgeWithHighestScore
}
```

## WebSocket Communication

### Edge Server Protocol
```json
// Edge → Supervisor
{
    "type": "health_update",
    "data": {
        "cpu_usage": 45.2,
        "memory_usage": 67.8,
        "active_connections": 23,
        "timestamp": "2024-01-01T12:00:00Z"
    }
}

// Supervisor → Edge
{
    "type": "sync_decorations",
    "data": {
        "decorations": [...],
        "version": 123
    }
}
```

## SQLC Query Examples

```sql
-- queries/query.sql
-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 AND is_active = true;

-- name: CreateDecoration :one
INSERT INTO ar_decorations (
    name, description, category, lat, lng, radius_meters,
    low_res_url, medium_res_url, high_res_url,
    asset_type, created_by
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetNearbyDecorations :many
SELECT * FROM ar_decorations 
WHERE is_active = true
  AND (6371 * acos(cos(radians($1)) * cos(radians(lat)) * 
      cos(radians(lng) - radians($2)) + sin(radians($1)) * 
      sin(radians(lat)))) <= $3
ORDER BY created_at DESC;

-- name: GetBestEdgeServers :many
SELECT *, 
       (6371 * acos(cos(radians($1)) * cos(radians(lat)) * 
        cos(radians(lng) - radians($2)) + sin(radians($1)) * 
        sin(radians(lat)))) as distance_km
FROM edge_servers 
WHERE is_active = true
  AND health_status = 'healthy'
  AND current_connections < max_connections
  AND (6371 * acos(cos(radians($1)) * cos(radians(lat)) * 
      cos(radians(lng) - radians($2)) + sin(radians($1)) * 
      sin(radians(lat)))) <= service_radius_km
ORDER BY (current_connections::float / max_connections::float) ASC, distance_km ASC
LIMIT 3;

-- name: UpdateDeviceConnection :one
UPDATE device_connections 
SET edge_server_id = $2, last_ping = NOW()
WHERE device_id = $1
RETURNING *;
```

## Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=ar_supervisor
DB_PASSWORD=ar_password
DB_NAME=ar_supervisor

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=168h

# Server
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
WS_READ_BUFFER=1024
WS_WRITE_BUFFER=1024

# Edge Coordination
EDGE_HEALTH_CHECK_INTERVAL=30s
EDGE_SYNC_INTERVAL=5m
DEVICE_PING_TIMEOUT=60s

# CDN
CDN_BASE_URL=https://your-cdn.com/ar-assets

# Monitoring
METRICS_PORT=9090
LOG_LEVEL=info
```

## Implementation Steps

### Phase 1: Foundation (Week 1)
1. Initialize Go project with dependencies
2. Set up PostgreSQL connection and migrations
3. Generate SQLC models and queries
4. Basic configuration management
5. Project structure setup

### Phase 2: Authentication System (Week 1-2)
1. User registration/login endpoints
2. JWT token generation/validation
3. Role-based middleware
4. Session management
5. Password hashing with bcrypt

### Phase 3: AR Decoration Management (Week 2)
1. CRUD operations for decorations
2. Asset URL validation
3. Geospatial queries for nearby decorations
4. Input validation and error handling
5. Admin role verification

### Phase 4: Edge Server Integration (Week 3)
1. Edge server registration
2. WebSocket hub for real-time communication
3. Health check system
4. Load balancing algorithm
5. Device connection management

### Phase 5: Device Tracking & Synchronization (Week 3-4)
1. Device registration and location tracking
2. Automatic edge server assignment
3. Decoration synchronization service
4. Conflict resolution for updates
5. Metrics collection

### Phase 6: Monitoring & Polish (Week 4)
1. System metrics collection
2. Admin dashboard WebSocket updates
3. Load balancing optimizations
4. Error handling and logging
5. Performance optimizations

## Deployment Architecture

```
Load Balancer
    ↓
Supervisor Server (Go) - :8080
    ↓ ↓ ↓
Edge Server 1   Edge Server 2   Edge Server 3
(San Francisco)   (New York)    (London)
    ↓ ↓ ↓
Mobile Users      Mobile Users   Mobile Users
```

## Security Considerations
- Password hashing with bcrypt
- JWT with short expiration + refresh tokens
- Input validation and sanitization
- Rate limiting on all endpoints
- CORS for mobile app access
- SQL injection prevention with sqlc
- HTTPS enforcement in production
- WebSocket authentication
- Edge-to-supervisor communication encryption

## Monitoring & Observability
- Prometheus metrics for system health
- Structured logging with correlation IDs
- WebSocket connection monitoring
- Database query performance tracking
- Edge server health dashboard
- Real-time device connection metrics

## Next Steps
1. Set up development environment
2. Create initial migration files
3. Implement basic authentication flow
4. Test decoration CRUD operations
5. Set up WebSocket communication
6. Deploy to staging environment with test edge servers

This unified supervisor server combines all the critical functions of your AR system into a single, manageable service while maintaining scalability and performance through edge server distribution.
