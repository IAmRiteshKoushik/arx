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