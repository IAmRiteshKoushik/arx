# Supervisor Implementation Plan

## Overview
This plan outlines the complete implementation of the location-based supervisor 
service that manages and routes traffic to edge nodes based on coordinate 
proximity.

## Phase 1: Project Setup & Database Integration

### 1.1 Initialize Go Project
```bash
mkdir -p supervisor/{cmd,internal/{database,routing,api,models,websocket,health,config},db/{migrations,queries},config,docs}
cd supervisor
go mod init arx-supervisor

# Additional development dependencies
go get -u github.com/cosmtrek/air
go get -u github.com/joho/godotenv
```

### 1.2 Database Setup (PostgreSQL with sqlc + Goose)
**Dependencies:**
```bash
# Core dependencies
go get -u github.com/gin-gonic/gin
go get -u github.com/lib/pq
go get -u github.com/jackc/pgx/v5/stdlib
go get -u github.com/sirupsen/logrus
go get -u github.com/gorilla/websocket
go get -u github.com/google/uuid
go get -u github.com/joho/godotenv

# Development tools (install globally)
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/cosmtrek/air@latest
```

**Install sqlc and goose:**
```bash
# Install sqlc
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

# Install goose
go install github.com/pressly/goose/v3/cmd/goose@latest
```

**sqlc Configuration:**
**sqlc.yaml:**
```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "db/queries/"
    schema: "db/migrations/"
    gen:
      go:
        package: "db"
        out: "internal/db"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
```

**Database Migrations with Goose:**
**db/migrations/00001_create_nodes_table.sql:**
```sql
-- +goose Up
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location_x FLOAT NOT NULL,
    location_y FLOAT NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    capacity INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'inactive',
    cpu_usage FLOAT DEFAULT 0.0,
    memory_usage FLOAT DEFAULT 0.0,
    active_connections INTEGER DEFAULT 0,
    last_health_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_location ON nodes(location_x, location_y);
CREATE INDEX idx_nodes_created_at ON nodes(created_at);

-- +goose Down
DROP TABLE IF EXISTS nodes;
```

**db/migrations/00002_create_routing_requests_table.sql:**
```sql
-- +goose Up
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

-- Indexes
CREATE INDEX idx_routing_requests_status ON routing_requests(status);
CREATE INDEX idx_routing_requests_created_at ON routing_requests(created_at);
CREATE INDEX idx_routing_requests_selected_node ON routing_requests(selected_node_id);
CREATE INDEX idx_routing_requests_request_id ON routing_requests(request_id);
CREATE INDEX idx_routing_requests_data ON routing_requests USING GIN(request_data);
CREATE INDEX idx_routing_requests_metadata ON routing_requests USING GIN(metadata);

-- +goose Down
DROP TABLE IF EXISTS routing_requests;
```

**db/migrations/00003_create_system_metrics_table.sql:**
```sql
-- +goose Up
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    value FLOAT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX idx_system_metrics_node_id ON system_metrics(node_id);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp);

-- +goose Down
DROP TABLE IF EXISTS system_metrics;
```

**SQL Queries for sqlc:**
**db/queries/nodes.sql:**
```sql
-- name: CreateNode :one
INSERT INTO nodes (name, location_x, location_y, endpoint, capacity, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetNodeByID :one
SELECT * FROM nodes WHERE id = $1;

-- name: GetAllNodes :many
SELECT * FROM nodes ORDER BY created_at DESC;

-- name: GetHealthyNodes :many
SELECT * FROM nodes WHERE status = 'healthy' ORDER BY created_at DESC;

-- name: UpdateNode :one
UPDATE nodes 
SET name = $2, location_x = $3, location_y = $4, endpoint = $5, capacity = $6, status = $7,
    cpu_usage = $8, memory_usage = $9, active_connections = $10,
    last_health_check = $11, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateNodeHealth :one
UPDATE nodes 
SET status = $2, cpu_usage = $3, memory_usage = $4, active_connections = $5,
    last_health_check = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteNode :exec
DELETE FROM nodes WHERE id = $1;
```

**db/queries/routing_requests.sql:**
```sql
-- name: CreateRoutingRequest :one
INSERT INTO routing_requests (
    request_id, coordinates_x, coordinates_y, selected_node_id, 
    distance, load_score, status, request_data, metadata, client_info
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateRoutingResponse :one
UPDATE routing_requests 
SET response_data = $2, processing_metrics = $3, response_time_ms = $4, status = $5
WHERE id = $1
RETURNING *;

-- name: GetRecentRoutingRequests :many
SELECT * FROM routing_requests 
ORDER BY created_at DESC 
LIMIT $1;

-- name: GetRoutingRequestByID :one
SELECT * FROM routing_requests WHERE id = $1;

-- name: GetRoutingRequestsByNode :many
SELECT * FROM routing_requests 
WHERE selected_node_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetRoutingRequestsByStatus :many
SELECT * FROM routing_requests 
WHERE status = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: SearchRoutingRequests :many
SELECT * FROM routing_requests 
WHERE request_data @> $1::jsonb OR metadata @> $2::jsonb
ORDER BY created_at DESC
LIMIT $3;
```

**db/queries/system_metrics.sql:**
```sql
-- name: CreateSystemMetric :one
INSERT INTO system_metrics (metric_type, node_id, value)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetRecentSystemMetrics :many
SELECT * FROM system_metrics 
ORDER BY timestamp DESC 
LIMIT $1;
```

### 1.3 Development Setup Script
**scripts/setup.sh:**
```bash
#!/bin/bash
set -e

echo "Setting up Arx Supervisor..."

# Create project structure
mkdir -p supervisor/{cmd,internal/{database,routing,api,models,websocket,health,config},db/{migrations,queries},config,docs,scripts}
cd supervisor

# Initialize Go module
go mod init arx-supervisor

# Install dependencies
echo "Installing Go dependencies..."
go get -u github.com/gin-gonic/gin
go get -u github.com/lib/pq
go get -u github.com/jackc/pgx/v5/stdlib
go get -u github.com/sirupsen/logrus
go get -u github.com/gorilla/websocket
go get -u github.com/google/uuid
go get -u github.com/joho/godotenv

# Install development tools
echo "Installing development tools..."
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/cosmtrek/air@latest

# Create sqlc config
cat > sqlc.yaml << 'EOF'
version: "2"
sql:
  - engine: "postgresql"
    queries: "db/queries/"
    schema: "db/migrations/"
    gen:
      go:
        package: "db"
        out: "internal/db"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
EOF

# Create air config for hot reloading
cat > .air.toml << 'EOF'
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  args_bin = []
  bin = "./tmp/main"
  cmd = "go build -o ./tmp/main ./cmd/main.go"
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata", "db/migrations"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = ""
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html"]
  include_file = []
  kill_delay = "0s"
  log = "build-errors.log"
  poll = false
  poll_interval = 0
  rerun = false
  rerun_delay = 500
  send_interrupt = false
  stop_on_root = false

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  main_only = false
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
  keep_scroll = true
EOF

# Create .env file
cat > .env << 'EOF'
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
EOF

# Create Docker Compose file
cat > docker-compose.yml << 'EOF'
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: arx_supervisor
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - arx-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - arx-network

networks:
  arx-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
EOF

echo "Setup completed! Next steps:"
echo "1. Start the database: docker-compose up -d postgres redis"
echo "2. Generate sqlc code: sqlc generate"
echo "3. Run migrations: goose postgres 'user=postgres password=password dbname=arx_supervisor sslmode=disable' up"
echo "4. Start development server: air"
```

## Phase 2: Core Models & Database Layer

### 2.1 Data Models (Plain Go Structs)
**internal/models/node.go:**
```go
package models

import (
    "database/sql/driver"
    "time"
    "github.com/google/uuid"
)

type Node struct {
    ID                uuid.UUID  `json:"id"`
    Name              string     `json:"name"`
    LocationX         float64    `json:"location_x"`
    LocationY         float64    `json:"location_y"`
    Endpoint          string     `json:"endpoint"`
    Capacity          int        `json:"capacity"`
    Status            string     `json:"status"`
    CPUUsage          float64    `json:"cpu_usage"`
    MemoryUsage       float64    `json:"memory_usage"`
    ActiveConnections int        `json:"active_connections"`
    LastHealthCheck   *time.Time `json:"last_health_check"`
    CreatedAt         time.Time  `json:"created_at"`
    UpdatedAt         time.Time  `json:"updated_at"`
}

type RoutingRequest struct {
    ID                uuid.UUID  `json:"id"`
    RequestID         string     `json:"request_id"`
    CoordinatesX      float64    `json:"coordinates_x"`
    CoordinatesY      float64    `json:"coordinates_y"`
    SelectedNodeID    *uuid.UUID `json:"selected_node_id"`
    Distance          *float64   `json:"distance"`
    LoadScore         *float64   `json:"load_score"`
    Status            string     `json:"status"`
    ResponseTimeMs    *int       `json:"response_time_ms"`
    RequestData       *string    `json:"request_data"`       // Full request payload
    ResponseData      *string    `json:"response_data"`      // Response data
    Metadata          *string    `json:"metadata"`           // Request metadata
    ClientInfo        *string    `json:"client_info"`        // Client identification
    ProcessingMetrics *string    `json:"processing_metrics"` // Detailed metrics
    CreatedAt         time.Time  `json:"created_at"`
}

type SystemMetric struct {
    ID        uuid.UUID  `json:"id"`
    MetricType string    `json:"metric_type"`
    NodeID    *uuid.UUID `json:"node_id"`
    Value     float64    `json:"value"`
    Timestamp time.Time  `json:"timestamp"`
}

// Helper functions for working with UUIDs
func (n *Node) Scan(value interface{}) error {
    if value == nil {
        n.ID = uuid.Nil
        return nil
    }
    
    switch v := value.(type) {
    case []byte:
        n.ID = uuid.MustParse(string(v))
        return nil
    case string:
        n.ID = uuid.MustParse(v)
        return nil
    default:
        return fmt.Errorf("cannot scan %T into UUID", value)
    }
}

func (n Node) Value() (driver.Value, error) {
    return n.ID.String(), nil
}
```

