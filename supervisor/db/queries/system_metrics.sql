-- name: CreateSystemMetric :one
INSERT INTO system_metrics (metric_type, node_id, value)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetRecentSystemMetrics :many
SELECT * FROM system_metrics 
ORDER BY timestamp DESC 
LIMIT $1;