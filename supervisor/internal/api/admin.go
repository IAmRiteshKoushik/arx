package api

import (
	"net/http"
	"strconv"
	"time"

	"arx-supervisor/internal/database"
	"arx-supervisor/internal/models"
	"arx-supervisor/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminHandler struct {
	db    *database.Database
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
	TotalNodes     int64                   `json:"total_nodes"`
	HealthyNodes   int64                   `json:"healthy_nodes"`
	RecentRequests []models.RoutingRequest `json:"recent_requests"`
	SystemMetrics  []models.SystemMetric   `json:"system_metrics"`
}

func NewAdminHandler(db *database.Database, wsHub *websocket.Hub) *AdminHandler {
	return &AdminHandler{
		db:    db,
		wsHub: wsHub,
	}
}

// GET /admin/api/v1/nodes
func (h *AdminHandler) GetAllNodes(c *gin.Context) {
	// This would get all nodes from database
	// For now, return empty list
	c.JSON(http.StatusOK, []models.Node{})
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

	// Create node in database would go here
	// For now, return a mock response
	nodeUUID := uuid.New()
	mockNode := models.Node{
		ID:        nodeUUID,
		Name:      req.Name,
		LocationX: req.Location.X,
		LocationY: req.Location.Y,
		Endpoint:  req.Endpoint,
		Capacity:  capacity,
		Status:    "inactive",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Broadcast update
	h.wsHub.Broadcast <- websocket.Message{
		Type: "node_created",
		Data: mockNode,
	}

	c.JSON(http.StatusCreated, mockNode)
}

// PUT /admin/api/v1/nodes/:id
func (h *AdminHandler) UpdateNode(c *gin.Context) {
	idStr := c.Param("id")
	nodeID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	// Check if node exists would go here
	// For now, just return a mock response

	var req UpdateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update node in database would go here
	// For now, return a mock response
	mockNode := models.Node{
		ID:        nodeID,
		Name:      "Updated Node",
		LocationX: 0.0,
		LocationY: 0.0,
		Endpoint:  "http://updated-endpoint",
		Capacity:  100,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Broadcast update
	h.wsHub.Broadcast <- websocket.Message{
		Type: "node_updated",
		Data: mockNode,
	}

	c.JSON(http.StatusOK, mockNode)
}

// DELETE /admin/api/v1/nodes/:id
func (h *AdminHandler) DeleteNode(c *gin.Context) {
	idStr := c.Param("id")
	nodeID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	// Delete node from database would go here

	// Broadcast update
	h.wsHub.Broadcast <- websocket.Message{
		Type: "node_deleted",
		Data: gin.H{"node_id": nodeID},
	}

	c.JSON(http.StatusNoContent, nil)
}

// GET /admin/api/v1/dashboard/metrics
func (h *AdminHandler) GetDashboardMetrics(c *gin.Context) {
	// Get metrics from database would go here
	// For now, return mock data
	metrics := DashboardMetrics{
		TotalNodes:     5,
		HealthyNodes:   3,
		RecentRequests: []models.RoutingRequest{},
		SystemMetrics:  []models.SystemMetric{},
	}

	c.JSON(http.StatusOK, metrics)
}

// GET /admin/api/v1/requests/export
func (h *AdminHandler) ExportRequests(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "1000")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 1000
	}

	// Get requests from database would go here
	// For now, return empty list
	requests := []models.RoutingRequest{}

	c.JSON(http.StatusOK, requests)
}