### 2.2 Database Connection with sqlc
**internal/db/db.go:**
```go
package db

import (
    "context"
    "database/sql"
    "fmt"
    "time"
    
    "github.com/jackc/pgx/v5/stdlib"
    _ "github.com/lib/pq"
)

type Config struct {
    Host     string
    Port     int
    User     string
    Password string
    DBName   string
    SSLMode  string
}

type Database struct {
    DB *sql.DB
    Queries *Queries
}

func NewDatabase(ctx context.Context, config Config) (*Database, error) {
    // Build connection string
    dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        config.Host, config.Port, config.User, config.Password, config.DBName, config.SSLMode)
    
    // Open database connection
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, fmt.Errorf("failed to open database: %w", err)
    }
    
    // Configure connection pool
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(25)
    db.SetConnMaxLifetime(5 * time.Minute)
    
    // Test connection
    if err := db.PingContext(ctx); err != nil {
        return nil, fmt.Errorf("failed to ping database: %w", err)
    }
    
    // Initialize sqlc queries
    queries := New(db)
    
    return &Database{
        DB: db,
        Queries: queries,
    }, nil
}

func (d *Database) Close() error {
    return d.DB.Close()
}

func (d *Database) BeginTx(ctx context.Context, opts *sql.TxOptions) (*Queries, error) {
    tx, err := d.DB.BeginTx(ctx, opts)
    if err != nil {
        return nil, err
    }
    return New(tx), nil
}
```

### 2.3 Migration Helper
**internal/db/migrations.go:**
```go
package db

import (
    "context"
    "database/sql"
    "fmt"
    "log"
    "os"
    "path/filepath"
)

func RunMigrations(db *sql.DB, migrationsDir string) error {
    // Use goose to run migrations
    return goose.Run("up", db, migrationsDir)
}

func SetupDatabase(ctx context.Context, config Config) (*Database, error) {
    // First connect without specifying database to create it
    masterDB, err := sql.Open("postgres", fmt.Sprintf("host=%s port=%d user=%s password=%s sslmode=%s",
        config.Host, config.Port, config.User, config.Password, config.SSLMode))
    if err != nil {
        return nil, fmt.Errorf("failed to connect to postgres server: %w", err)
    }
    defer masterDB.Close()
    
    // Create database if it doesn't exist
    _, err = masterDB.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE %s", config.DBName))
    if err != nil {
        // Database might already exist, check error
        if !contains(err.Error(), "already exists") {
            log.Printf("Warning: %v", err)
        }
    }
    
    // Now connect to the specific database
    return NewDatabase(ctx, config)
}

func contains(s, substr string) bool {
    return len(s) >= len(substr) && (s == substr || 
           (len(s) > len(substr) && 
            (s[:len(substr)] == substr || 
             s[len(s)-len(substr):] == substr ||
             findSubstring(s, substr))))
}

func findSubstring(s, substr string) bool {
    for i := 0; i <= len(s)-len(substr); i++ {
        if s[i:i+len(substr)] == substr {
            return true
        }
    }
    return false
}
```

## Phase 3: Routing Engine

### 3.1 Distance Calculation
**internal/routing/algorithm.go:**
```go
package routing

import (
    "math"
    "sort"
    "arx-supervisor/internal/models"
)

func CalculateDistance(x1, y1, x2, y2 float64) float64 {
    return math.Sqrt(math.Pow(x1-x2, 2) + math.Pow(y1-y2, 2))
}

func FindKNearestNodes(nodes []models.Node, x, y float64, k int) []models.Node {
    type NodeWithDistance struct {
        models.Node
        Distance float64
    }
    
    var nodesWithDistance []NodeWithDistance
    for _, node := range nodes {
        if node.Status == "healthy" {
            dist := CalculateDistance(x, y, node.LocationX, node.LocationY)
            nodesWithDistance = append(nodesWithDistance, NodeWithDistance{
                Node:     node,
                Distance: dist,
            })
        }
    }
    
    // Sort by distance
    sort.Slice(nodesWithDistance, func(i, j int) bool {
        return nodesWithDistance[i].Distance < nodesWithDistance[j].Distance
    })
    
    // Return k nearest
    result := make([]models.Node, 0, k)
    for i := 0; i < k && i < len(nodesWithDistance); i++ {
        result = append(result, nodesWithDistance[i].Node)
    }
    
    return result
}

func SelectBestNode(nodes []models.Node) models.Node {
    if len(nodes) == 0 {
        return models.Node{}
    }
    
    bestNode := nodes[0]
    bestScore := calculateLoadScore(bestNode)
    
    for _, node := range nodes[1:] {
        score := calculateLoadScore(node)
        if score < bestScore {
            bestNode = node
            bestScore = score
        }
    }
    
    return bestNode
}

func calculateLoadScore(node models.Node) float64 {
    cpuWeight := 0.4
    memWeight := 0.3
    connWeight := 0.3
    
    cpuScore := node.CPUUsage / 100.0
    memScore := node.MemoryUsage / 100.0
    connScore := float64(node.ActiveConnections) / float64(node.Capacity)
    
    return cpuWeight*cpuScore + memWeight*memScore + connWeight*connScore
}

// Service struct for routing operations
type Service struct {
    db *db.Database
}

func NewService(database *db.Database) *Service {
    return &Service{
        db: database,
    }
}
```

### 3.2 Missing Imports Fix
The plan needs to include the missing import for the db package in the routing service. Here's the corrected structure that ensures all imports are properly handled.

## Phase 4: API Layer

