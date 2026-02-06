# Location-Based Supervisor for Video Processing Edge Nodes

## Overview

This document outlines the architecture and implementation plan for a 
location-based supervisor process that manages and routes traffic to edge 
nodes based on coordinate proximity. The supervisor integrates with the 
existing video processing simulator to provide intelligent routing and load 
balancing across distributed edge containers.

## System Architecture

### Core Components

#### 1. Supervisor Service (Go)
- **Location Registry**: Maintains real-time registry of edge node coordinates and health status
- **Routing Engine**: Implements K-nearest neighbor algorithm with load balancing
- **Load Balancer**: Distributes processing requests across available nodes
- **Health Monitor**: Basic retry mechanism and node availability tracking
- **API Gateway**: RESTful interface for client requests and node registration

#### 2. Enhanced Edge Nodes
- **Location Configuration**: Static coordinate assignment per container
- **Health Endpoints**: `/health` and `/status` endpoints for monitoring
- **Load Metrics**: CPU/memory usage reporting for intelligent routing
- **Video Processing**: Existing video processing capabilities from base simulator

#### 3. Communication Layer
- **REST API**: For routing requests and node management
- **Health Checks**: Periodic monitoring of node availability
- **Load Reporting**: Real-time load metrics from edge nodes

## Routing Strategy

### K-Nearest with Load Balancing

**Algorithm Flow:**
1. Calculate Euclidean distance from request coordinates to all registered nodes
2. Filter for healthy nodes only
3. Select K=3 nearest healthy nodes
4. Choose node with lowest current load
5. Route request to selected node
6. Fallback to next nearest if primary fails

**Distance Calculation:**
```
distance = √((x1 - x2)² + (y1 - y2)²)
```

**Load Balancing Factors:**
- CPU usage percentage
- Memory usage percentage
- Active connection count
- Recent response times

## Implementation Plan

### Phase 1: Foundation Setup
- [ ] Implement basic video processing services from original simulator plan
- [ ] Add location configuration to edge nodes via environment variables
- [ ] Create health check endpoints (`/health`, `/status`) on edge nodes
- [ ] Set up Docker networking for supervisor-node communication
- [ ] Implement basic load metrics collection

### Phase 2: Supervisor Core Development
- [ ] Build location registry service with in-memory storage
- [ ] Implement coordinate-based routing algorithm (K-nearest)
- [ ] Add basic load balancing logic
- [ ] Create REST API endpoints for routing and node management
- [ ] Implement node registration and deregistration

### Phase 3: Integration & Communication
- [ ] Connect supervisor to edge nodes via HTTP APIs
- [ ] Implement health checking mechanism (30-second intervals)
- [ ] Add retry logic for failed routing attempts
- [ ] Create load metrics reporting from nodes to supervisor
- [ ] Implement node failure detection and handling

### Phase 4: Testing & Optimization
- [ ] Create simulation environment for testing routing decisions
- [ ] Implement load testing scenarios
- [ ] Add comprehensive logging and monitoring
- [ ] Optimize routing algorithm performance
- [ ] Create deployment and configuration documentation

### Phase 5: Production Readiness
- [ ] Add configuration management for routing parameters
- [ ] Implement API rate limiting
- [ ] Add security features (authentication, authorization)
- [ ] Create backup and recovery procedures
- [ ] Performance tuning and scalability testing

## Technical Specifications

### Supervisor Service

**Technology Stack:**
- **Language**: Go 1.21+
- **Framework**: Gin for REST APIs
- **Storage**: In-memory registry (suitable for 10-50 nodes)
- **Monitoring**: Structured JSON logging
- **Configuration**: Environment variables + config files

**API Endpoints:**
```
POST   /api/v1/route          # Route request based on coordinates
GET    /api/v1/nodes          # List all registered nodes
POST   /api/v1/nodes/register # Node registration
DELETE /api/v1/nodes/{id}     # Node deregistration
GET    /api/v1/health         # Supervisor health
GET    /api/v1/metrics        # Routing metrics
```

**Request Format:**
```json
{
  "coordinates": {
    "x": 10.5,
    "y": 20.3
  },
  "request_id": "req-12345",
  "priority": "normal"
}
```

**Response Format:**
```json
{
  "routed_to": {
    "node_id": "edge-node-01",
    "endpoint": "http://edge-node-01:8080/process",
    "distance": 2.3,
    "load_score": 0.25
  },
  "alternatives": [
    {
      "node_id": "edge-node-02",
      "distance": 3.1,
      "load_score": 0.45
    }
  ],
  "request_id": "req-12345"
}
```

### Edge Node Configuration

**Environment Variables:**
```bash
NODE_ID=edge-node-01
NODE_LOCATION_X=10.5
NODE_LOCATION_Y=20.3
NODE_CAPACITY=100
HEALTH_CHECK_INTERVAL=30
```

**Enhanced Docker Compose:**
```yaml
version: '3.8'
services:
  supervisor:
    build: ./supervisor
    ports:
      - "8080:8080"
    environment:
      - SUPERVISOR_ID=sup-01
      - K_NEAREST=3
      - HEALTH_CHECK_INTERVAL=30

  edge-node-01:
    build: ./edge-node
    environment:
      - NODE_ID=edge-node-01
      - NODE_LOCATION_X=10.5
      - NODE_LOCATION_Y=20.3
      - NODE_CAPACITY=100
    depends_on:
      - supervisor

  edge-node-02:
    build: ./edge-node
    environment:
      - NODE_ID=edge-node-02
      - NODE_LOCATION_X=15.0
      - NODE_LOCATION_Y=25.0
      - NODE_CAPACITY=100
    depends_on:
      - supervisor
```

### Health Check Endpoints

