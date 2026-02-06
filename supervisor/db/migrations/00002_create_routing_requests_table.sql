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