### 4.1 Public API Endpoints
**internal/api/public.go:**
```go
package api

import (
    "database/sql"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/models"
    "arx-supervisor/internal/routing"
    "arx-supervisor/internal/websocket"
)

type PublicHandler struct {
    db     *db.Database
    router *routing.Service
    wsHub  *websocket.Hub
}

type RouteRequest struct {
    RequestID   string            `json:"request_id" binding:"required"`
    Coordinates models.Location   `json:"coordinates" binding:"required"`
    Priority    string            `json:"priority,omitempty"`
}

type RegisterNodeRequest struct {
    Name     string          `json:"name" binding:"required"`
    Location models.Location `json:"location" binding:"required"`
    Endpoint string          `json:"endpoint" binding:"required"`
}

type Location struct {
    X float64 `json:"x" binding:"required"`
    Y float64 `json:"y" binding:"required"`
}

type RouteResponse struct {
    RoutedTo  NodeInfo `json:"routed_to"`
    RequestID string   `json:"request_id"`
}

type NodeInfo struct {
    ID       uuid.UUID `json:"id"`
    Name     string    `json:"name"`
    Endpoint string    `json:"endpoint"`
    Distance float64   `json:"distance"`
    LoadScore float64  `json:"load_score"`
}

func NewPublicHandler(db *db.Database, router *routing.Service, wsHub *websocket.Hub) *PublicHandler {
    return &PublicHandler{
        db:     db,
        router: router,
        wsHub:  wsHub,
    }
}

// POST /api/v1/route
func (h *PublicHandler) RouteRequest(c *gin.Context) {
    var req RouteRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // Get all healthy nodes
    nodes, err := h.db.Queries.GetHealthyNodes(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes"})
        return
    }
    
    // Convert to models
    modelNodes := make([]models.Node, len(nodes))
    for i, node := range nodes {
        modelNodes[i] = models.Node{
            ID:                node.ID,
            Name:              node.Name,
            LocationX:         node.LocationX,
            LocationY:         node.LocationY,
            Endpoint:          node.Endpoint,
            Capacity:          node.Capacity,
            Status:            node.Status,
            CPUUsage:          node.CpuUsage,
            MemoryUsage:       node.MemoryUsage,
            ActiveConnections: node.ActiveConnections,
            LastHealthCheck:   node.LastHealthCheck,
            CreatedAt:         node.CreatedAt,
            UpdatedAt:         node.UpdatedAt,
        }
    }
    
    // Find k nearest nodes
    nearestNodes := routing.FindKNearestNodes(modelNodes, req.Coordinates.X, req.Coordinates.Y, 3)
    if len(nearestNodes) == 0 {
        c.JSON(http.StatusServiceUnavailable, gin.H{"error": "No healthy nodes available"})
        return
    }
    
    // Select best node
    selectedNode := routing.SelectBestNode(nearestNodes)
    distance := routing.CalculateDistance(req.Coordinates.X, req.Coordinates.Y, selectedNode.LocationX, selectedNode.LocationY)
    
    // Create routing request record
    routingReq, err := h.db.Queries.CreateRoutingRequest(c.Request.Context(), db.CreateRoutingRequestParams{
        RequestID:      req.RequestID,
        CoordinatesX:   req.Coordinates.X,
        CoordinatesY:   req.Coordinates.Y,
        SelectedNodeID: uuid.NullUUID{UUID: selectedNode.ID, Valid: true},
        Distance:       sql.NullFloat64{Float64: distance, Valid: true},
        LoadScore:      sql.NullFloat64{Float64: routing.CalculateLoadScore(selectedNode), Valid: true},
        Status:         "routed",
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create routing request"})
        return
    }
    
    // Send real-time update
    h.wsHub.Broadcast <- websocket.Message{
        Type: "route_request",
        Data: map[string]interface{}{
            "id":               routingReq.ID,
            "request_id":       routingReq.RequestID,
            "coordinates_x":    routingReq.CoordinatesX,
            "coordinates_y":    routingReq.CoordinatesY,
            "selected_node_id": routingReq.SelectedNodeID,
            "distance":         routingReq.Distance,
            "load_score":       routingReq.LoadScore,
            "status":           routingReq.Status,
            "created_at":       routingReq.CreatedAt,
        },
    }
    
    c.JSON(http.StatusOK, RouteResponse{
        RoutedTo: NodeInfo{
            ID:        selectedNode.ID,
            Name:      selectedNode.Name,
            Endpoint:  selectedNode.Endpoint,
            Distance:  distance,
            LoadScore: routing.CalculateLoadScore(selectedNode),
        },
        RequestID: req.RequestID,
    })
}

// GET /api/v1/nodes
func (h *PublicHandler) GetNodes(c *gin.Context) {
    nodes, err := h.db.Queries.GetAllNodes(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes"})
        return
    }
    
    // Convert to models
    modelNodes := make([]models.Node, len(nodes))
    for i, node := range nodes {
        modelNodes[i] = models.Node{
            ID:                node.ID,
            Name:              node.Name,
            LocationX:         node.LocationX,
            LocationY:         node.LocationY,
            Endpoint:          node.Endpoint,
            Capacity:          node.Capacity,
            Status:            node.Status,
            CPUUsage:          node.CpuUsage,
            MemoryUsage:       node.MemoryUsage,
            ActiveConnections: node.ActiveConnections,
            LastHealthCheck:   node.LastHealthCheck,
            CreatedAt:         node.CreatedAt,
            UpdatedAt:         node.UpdatedAt,
        }
    }
    
    c.JSON(http.StatusOK, modelNodes)
}

// POST /api/v1/nodes/register
func (h *PublicHandler) RegisterNode(c *gin.Context) {
    var req RegisterNodeRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    node, err := h.db.Queries.CreateNode(c.Request.Context(), db.CreateNodeParams{
        Name:      req.Name,
        LocationX: req.Location.X,
        LocationY: req.Location.Y,
        Endpoint:  req.Endpoint,
        Capacity:  100,
        Status:    "active",
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create node"})
        return
    }
    
    // Convert to model
    modelNode := models.Node{
        ID:                node.ID,
        Name:              node.Name,
        LocationX:         node.LocationX,
        LocationY:         node.LocationY,
        Endpoint:          node.Endpoint,
        Capacity:          node.Capacity,
        Status:            node.Status,
        CPUUsage:          node.CpuUsage,
        MemoryUsage:       node.MemoryUsage,
        ActiveConnections: node.ActiveConnections,
        LastHealthCheck:   node.LastHealthCheck,
        CreatedAt:         node.CreatedAt,
        UpdatedAt:         node.UpdatedAt,
    }
    
    // Broadcast update
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_registered",
        Data: modelNode,
    }
    
    c.JSON(http.StatusCreated, modelNode)
}

// GET /api/v1/health
func (h *PublicHandler) Health(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
        "status": "healthy",
        "service": "supervisor",
        "timestamp": time.Now().UTC(),
    })
}
```

