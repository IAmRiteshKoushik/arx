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