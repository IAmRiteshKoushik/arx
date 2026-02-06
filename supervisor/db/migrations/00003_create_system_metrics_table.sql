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