### 4.2 Admin API Endpoints
**internal/api/admin.go:**
```go
package api

import (
    "database/sql"
    "net/http"
    "strconv"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/models"
    "arx-supervisor/internal/websocket"
)

type AdminHandler struct {
    db    *db.Database
    wsHub *websocket.Hub
}

type CreateNodeRequest struct {
    Name     string          `json:"name" binding:"required"`
    Location models.Location `json:"location" binding:"required"`
    Endpoint string          `json:"endpoint" binding:"required"`
    Capacity int             `json:"capacity"`
}

type UpdateNodeRequest struct {
    Name     *string          `json:"name,omitempty"`
    Location *models.Location `json:"location,omitempty"`
    Endpoint *string          `json:"endpoint,omitempty"`
    Capacity *int             `json:"capacity,omitempty"`
    Status   *string          `json:"status,omitempty"`
}

type DashboardMetrics struct {
    TotalNodes     int64                `json:"total_nodes"`
    HealthyNodes   int64                `json:"healthy_nodes"`
    RecentRequests []models.RoutingRequest `json:"recent_requests"`
    SystemMetrics  []models.SystemMetric   `json:"system_metrics"`
}

func NewAdminHandler(db *db.Database, wsHub *websocket.Hub) *AdminHandler {
    return &AdminHandler{
        db:    db,
        wsHub: wsHub,
    }
}

// GET /admin/api/v1/nodes
func (h *AdminHandler) GetAllNodes(c *gin.Context) {
    nodes, err := h.db.Queries.GetAllNodes(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes"})
        return
    }
    
    // Convert to models
    modelNodes := make([]models.Node, len(nodes))
    for i, node := range nodes {
        modelNodes[i] = models.Node{
            ID:                node.ID,
            Name:              node.Name,
            LocationX:         node.LocationX,
            LocationY:         node.LocationY,
            Endpoint:          node.Endpoint,
            Capacity:          node.Capacity,
            Status:            node.Status,
            CPUUsage:          node.CpuUsage,
            MemoryUsage:       node.MemoryUsage,
            ActiveConnections: node.ActiveConnections,
            LastHealthCheck:   node.LastHealthCheck,
            CreatedAt:         node.CreatedAt,
            UpdatedAt:         node.UpdatedAt,
        }
    }
    
    c.JSON(http.StatusOK, modelNodes)
}

// POST /admin/api/v1/nodes
func (h *AdminHandler) CreateNode(c *gin.Context) {
    var req CreateNodeRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // Set default capacity if not provided
    capacity := req.Capacity
    if capacity == 0 {
        capacity = 100
    }
    
    node, err := h.db.Queries.CreateNode(c.Request.Context(), db.CreateNodeParams{
        Name:      req.Name,
        LocationX: req.Location.X,
        LocationY: req.Location.Y,
        Endpoint:  req.Endpoint,
        Capacity:  int32(capacity),
        Status:    "inactive",
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create node"})
        return
    }
    
    // Convert to model
    modelNode := models.Node{
        ID:                node.ID,
        Name:              node.Name,
        LocationX:         node.LocationX,
        LocationY:         node.LocationY,
        Endpoint:          node.Endpoint,
        Capacity:          int(node.Capacity),
        Status:            node.Status,
        CPUUsage:          node.CpuUsage,
        MemoryUsage:       node.MemoryUsage,
        ActiveConnections: int(node.ActiveConnections),
        LastHealthCheck:   node.LastHealthCheck,
        CreatedAt:         node.CreatedAt,
        UpdatedAt:         node.UpdatedAt,
    }
    
    // Broadcast update
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_created",
        Data: modelNode,
    }
    
    c.JSON(http.StatusCreated, modelNode)
}

// PUT /admin/api/v1/nodes/:id
func (h *AdminHandler) UpdateNode(c *gin.Context) {
    idStr := c.Param("id")
    nodeID, err := uuid.Parse(idStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
        return
    }
    
    // Check if node exists
    existingNode, err := h.db.Queries.GetNodeByID(c.Request.Context(), nodeID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch node"})
        }
        return
    }
    
    var req UpdateNodeRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // Prepare update parameters
    params := db.UpdateNodeParams{
        ID: nodeID,
    }
    
    if req.Name != nil {
        params.Name = *req.Name
    } else {
        params.Name = existingNode.Name
    }
    
    if req.Location != nil {
        params.LocationX = req.Location.X
        params.LocationY = req.Location.Y
    } else {
        params.LocationX = existingNode.LocationX
        params.LocationY = existingNode.LocationY
    }
    
    if req.Endpoint != nil {
        params.Endpoint = *req.Endpoint
    } else {
        params.Endpoint = existingNode.Endpoint
    }
    
    if req.Capacity != nil {
        params.Capacity = int32(*req.Capacity)
    } else {
        params.Capacity = existingNode.Capacity
    }
    
    if req.Status != nil {
        params.Status = *req.Status
    } else {
        params.Status = existingNode.Status
    }
    
    // Preserve existing values for fields not being updated
    params.CpuUsage = existingNode.CpuUsage
    params.MemoryUsage = existingNode.MemoryUsage
    params.ActiveConnections = existingNode.ActiveConnections
    params.LastHealthCheck = existingNode.LastHealthCheck
    
    updatedNode, err := h.db.Queries.UpdateNode(c.Request.Context(), params)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update node"})
        return
    }
    
    // Convert to model
    modelNode := models.Node{
        ID:                updatedNode.ID,
        Name:              updatedNode.Name,
        LocationX:         updatedNode.LocationX,
        LocationY:         updatedNode.LocationY,
        Endpoint:          updatedNode.Endpoint,
        Capacity:          int(updatedNode.Capacity),
        Status:            updatedNode.Status,
        CPUUsage:          updatedNode.CpuUsage,
        MemoryUsage:       updatedNode.MemoryUsage,
        ActiveConnections: int(updatedNode.ActiveConnections),
        LastHealthCheck:   updatedNode.LastHealthCheck,
        CreatedAt:         updatedNode.CreatedAt,
        UpdatedAt:         updatedNode.UpdatedAt,
    }
    
    // Broadcast update
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_updated",
        Data: modelNode,
    }
    
    c.JSON(http.StatusOK, modelNode)
}

// DELETE /admin/api/v1/nodes/:id
func (h *AdminHandler) DeleteNode(c *gin.Context) {
    idStr := c.Param("id")
    nodeID, err := uuid.Parse(idStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
        return
    }
    
    err = h.db.Queries.DeleteNode(c.Request.Context(), nodeID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete node"})
        return
    }
    
    // Broadcast update
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_deleted",
        Data: gin.H{"node_id": nodeID},
    }
    
    c.JSON(http.StatusNoContent, nil)
}

// GET /admin/api/v1/dashboard/metrics
func (h *AdminHandler) GetDashboardMetrics(c *gin.Context) {
    // Get all nodes to count
    allNodes, err := h.db.Queries.GetAllNodes(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes"})
        return
    }
    
    totalNodes := int64(len(allNodes))
    healthyNodes := int64(0)
    for _, node := range allNodes {
        if node.Status == "healthy" {
            healthyNodes++
        }
    }
    
    // Get recent requests
    recentRequestsDB, err := h.db.Queries.GetRecentRoutingRequests(c.Request.Context(), 100)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recent requests"})
        return
    }
    
    recentRequests := make([]models.RoutingRequest, len(recentRequestsDB))
    for i, req := range recentRequestsDB {
        recentRequests[i] = models.RoutingRequest{
            ID:             req.ID,
            RequestID:      req.RequestID,
            CoordinatesX:   req.CoordinatesX,
            CoordinatesY:   req.CoordinatesY,
            SelectedNodeID: &req.SelectedNodeID.UUID,
            Distance:       &req.Distance.Float64,
            LoadScore:      &req.LoadScore.Float64,
            Status:         req.Status,
            ResponseTimeMs: &req.ResponseTimeMs.Int32,
            CreatedAt:      req.CreatedAt,
        }
    }
    
    // Get system metrics
    systemMetricsDB, err := h.db.Queries.GetRecentSystemMetrics(c.Request.Context(), 50)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch system metrics"})
        return
    }
    
    systemMetrics := make([]models.SystemMetric, len(systemMetricsDB))
    for i, metric := range systemMetricsDB {
        systemMetrics[i] = models.SystemMetric{
            ID:        metric.ID,
            MetricType: metric.MetricType,
            NodeID:    &metric.NodeID.UUID,
            Value:     metric.Value,
            Timestamp: metric.Timestamp,
        }
    }
    
    c.JSON(http.StatusOK, DashboardMetrics{
        TotalNodes:     totalNodes,
        HealthyNodes:   healthyNodes,
        RecentRequests: recentRequests,
        SystemMetrics:  systemMetrics,
    })
}

// GET /admin/api/v1/requests/export
func (h *AdminHandler) ExportRequests(c *gin.Context) {
    // Parse query parameters
    limitStr := c.DefaultQuery("limit", "1000")
    limit, err := strconv.Atoi(limitStr)
    if err != nil || limit <= 0 {
        limit = 1000
    }
    
    requestsDB, err := h.db.Queries.GetRecentRoutingRequests(c.Request.Context(), int32(limit))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export requests"})
        return
    }
    
    // Convert and return
    requests := make([]models.RoutingRequest, len(requestsDB))
    for i, req := range requestsDB {
        requests[i] = models.RoutingRequest{
            ID:             req.ID,
            RequestID:      req.RequestID,
            CoordinatesX:   req.CoordinatesX,
            CoordinatesY:   req.CoordinatesY,
            SelectedNodeID: &req.SelectedNodeID.UUID,
            Distance:       &req.Distance.Float64,
            LoadScore:      &req.LoadScore.Float64,
            Status:         req.Status,
            ResponseTimeMs: &req.ResponseTimeMs.Int32,
            CreatedAt:      req.CreatedAt,
        }
    }
    
    c.JSON(http.StatusOK, requests)
}
```

## Phase 5: WebSocket Hub

### 5.1 Real-time Communication
**internal/websocket/hub.go:**
```go
package websocket

import (
    "github.com/gorilla/websocket"
    "net/http"
)

type Message struct {
    Type string      `json:"type"`
    Data interface{} `json:"data"`
}

type Hub struct {
    clients    map[*Client]bool
    broadcast  chan Message
    register   chan *Client
    unregister chan *Client
}

type Client struct {
    hub  *Hub
    conn *websocket.Conn
    send chan Message
}

func NewHub() *Hub {
    return &Hub{
        clients:    make(map[*Client]bool),
        broadcast:  make(chan Message),
        register:   make(chan *Client),
        unregister: make(chan *Client),
    }
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
            
        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
            
        case message := <-h.broadcast:
            for client := range h.clients {
                select {
                case client.send <- message:
                default:
                    close(client.send)
                    delete(h.clients, client)
                }
            }
        }
    }
}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func (h *Hub) HandleWebSocket(c *gin.Context) {
    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }
    
    client := &Client{
        hub:  h,
        conn: conn,
        send: make(chan Message, 256),
    }
    
    client.hub.register <- client
    
    go client.writePump()
    go client.readPump()
}
```

## Phase 6: Health Monitoring

### 6.1 Health Checker
**internal/health/monitor.go:**
```go
package health

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "time"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/websocket"
)

type HealthResponse struct {
    Status string       `json:"status"`
    NodeID string       `json:"node_id"`
    Load   NodeLoad     `json:"load"`
    Location NodeLocation `json:"location"`
    Timestamp string    `json:"timestamp"`
}

type NodeLoad struct {
    CPUPercent        float64 `json:"cpu_percent"`
    MemoryPercent     float64 `json:"memory_percent"`
    ActiveConnections int     `json:"active_connections"`
    Capacity          int     `json:"capacity"`
}

type NodeLocation struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}

type Monitor struct {
    db       *db.Database
    wsHub    *websocket.Hub
    interval time.Duration
}

func NewMonitor(db *db.Database, wsHub *websocket.Hub, interval time.Duration) *Monitor {
    return &Monitor{
        db:       db,
        wsHub:    wsHub,
        interval: interval,
    }
}

func (m *Monitor) Start() {
    ticker := time.NewTicker(m.interval)
    defer ticker.Stop()
    
    for range ticker.C {
        m.checkAllNodes()
    }
}

func (m *Monitor) checkAllNodes() {
    nodes, err := m.db.Queries.GetAllNodes(context.Background())
    if err != nil {
        return
    }
    
    for _, node := range nodes {
        go m.checkNode(node)
    }
}

func (m *Monitor) checkNode(node db.Node) {
    client := &http.Client{Timeout: 5 * time.Second}
    resp, err := client.Get(node.Endpoint + "/health")
    
    var status string = "unhealthy"
    var cpuUsage float64 = 0.0
    var memoryUsage float64 = 0.0
    var activeConnections int32 = 0
    
    if err == nil && resp.StatusCode == 200 {
        defer resp.Body.Close()
        
        // Parse health response
        var healthResp HealthResponse
        if err := json.NewDecoder(resp.Body).Decode(&healthResp); err == nil {
            status = "healthy"
            cpuUsage = healthResp.Load.CPUPercent
            memoryUsage = healthResp.Load.MemoryPercent
            activeConnections = int32(healthResp.Load.ActiveConnections)
        }
    }
    
    // Update node in database
    now := time.Now()
    _, err = m.db.Queries.UpdateNodeHealth(context.Background(), db.UpdateNodeHealthParams{
        ID:                node.ID,
        Status:            status,
        CpuUsage:          cpuUsage,
        MemoryUsage:       memoryUsage,
        ActiveConnections: activeConnections,
        LastHealthCheck:   sql.NullTime{Time: now, Valid: true},
    })
    
    if err != nil {
        return
    }
    
    // Broadcast update
    m.wsHub.Broadcast <- websocket.Message{
        Type: "node_health_updated",
        Data: map[string]interface{}{
            "id":                   node.ID,
            "name":                 node.Name,
            "status":               status,
            "cpu_usage":            cpuUsage,
            "memory_usage":         memoryUsage,
            "active_connections":   activeConnections,
            "last_health_check":    now,
        },
    }
    
    // Also create system metrics
    m.createSystemMetric(node.ID, "cpu_usage", cpuUsage)
    m.createSystemMetric(node.ID, "memory_usage", memoryUsage)
    m.createSystemMetric(node.ID, "active_connections", float64(activeConnections))
}

func (m *Monitor) createSystemMetric(nodeID uuid.UUID, metricType string, value float64) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    _, err := m.db.Queries.CreateSystemMetric(ctx, db.CreateSystemMetricParams{
        MetricType: metricType,
        NodeID:     uuid.NullUUID{UUID: nodeID, Valid: true},
        Value:      value,
    })
    
    if err != nil {
        // Log error but don't fail the health check
        // In production, you'd want proper logging here
    }
}
```