**Edge Node Health Check:**
```
GET /health
Response:
{
  "status": "healthy",
  "node_id": "edge-node-01",
  "location": {"x": 10.5, "y": 20.3},
  "load": {
    "cpu_percent": 45.2,
    "memory_percent": 67.8,
    "active_connections": 12,
    "capacity": 100
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Data Flow Architecture

```
┌─────────────────┐    1. Request + Coords    ┌─────────────────┐
│   Client        │ ──────────────────────────>│   Supervisor    │
└─────────────────┘                           └─────────┬───────┘
                                                       │ 2. Calculate
                                                       │    K-nearest
                                                       │    + Load
                                                       │
┌─────────────────┐    5. Process Video    ┌─────────┴───────┐
│   Edge Node     │ <─────────────────────── │   Routing       │
│   (Processing)  │    4. Route Request      │   Engine        │
└─────────────────┘                           └─────────────────┘
      │ 3. Redirect/Proxy
      │
┌─────────────────┐    6. Response          ┌─────────────────┐
│   Client        │ <───────────────────────│   Edge Node     │
└─────────────────┘                         └─────────────────┘
```

## Configuration Management

### Supervisor Configuration
```yaml
# config/supervisor.yaml
supervisor:
  id: "sup-01"
  port: 8080
  
routing:
  k_nearest: 3
  max_distance: 50.0
  load_weight: 0.6
  distance_weight: 0.4
  
health:
  check_interval: 30
  timeout: 5
  failure_threshold: 3
  
logging:
  level: "info"
  format: "json"
```

### Edge Node Configuration
```yaml
# config/edge-node.yaml
node:
  id: "${NODE_ID}"
  location:
    x: "${NODE_LOCATION_X}"
    y: "${NODE_LOCATION_Y}"
  capacity: 100
  
processing:
  max_concurrent: 10
  timeout: 30
  
health:
  check_interval: 30
  endpoint: "/health"
```

## Monitoring & Observability

### Key Metrics
- Routing decision latency
- Node availability percentage
- Load distribution across nodes
- Request success/failure rates
- Average response times

### Logging Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "supervisor",
  "request_id": "req-12345",
  "action": "route_request",
  "coordinates": {"x": 10.5, "y": 20.3},
  "selected_node": "edge-node-01",
  "distance": 2.3,
  "load_score": 0.25,
  "duration_ms": 15
}
```

## Fault Tolerance

### Basic Retry Mechanism
- **Initial Retry**: 2 seconds after failure
- **Backoff**: Exponential backoff with jitter
- **Max Retries**: 3 attempts per request
- **Circuit Breaker**: Temporary node exclusion after 3 consecutive failures

### Node Failure Handling
1. Detect failed health checks
2. Remove node from routing pool temporarily
3. Route to alternative nodes
4. Attempt node recovery after backoff period
5. Reintegrate node after successful health check

## Security Considerations

### Authentication & Authorization
- API key authentication for routing requests
- Node authentication for registration
- Rate limiting per client and per node
- Input validation for coordinates

### Network Security
- Internal service network isolation
- TLS encryption for supervisor-node communication
- Firewall rules for allowed ports
- VPN or private networking for production

## Performance Requirements

### Supervisor Service
- **Routing Latency**: < 10ms per request
- **Concurrent Requests**: 100+ simultaneous
- **Memory Usage**: < 256MB
- **CPU Usage**: < 10% under normal load

### Edge Nodes
- **Health Check Response**: < 100ms
- **Registration Time**: < 1 second
- **Load Reporting**: Every 30 seconds

## Scaling Considerations

### Current Scale (10-50 nodes)
- In-memory registry is sufficient
- Single supervisor instance
- Simple load balancing algorithm

### Future Scaling (100+ nodes)
- Distributed registry (Redis/etcd)
- Multiple supervisor instances
- Advanced load balancing algorithms
- Geographic zone-based routing

## Dependencies

### Go Libraries
- `github.com/gin-gonic/gin` - HTTP framework
- `github.com/sirupsen/logrus` - Structured logging
- `github.com/gorilla/websocket` - WebSocket communication
- `github.com/prometheus/client_golang` - Metrics collection

### System Dependencies
- Docker 20.x+
- Docker Compose 2.x+
- Go 1.21+

## Testing Strategy

### Unit Tests
- Routing algorithm correctness
- Load balancing logic
- Health check handling
- Configuration management

### Integration Tests
- Supervisor-node communication
- End-to-end request routing
- Node failure scenarios
- Load balancing under stress

### Performance Tests
- Routing latency under load
- Concurrent request handling
- Memory usage profiling
- Network resilience testing

## Deployment Guide

### Development Environment
```bash
# Start all services
docker-compose up -d

# Register edge nodes
curl -X POST http://localhost:8080/api/v1/nodes/register \
  -d '{"node_id": "edge-01", "location": {"x": 10, "y": 20}}'

# Test routing
curl -X POST http://localhost:8080/api/v1/route \
  -d '{"coordinates": {"x": 12, "y": 22}}'
```

### Production Deployment
1. Configure production environment variables
2. Set up monitoring and alerting
3. Configure backup and recovery
4. Implement security measures
5. Performance tune for expected load
6. Set up log aggregation
7. Configure automated scaling if needed

## Next Steps

1. **Environment Setup**: Initialize supervisor and edge-node Go projects
2. **Core Services**: Implement basic video processing with location config
3. **Supervisor Development**: Build routing engine and API endpoints
4. **Integration**: Connect supervisor to edge nodes
5. **Testing**: Implement comprehensive test suite
6. **Documentation**: Create detailed deployment guides
7. **Production**: Deploy to staging environment for validation

This plan provides a solid foundation for implementing location-based routing across edge nodes while maintaining the existing video processing capabilities. The architecture is designed for the specified small scale (10-50 nodes) with clear paths for future scaling.
