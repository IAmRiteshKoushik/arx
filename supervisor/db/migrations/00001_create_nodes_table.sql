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