## Phase 7: Main Application

### 7.1 Server Setup
**cmd/main.go:**
```go
package main

import (
    "context"
    "log"
    "os"
    "os/signal"
    "syscall"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/joho/godotenv"
    "arx-supervisor/internal/api"
    "arx-supervisor/internal/config"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/health"
    "arx-supervisor/internal/routing"
    "arx-supervisor/internal/websocket"
)

func main() {
    // Load .env file if exists
    if err := godotenv.Load(); err != nil {
        log.Println("No .env file found, using environment variables")
    }
    
    // Load configuration
    cfg := config.Load()
    
    // Setup graceful shutdown
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()
    
    // Initialize database
    database, err := db.SetupDatabase(ctx, cfg.Database)
    if err != nil {
        log.Fatal("Failed to setup database:", err)
    }
    defer database.Close()
    
    // Run migrations
    log.Println("Running database migrations...")
    if err := db.RunMigrations(database.DB, "db/migrations"); err != nil {
        log.Fatal("Failed to run migrations:", err)
    }
    log.Println("Migrations completed successfully")
    
    // Initialize WebSocket hub
    wsHub := websocket.NewHub()
    go wsHub.Run()
    
    // Initialize health monitor
    healthMonitor := health.NewMonitor(database, wsHub, time.Duration(cfg.Health.CheckInterval)*time.Second)
    go healthMonitor.Start()
    
    // Initialize routing service
    routingService := routing.NewService(database)
    
    // Initialize node management handlers
    registrationHandler := api.NewRegistrationHandler(database, wsHub)
    nodeMgmtHandler := api.NewNodeManagementHandler(database, wsHub)
    
    // Setup router
    r := gin.Default()
    
    // Enable CORS for admin dashboard
    r.Use(func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }
        
        c.Next()
    })
    
    // WebSocket endpoint
    r.GET("/admin/api/v1/realtime", wsHub.HandleWebSocket)
    
    // Public API
    publicHandler := api.NewPublicHandler(database, routingService, wsHub)
    public := r.Group("/api/v1")
    {
        public.POST("/route", publicHandler.RouteRequest)
        public.GET("/nodes", publicHandler.GetNodes)
        public.POST("/nodes/register", publicHandler.RegisterNode)
        public.GET("/health", publicHandler.Health)
    }
    
    // Admin API
    adminHandler := api.NewAdminHandler(database, wsHub)
    registrationHandler := api.NewRegistrationHandler(database, wsHub)
    nodeMgmtHandler := api.NewNodeManagementHandler(database, wsHub)
    admin := r.Group("/admin/api/v1")
    {
        // Node CRUD operations
        admin.GET("/nodes", adminHandler.GetAllNodes)
        admin.POST("/nodes", adminHandler.CreateNode)
        admin.PUT("/nodes/:id", adminHandler.UpdateNode)
        admin.DELETE("/nodes/:id", adminHandler.DeleteNode)
        
        // Node registration and management
        admin.POST("/nodes/register", registrationHandler.RegisterNode)
        admin.POST("/nodes/:id/activate", nodeMgmtHandler.ActivateNode)
        admin.POST("/nodes/:id/deactivate", nodeMgmtHandler.DeactivateNode)
        admin.GET("/nodes/:id/status", nodeMgmtHandler.GetNodeStatus)
        
        // Dashboard and metrics
        admin.GET("/dashboard/metrics", adminHandler.GetDashboardMetrics)
        admin.GET("/requests/export", adminHandler.ExportRequests)
    }
    
    // Start server in a goroutine
    srv := &http.Server{
        Addr:    ":" + cfg.Server.Port,
        Handler: r,
    }
    
    go func() {
        log.Printf("Server starting on port %s", cfg.Server.Port)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal("Server failed to start:", err)
        }
    }()
    
    // Wait for interrupt signal to gracefully shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    log.Println("Shutting down server...")
    
    // Shutdown HTTP server
    ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatal("Server forced to shutdown:", err)
    }
    
    log.Println("Server exited")
}
```

### 7.2 Configuration
**internal/config/config.go:**
```go
package config

import (
    "os"
    "strconv"
)

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Routing  RoutingConfig
    Health   HealthConfig
}

type ServerConfig struct {
    Port string
    Host string
}

type DatabaseConfig struct {
    Host    string
    Port    int
    User    string
    Password string
    DBName  string
    SSLMode string
}

type RoutingConfig struct {
    KNearest       int
    MaxDistance    float64
    LoadWeight     float64
    DistanceWeight float64
}

type HealthConfig struct {
    CheckInterval    int
    Timeout          int
    FailureThreshold int
}

func Load() Config {
    return Config{
        Server: ServerConfig{
            Port: getEnv("SERVER_PORT", "8080"),
            Host: getEnv("SERVER_HOST", "0.0.0.0"),
        },
        Database: DatabaseConfig{
            Host:     getEnv("DB_HOST", "localhost"),
            Port:     getEnvInt("DB_PORT", 5432),
            User:     getEnv("DB_USER", "postgres"),
            Password: getEnv("DB_PASSWORD", "password"),
            DBName:   getEnv("DB_NAME", "arx_supervisor"),
            SSLMode:  getEnv("DB_SSLMODE", "disable"),
        },
        Routing: RoutingConfig{
            KNearest:       getEnvInt("K_NEAREST", 3),
            MaxDistance:    getEnvFloat("MAX_DISTANCE", 50.0),
            LoadWeight:     getEnvFloat("LOAD_WEIGHT", 0.6),
            DistanceWeight: getEnvFloat("DISTANCE_WEIGHT", 0.4),
        },
        Health: HealthConfig{
            CheckInterval:    getEnvInt("HEALTH_CHECK_INTERVAL", 30),
            Timeout:          getEnvInt("HEALTH_TIMEOUT", 5),
            FailureThreshold: getEnvInt("HEALTH_FAILURE_THRESHOLD", 3),
        },
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
    if value := os.Getenv(key); value != "" {
        if intValue, err := strconv.Atoi(value); err == nil {
            return intValue
        }
    }
    return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
    if value := os.Getenv(key); value != "" {
        if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
            return floatValue
        }
    }
    return defaultValue
}
```

## Phase 8: Manual Node Registration & Management

### 8.1 Simple Node Registration API
**internal/api/registration.go:**
```go
package api

import (
    "context"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/websocket"
)

type RegistrationHandler struct {
    db    *db.Database
    wsHub *websocket.Hub
}

type RegisterNodeRequest struct {
    Endpoint  string          `json:"endpoint" binding:"required"`
    Name      string          `json:"name" binding:"required"`
    Location  models.Location `json:"location" binding:"required"`
    Capacity  int             `json:"capacity"`
    AutoStart bool            `json:"auto_start,omitempty"` // Auto-activate after registration
}

func NewRegistrationHandler(db *db.Database, wsHub *websocket.Hub) *RegistrationHandler {
    return &RegistrationHandler{
        db:    db,
        wsHub: wsHub,
    }
}

// POST /admin/api/v1/nodes/register
func (h *RegistrationHandler) RegisterNode(c *gin.Context) {
    var req RegisterNodeRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // Set default capacity if not provided
    capacity := req.Capacity
    if capacity == 0 {
        capacity = 100
    }
    
    // Create node in database (initially inactive)
    status := "inactive"
    if req.AutoStart {
        status = "active"
    }
    
    node, err := h.db.Queries.CreateNode(c.Request.Context(), db.CreateNodeParams{
        Name:      req.Name,
        LocationX: req.Location.X,
        LocationY: req.Location.Y,
        Endpoint:  req.Endpoint,
        Capacity:  int32(capacity),
        Status:    status,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register node"})
        return
    }
    
    // Convert to model
    modelNode := models.Node{
        ID:                node.ID,
        Name:              node.Name,
        LocationX:         node.LocationX,
        LocationY:         node.LocationY,
        Endpoint:          node.Endpoint,
        Capacity:          int(node.Capacity),
        Status:            node.Status,
        CPUUsage:          node.CpuUsage,
        MemoryUsage:       node.MemoryUsage,
        ActiveConnections: int(node.ActiveConnections),
        LastHealthCheck:   node.LastHealthCheck,
        CreatedAt:         node.CreatedAt,
        UpdatedAt:         node.UpdatedAt,
    }
    
    // Broadcast node registration
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_registered",
        Data: modelNode,
    }
    
    c.JSON(http.StatusCreated, gin.H{
        "message": "Node registered successfully",
        "node":    modelNode,
    })
}
```

