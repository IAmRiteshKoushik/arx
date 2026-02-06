package routing

import (
	"context"
	"time"

	"arx-supervisor/internal/database"
	"arx-supervisor/internal/db"
	"arx-supervisor/internal/models"
	"github.com/google/uuid"
)

type Service struct {
	db *database.Database
}

func NewService(database *database.Database) *Service {
	return &Service{
		db: database,
	}
}

func convertDBNodeToModel(node db.Node) models.Node {
	var lastHealthCheck *time.Time
	if node.LastHealthCheck.Valid {
		lastHealthCheck = &node.LastHealthCheck.Time
	}

	// Convert pgtype.UUID to uuid.UUID
	nodeUUID, err := uuid.FromBytes(node.ID.Bytes[:])
	if err != nil {
		nodeUUID = uuid.Nil
	}

	return models.Node{
		ID:                nodeUUID,
		Name:              node.Name,
		LocationX:         node.LocationX,
		LocationY:         node.LocationY,
		Endpoint:          node.Endpoint,
		Capacity:          int(node.Capacity.Int32),
		Status:            node.Status.String,
		CPUUsage:          node.CpuUsage.Float64,
		MemoryUsage:       node.MemoryUsage.Float64,
		ActiveConnections: int(node.ActiveConnections.Int32),
		LastHealthCheck:   lastHealthCheck,
		CreatedAt:         node.CreatedAt.Time,
		UpdatedAt:         node.UpdatedAt.Time,
	}
}

func (s *Service) RouteRequest(ctx context.Context, requestID string, coordinates models.Location) (*models.Node, error) {
	// Get all healthy nodes
	nodes, err := s.db.Queries.GetHealthyNodes(ctx)
	if err != nil {
		return nil, err
	}

	// Convert to models
	modelNodes := make([]models.Node, len(nodes))
	for i, node := range nodes {
		modelNodes[i] = convertDBNodeToModel(node)
	}

	// Find k nearest nodes
	nearestNodes := FindKNearestNodes(modelNodes, coordinates.X, coordinates.Y, 3)
	if len(nearestNodes) == 0 {
		return nil, nil // No healthy nodes available
	}

	// Select best node
	selectedNode := SelectBestNode(nearestNodes)
	return &selectedNode, nil
}

func (s *Service) GetAllNodes(ctx context.Context) ([]models.Node, error) {
	nodes, err := s.db.Queries.GetAllNodes(ctx)
	if err != nil {
		return nil, err
	}

	modelNodes := make([]models.Node, len(nodes))
	for i, node := range nodes {
		modelNodes[i] = convertDBNodeToModel(node)
	}

	return modelNodes, nil
}