### 8.2 Node Activation/Deactivation API
**internal/api/node_management.go:**
```go
package api

import (
    "database/sql"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/websocket"
)

type NodeManagementHandler struct {
    db    *db.Database
    wsHub *websocket.Hub
}

func NewNodeManagementHandler(db *db.Database, wsHub *websocket.Hub) *NodeManagementHandler {
    return &NodeManagementHandler{
        db:    db,
        wsHub: wsHub,
    }
}

// POST /admin/api/v1/nodes/:id/activate
func (h *NodeManagementHandler) ActivateNode(c *gin.Context) {
    idStr := c.Param("id")
    nodeID, err := uuid.Parse(idStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
        return
    }
    
    // Check if node exists
    node, err := h.db.Queries.GetNodeByID(c.Request.Context(), nodeID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch node"})
        }
        return
    }
    
    // Only allow activation of inactive nodes
    if node.Status == "active" || node.Status == "healthy" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Node is already active"})
        return
    }
    
    // Update node status to active
    updatedNode, err := h.db.Queries.UpdateNodeStatus(c.Request.Context(), db.UpdateNodeStatusParams{
        ID:     nodeID,
        Status: "active",
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate node"})
        return
    }
    
    // Broadcast activation
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_activated",
        Data: map[string]interface{}{
            "id":     nodeID,
            "name":   updatedNode.Name,
            "status": "active",
        },
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Node activated successfully",
        "node_id": nodeID,
        "status":  "active",
    })
}

// POST /admin/api/v1/nodes/:id/deactivate
func (h *NodeManagementHandler) DeactivateNode(c *gin.Context) {
    idStr := c.Param("id")
    nodeID, err := uuid.Parse(idStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
        return
    }
    
    // Check if node exists
    node, err := h.db.Queries.GetNodeByID(c.Request.Context(), nodeID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch node"})
        }
        return
    }
    
    // Allow deactivation of any active node
    if node.Status == "inactive" || node.Status == "disabled" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Node is already inactive"})
        return
    }
    
    // Update node status to inactive
    updatedNode, err := h.db.Queries.UpdateNodeStatus(c.Request.Context(), db.UpdateNodeStatusParams{
        ID:     nodeID,
        Status: "inactive",
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate node"})
        return
    }
    
    // Broadcast deactivation
    h.wsHub.Broadcast <- websocket.Message{
        Type: "node_deactivated",
        Data: map[string]interface{}{
            "id":     nodeID,
            "name":   updatedNode.Name,
            "status": "inactive",
        },
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Node deactivated successfully",
        "node_id": nodeID,
        "status":  "inactive",
    })
}

// GET /admin/api/v1/nodes/:id/status
func (h *NodeManagementHandler) GetNodeStatus(c *gin.Context) {
    idStr := c.Param("id")
    nodeID, err := uuid.Parse(idStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
        return
    }
    
    node, err := h.db.Queries.GetNodeByID(c.Request.Context(), nodeID)
    if err != nil {
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch node"})
        }
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "node_id":       node.ID,
        "name":          node.Name,
        "status":        node.Status,
        "endpoint":      node.Endpoint,
        "capacity":      node.Capacity,
        "last_health_check": node.LastHealthCheck,
        "cpu_usage":     node.CpuUsage,
        "memory_usage":  node.MemoryUsage,
        "active_connections": node.ActiveConnections,
    })
}
```

### 8.3 Enhanced Database Queries for Status Management
**db/queries/node_management.sql:**
```sql
-- name: UpdateNodeStatus :one
UPDATE nodes 
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetActiveNodes :many
SELECT * FROM nodes 
WHERE status IN ('active', 'healthy') 
ORDER BY created_at DESC;

-- name: GetNodesByStatus :many
SELECT * FROM nodes 
WHERE status = $1
ORDER BY created_at DESC;

-- name: GetNodeCountByStatus :one
SELECT COUNT(*) as count
FROM nodes 
WHERE status = $1;
```

### 8.2 Auto-Discovery System
**internal/discovery/manager.go:**
```go
package discovery

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/websocket"
)

type NodeIdentity struct {
    NodeID       string            `json:"node_id"`
    Name         string            `json:"name"`
    Location     Location          `json:"location"`
    Capabilities []string         `json:"capabilities"`
    Capacity     NodeCapacity     `json:"capacity"`
    Endpoints    NodeEndpoints    `json:"endpoints"`
    Version      string           `json:"version"`
    StartupTime  time.Time        `json:"startup_time"`
}

type Location struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}

type NodeCapacity struct {
    MaxConcurrent int `json:"max_concurrent"`
    CPUCores     int `json:"cpu_cores"`
    MemoryGB     int `json:"memory_gb"`
}

type NodeEndpoints struct {
    Health  string `json:"health"`
    Process string `json:"process"`
    Metrics string `json:"metrics"`
    Config  string `json:"config"`
}

type DiscoveryManager struct {
    db       *db.Database
    wsHub    *websocket.Hub
    client   *http.Client
    registry map[string]*NodeIdentity // In-memory cache
}

func NewDiscoveryManager(db *db.Database, wsHub *websocket.Hub) *DiscoveryManager {
    return &DiscoveryManager{
        db:       db,
        wsHub:    wsHub,
        client:   &http.Client{Timeout: 10 * time.Second},
        registry: make(map[string]*NodeIdentity),
    }
}

// DiscoverAndRegister handles the complete node discovery workflow
func (dm *DiscoveryManager) DiscoverAndRegister(ctx context.Context, endpoint string) error {
    // Step 1: Check reachability
    healthURL := endpoint + "/health"
    if !dm.isReachable(ctx, healthURL) {
        return fmt.Errorf("node at %s is not reachable", endpoint)
    }
    
    // Step 2: Get node identity
    identityURL := endpoint + "/identity"
    identity, err := dm.getNodeIdentity(ctx, identityURL)
    if err != nil {
        return fmt.Errorf("failed to get node identity: %w", err)
    }
    
    // Step 3: Register in database
    node, err := dm.db.Queries.CreateNode(ctx, db.CreateNodeParams{
        Name:      identity.Name,
        LocationX: identity.Location.X,
        LocationY: identity.Location.Y,
        Endpoint:  endpoint,
        Capacity:  int32(identity.Capacity.MaxConcurrent),
        Status:    "discovered",
    })
    if err != nil {
        return fmt.Errorf("failed to register node: %w", err)
    }
    
    // Step 4: Cache in registry
    dm.registry[identity.NodeID] = identity
    
    // Step 5: Broadcast discovery
    dm.wsHub.Broadcast <- websocket.Message{
        Type: "node_discovered",
        Data: map[string]interface{}{
            "node_id":   identity.NodeID,
            "name":      identity.Name,
            "location":  identity.Location,
            "endpoint":  endpoint,
            "db_id":     node.ID,
            "identity":  identity,
        },
    }
    
    return nil
}

func (dm *DiscoveryManager) isReachable(ctx context.Context, healthURL string) bool {
    req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
    if err != nil {
        return false
    }
    
    resp, err := dm.client.Do(req)
    if err != nil {
        return false
    }
    defer resp.Body.Close()
    
    return resp.StatusCode == 200
}

func (dm *DiscoveryManager) getNodeIdentity(ctx context.Context, identityURL string) (*NodeIdentity, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", identityURL, nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := dm.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("identity endpoint returned status %d", resp.StatusCode.StatusCode)
    }
    
    var identity NodeIdentity
    if err := json.NewDecoder(resp.Body).Decode(&identity); err != nil {
        return nil, fmt.Errorf("failed to parse identity response: %w", err)
    }
    
    return &identity, nil
}

// BatchDiscover attempts to discover multiple nodes from a list of endpoints
func (dm *DiscoveryManager) BatchDiscover(ctx context.Context, endpoints []string) []error {
    errors := make([]error, 0)
    
    for _, endpoint := range endpoints {
        if err := dm.DiscoverAndRegister(ctx, endpoint); err != nil {
            errors = append(errors, fmt.Errorf("failed to discover %s: %w", endpoint, err))
        }
    }
    
    return errors
}

// AutoDiscovery starts periodic discovery for known node ranges
func (dm *DiscoveryManager) AutoDiscovery(ctx context.Context, interval time.Duration, discoverFunc func() []string) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            endpoints := discoverFunc()
            dm.BatchDiscover(ctx, endpoints)
        }
    }
}
```

### 8.3 Node Registration API
**internal/api/discovery.go:**
```go
package api

import (
    "context"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "arx-supervisor/internal/db"
    "arx-supervisor/internal/discovery"
    "arx-supervisor/internal/websocket"
)

type DiscoveryHandler struct {
    db              *db.Database
    discoveryMgr    *discovery.DiscoveryManager
    wsHub           *websocket.Hub
}

type DiscoverRequest struct {
    Endpoint string `json:"endpoint" binding:"required"`
}

type BatchDiscoverRequest struct {
    Endpoints []string `json:"endpoints" binding:"required"`
}

func NewDiscoveryHandler(db *db.Database, discoveryMgr *discovery.DiscoveryManager, wsHub *websocket.Hub) *DiscoveryHandler {
    return &DiscoveryHandler{
        db:           db,
        discoveryMgr: discoveryMgr,
        wsHub:        wsHub,
    }
}

// POST /admin/api/v1/discovery/discover
func (h *DiscoveryHandler) DiscoverNode(c *gin.Context) {
    var req DiscoverRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    err := h.discoveryMgr.DiscoverAndRegister(c.Request.Context(), req.Endpoint)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"message": "Node discovery initiated"})
}

// POST /admin/api/v1/discovery/batch
func (h *DiscoveryHandler) BatchDiscover(c *gin.Context) {
    var req BatchDiscoverRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    errors := h.discoveryMgr.BatchDiscover(c.Request.Context(), req.Endpoints)
    if len(errors) > 0 {
        c.JSON(http.StatusMultiStatus, gin.H{
            "discovered": len(req.Endpoints) - len(errors),
            "failed":     len(errors),
            "errors":     errors,
        })
    } else {
        c.JSON(http.StatusOK, gin.H{
            "message": "All nodes discovered successfully",
            "count":    len(req.Endpoints),
        })
    }
}

// GET /admin/api/v1/discovery/scan
func (h *DiscoveryHandler) ScanNetwork(c *gin.Context) {
    // Scan common port ranges for potential nodes
    network := c.Query("network")
    if network == "" {
        network = "192.168.1.0/24" // Default network
    }
    
    endpoints := h.scanNetwork(network)
    
    errors := h.discoveryMgr.BatchDiscover(c.Request.Context(), endpoints)
    
    c.JSON(http.StatusOK, gin.H{
        "scanned":    len(endpoints),
        "discovered": len(endpoints) - len(errors),
        "failed":     len(errors),
    })
}

func (h *DiscoveryHandler) scanNetwork(network string) []string {
    // Implement network scanning logic
    // This is a placeholder - in practice you'd use proper network scanning
    commonPorts := []int{8080, 8081, 8082, 9000, 9001}
    var endpoints []string
    
    // For demo purposes, return some known endpoints
    // In production, implement proper network scanning
    baseIP := "192.168.1"
    for i := 100; i <= 105; i++ {
        for _, port := range commonPorts {
            endpoints = append(endpoints, fmt.Sprintf("http://%s.%d:%d", baseIP, i, port))
        }
    }
    
    return endpoints
}
```

### 8.4 Enhanced API Handler with Request Data
**Updated internal/api/public.go with JSON request data:**
```go
// Enhanced RouteRequest with request data
type RouteRequest struct {
    RequestID   string                 `json:"request_id" binding:"required"`
    Coordinates models.Location         `json:"coordinates" binding:"required"`
    Priority    string                 `json:"priority,omitempty"`
    Payload     map[string]interface{} `json:"payload,omitempty"`      // Request payload
    Headers     map[string]string      `json:"headers,omitempty"`      // Request headers
    Metadata    map[string]interface{} `json:"metadata,omitempty"`     // Client metadata
    ClientInfo  map[string]interface{} `json:"client_info,omitempty"`  // Client info
}

// POST /api/v1/route (enhanced with data collection)
func (h *PublicHandler) RouteRequest(c *gin.Context) {
    var req RouteRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // Serialize request data for storage
    requestData, _ := json.Marshal(req)
    metadata, _ := json.Marshal(map[string]interface{}{
        "user_agent":    c.GetHeader("User-Agent"),
        "remote_addr":   c.ClientIP(),
        "request_time":  time.Now(),
        "priority":      req.Priority,
    })
    clientInfo, _ := json.Marshal(req.ClientInfo)
    
    // Get all healthy nodes
    nodes, err := h.db.Queries.GetHealthyNodes(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes"})
        return
    }
    
    // Convert to models and find best node
    modelNodes := convertToModelNodes(nodes)
    nearestNodes := routing.FindKNearestNodes(modelNodes, req.Coordinates.X, req.Coordinates.Y, 3)
    if len(nearestNodes) == 0 {
        c.JSON(http.StatusServiceUnavailable, gin.H{"error": "No healthy nodes available"})
        return
    }
    
    selectedNode := routing.SelectBestNode(nearestNodes)
    distance := routing.CalculateDistance(req.Coordinates.X, req.Coordinates.Y, selectedNode.LocationX, selectedNode.LocationY)
    
    // Create routing request with full data
    routingReq, err := h.db.Queries.CreateRoutingRequest(c.Request.Context(), db.CreateRoutingRequestParams{
        RequestID:         req.RequestID,
        CoordinatesX:      req.Coordinates.X,
        CoordinatesY:      req.Coordinates.Y,
        SelectedNodeID:     uuid.NullUUID{UUID: selectedNode.ID, Valid: true},
        Distance:          sql.NullFloat64{Float64: distance, Valid: true},
        LoadScore:         sql.NullFloat64{Float64: routing.CalculateLoadScore(selectedNode), Valid: true},
        Status:            "routed",
        RequestData:        sql.NullString{String: string(requestData), Valid: true},
        Metadata:           sql.NullString{String: string(metadata), Valid: true},
        ClientInfo:        sql.NullString{String: string(clientInfo), Valid: true},
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create routing request"})
        return
    }
    
    // Forward request to selected node
    startTime := time.Now()
    response, err := h.forwardRequest(selectedNode, req)
    responseTime := time.Since(startTime)
    
    // Store response data
    var responseData, processingMetrics *string
    if err == nil {
        respData, _ := json.Marshal(response)
        responseData = &respData
        
        metrics, _ := json.Marshal(map[string]interface{}{
            "node_processing_time": responseTime.Milliseconds(),
            "queue_time":         0, // Would come from node response
            "total_latency":       responseTime.Milliseconds(),
        })
        processingMetrics = &metrics
    }
    
    // Update routing request with response data
    _, err = h.db.Queries.UpdateRoutingResponse(c.Request.Context(), db.UpdateRoutingResponseParams{
        ID:                routingReq.ID,
        ResponseData:       sql.NullString{String: ptrToString(responseData), Valid: responseData != nil},
        ProcessingMetrics:  sql.NullString{String: ptrToString(processingMetrics), Valid: processingMetrics != nil},
        ResponseTimeMs:     sql.NullInt32{Int32: int32(responseTime.Milliseconds()), Valid: true},
        Status:            "completed",
    })
    
    // Broadcast complete request lifecycle
    h.wsHub.Broadcast <- websocket.Message{
        Type: "request_completed",
        Data: map[string]interface{}{
            "id":                routingReq.ID,
            "request_id":        routingReq.RequestID,
            "selected_node":     selectedNode.ID,
            "distance":          distance,
            "response_time_ms":  responseTime.Milliseconds(),
            "status":            "completed",
            "request_data":      string(requestData),
            "response_data":     ptrToString(responseData),
            "processing_metrics": ptrToString(processingMetrics),
        },
    }
    
    c.JSON(http.StatusOK, RouteResponse{
        RoutedTo: NodeInfo{
            ID:        selectedNode.ID,
            Name:      selectedNode.Name,
            Endpoint:  selectedNode.Endpoint,
            Distance:  distance,
            LoadScore: routing.CalculateLoadScore(selectedNode),
        },
        RequestID: req.RequestID,
        ResponseData: response,
        Metrics: map[string]interface{}{
            "response_time_ms": responseTime.Milliseconds(),
            "node_id":         selectedNode.ID,
        },
    })
}

func forwardRequest(node models.Node, req RouteRequest) (interface{}, error) {
    // Implement actual request forwarding to node
    // This would make HTTP request to node's processing endpoint
    return map[string]interface{}{
        "status":  "processed",
        "node_id": node.ID,
    }, nil
}

func ptrToString(s *string) string {
    if s == nil {
        return ""
    }
    return *s
}
```

## Phase 9: Docker Setup

### 8.1 Dockerfile
**Dockerfile:**
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o supervisor ./cmd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/supervisor .
COPY --from=builder /app/config ./config

EXPOSE 8080

CMD ["./supervisor"]
```

### 8.2 Docker Compose Integration
**docker-compose.yml:**
```yaml
version: '3.8'

services:
  supervisor:
    build: 
      context: ./supervisor
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SERVER_PORT=8080
      - SERVER_HOST=0.0.0.0
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=password
      - DB_NAME=arx_supervisor
      - DB_SSLMODE=disable
      - K_NEAREST=3
      - MAX_DISTANCE=50.0
      - LOAD_WEIGHT=0.6
      - DISTANCE_WEIGHT=0.4
      - HEALTH_CHECK_INTERVAL=30
      - HEALTH_TIMEOUT=5
      - HEALTH_FAILURE_THRESHOLD=3
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - arx-network
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=arx_supervisor
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - arx-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - arx-network
    restart: unless-stopped

  # Note: Edge nodes are managed by the user outside this compose file
  # Users can start their own swarm of nodes and register them manually

networks:
  arx-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

**init-scripts/01-init.sql:**
```sql
-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for performance
-- These will be created by migrations, but we can ensure they exist here
CREATE INDEX IF NOT EXISTS CONCURRENTLY idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS CONCURRENTLY idx_nodes_location ON nodes(location_x, location_y);
CREATE INDEX IF NOT EXISTS CONCURRENTLY idx_nodes_created_at ON nodes(created_at);
```

**docker-compose.dev.yml** (for development):
```yaml
version: '3.8'

services:
  supervisor:
    build: 
      context: ./supervisor
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    environment:
      - SERVER_PORT=8080
      - SERVER_HOST=0.0.0.0
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=password
      - DB_NAME=arx_supervisor
      - DB_SSLMODE=disable
      - K_NEAREST=3
      - MAX_DISTANCE=50.0
      - LOAD_WEIGHT=0.6
      - DISTANCE_WEIGHT=0.4
      - HEALTH_CHECK_INTERVAL=30
      - HEALTH_TIMEOUT=5
      - HEALTH_FAILURE_THRESHOLD=3
    volumes:
      - ./supervisor:/app
      - /app/bin  # Exclude bin directory to avoid conflicts
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - arx-network
    command: air -c .air.toml  # Use air for hot reloading

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=arx_supervisor
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
      - ./supervisor/db/migrations:/docker-entrypoint-initdb.d/migrations
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - arx-network

networks:
  arx-network:
    driver: bridge

volumes:
  postgres_data:
```

### 8.3 Development Tools

**supervisor/.air.toml:**
```toml
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  args_bin = []
  bin = "./tmp/main"
  cmd = "go build -o ./tmp/main ./cmd/main.go"
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata", "db/migrations"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = ""
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html"]
  include_file = []
  kill_delay = "0s"
  log = "build-errors.log"
  poll = false
  poll_interval = 0
  rerun = false
  rerun_delay = 500
  send_interrupt = false
  stop_on_root = false

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  main_only = false
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
  keep_scroll = true
```

**supervisor/Dockerfile.dev:**
```dockerfile
FROM golang:1.21-alpine

# Install development tools
RUN go install github.com/cosmtrek/air@latest
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
RUN go install github.com/pressly/goose/v3/cmd/goose@latest

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Default command will be overridden by docker-compose
CMD ["air", "-c", ".air.toml"]
```

## Implementation Timeline

**Week 1:** Database setup, models, basic API structure
**Week 2:** Routing algorithm and core business logic
**Week 3:** WebSocket implementation and health monitoring
**Week 4:** Admin endpoints and dashboard integration
**Week 5:** Testing, optimization, and deployment setup

## Key Features Delivered

✅ **Core Routing**: K-nearest with load balancing  
✅ **Database Persistence**: PostgreSQL with sqlc (type-safe queries) and Goose migrations  
✅ **UUID-based Node Identification**: Primary ID is UUID, with non-unique name field  
✅ **Real-time Updates**: WebSocket for live dashboard  
✅ **Health Monitoring**: Automatic node health checks  
✅ **Admin Interface**: Complete CRUD operations for nodes  
✅ **Metrics & Analytics**: Request tracking and system metrics  
✅ **Docker Support**: Production-ready containerization with database setup  
✅ **Type Safety**: Compile-time checked SQL queries with sqlc  
✅ **Migration Management**: Version-controlled database schema with Goose  

## Manual Node Registration & Management

### How to Add New Nodes

#### Step 1: Register Node Endpoint
Register your node by providing its endpoint and configuration:

```bash
# Register a new node (initially inactive)
curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{
    "endpoint": "http://edge-node-01:8080",
    "name": "Primary Processing Node",
    "location": {"x": 10.5, "y": 20.3},
    "capacity": 100,
    "auto_start": false
  }'

# Register and auto-activate
curl -X POST http://localhost:8080/admin/api/v1/nodes/register \
  -d '{
    "endpoint": "http://edge-node-02:8080",
    "name": "Secondary Processing Node", 
    "location": {"x": 15.0, "y": 25.0},
    "capacity": 100,
    "auto_start": true
  }'
```

#### Step 2: Activate/Deactivate Nodes
Control whether nodes receive requests:

```bash
# Activate a node (will start receiving requests)
curl -X POST http://localhost:8080/admin/api/v1/nodes/{node-uuid}/activate

# Deactivate a node (will stop receiving new requests)
curl -X POST http://localhost:8080/admin/api/v1/nodes/{node-uuid}/deactivate

# Check node status
curl -X GET http://localhost:8080/admin/api/v1/nodes/{node-uuid}/status
```

#### Step 3: Manage Your Node Swarm
You manage your own Docker Compose with multiple nodes:

```yaml
# Your docker-compose.yml for edge nodes
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

networks:
  default:
    name: edge-network
```

### Node Status Flow

```
┌─────────────┐    Register     ┌─────────────┐    Activate    ┌─────────────┐
│  Started    │ ─────────────► │  Inactive   │ ────────────► │   Active    │
│   Docker    │                │  (Stored)   │               │ (Receives   │
│  Container  │                │             │               │  Requests)  │
└─────────────┘                └─────────────┘               └─────────────┘
          │                           │                           │
          ▼                           ▼                           ▼
    Health Checks               No Requests                Health Checks
    (but no routing)             (not in pool)            + Routing
```

### Edge Node Requirements

Your edge nodes only need these minimal endpoints:

#### `/health` Endpoint (Required)
```json
{
  "status": "healthy",
  "load": {
    "cpu_percent": 45.2,
    "memory_percent": 67.8,
    "active_connections": 12,
    "capacity": 100
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

That's it! No complex identity endpoint needed. The supervisor handles registration manually.

### Monitoring & Analytics Enhancement

With the new JSONB fields, you can now monitor:

#### Complete Request Lifecycle
```sql
-- Search requests by payload content
SELECT * FROM routing_requests 
WHERE request_data @> '{"priority": "high"}'::jsonb;

-- Get average response time by client
SELECT 
  client_info->>'client_id' as client,
  AVG(response_time_ms) as avg_response_ms
FROM routing_requests 
WHERE client_info IS NOT NULL
GROUP BY client_info->>'client_id';

-- Find failed requests by error patterns
SELECT request_id, created_at, response_data
FROM routing_requests 
WHERE status = 'failed' 
  AND response_data @> '{"error": "timeout"}'::jsonb;
```

#### Real-time Monitoring Dashboard
- **Request Heatmap**: Geographic distribution of requests
- **Performance Metrics**: Response times by node, client, request type
- **Error Analysis**: Failed requests by error type, node, time
- **Client Analytics**: Request patterns by client, API usage
- **System Health**: Comprehensive node performance data

#### Request Data Storage Benefits
✅ **Full Audit Trail**: Complete request/response lifecycle  
✅ **Debugging**: Detailed information for troubleshooting  
✅ **Analytics**: Rich data for performance analysis  
✅ **Compliance**: Complete request history for audits  
✅ **Machine Learning**: Data for predictive analytics  
✅ **Client Insights**: Usage patterns and behavior analysis  

## Key Changes from GORM to sqlc

1. **Type Safety**: All SQL queries are type-checked at compile time
2. **Performance**: No ORM overhead, direct SQL execution
3. **Better Control**: Explicit SQL queries rather than hidden ORM magic
4. **Migration Management**: Separate migration tool (Goose) for better control
5. **UUID Primary Keys**: Using UUID as primary identifier with optional non-unique names
6. **Enhanced Monitoring**: JSONB fields for comprehensive request data storage
7. **Manual Registration**: Simple endpoint-based node registration with activation control
8. **Complete Audit**: Full request/response lifecycle tracking

## Node Management API

### Registration Endpoints
- `POST /admin/api/v1/nodes/register` - Register new node (inactive by default)
- `POST /admin/api/v1/nodes/{id}/activate` - Activate node (start receiving requests)
- `POST /admin/api/v1/nodes/{id}/deactivate` - Deactivate node (stop receiving requests)  
- `GET /admin/api/v1/nodes/{id}/status` - Get current node status

### Node Statuses
- `inactive` - Registered but not receiving requests
- `active` - Receiving requests (but may not be healthy)
- `healthy` - Active and passing health checks
- `unhealthy` - Active but failing health checks
- `disabled` - Manually disabled (like inactive)

### Workflow Benefits
✅ **Simple Registration**: Just provide endpoint and basic info  
✅ **Activation Control**: Decide when nodes start receiving requests  
✅ **Manual Management**: You control the node lifecycle  
✅ **Docker Swarm Ready**: Works with any container setup  
✅ **No Auto-Discovery Complexity**: Clean, predictable registration  
✅ **Graceful Degradation**: Deactivate nodes without removing them
