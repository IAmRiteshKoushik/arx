package api

import (
	"net/http"
	"time"

	"arx-supervisor/internal/database"
	"arx-supervisor/internal/models"
	"arx-supervisor/internal/routing"
	"arx-supervisor/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PublicHandler struct {
	db     *database.Database
	router *routing.Service
	wsHub  *websocket.Hub
}

type RouteRequest struct {
	RequestID   string          `json:"request_id" binding:"required"`
	Coordinates models.Location `json:"coordinates" binding:"required"`
	Priority    string          `json:"priority,omitempty"`
}

type RegisterNodeRequest struct {
	Name     string          `json:"name" binding:"required"`
	Location models.Location `json:"location" binding:"required"`
	Endpoint string          `json:"endpoint" binding:"required"`
}

type RouteResponse struct {
	RoutedTo  NodeInfo `json:"routed_to"`
	RequestID string   `json:"request_id"`
}

type NodeInfo struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Endpoint  string    `json:"endpoint"`
	Distance  float64   `json:"distance"`
	LoadScore float64   `json:"load_score"`
}

func NewPublicHandler(db *database.Database, router *routing.Service, wsHub *websocket.Hub) *PublicHandler {
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

	// Route the request
	selectedNode, err := h.router.RouteRequest(c.Request.Context(), req.RequestID, req.Coordinates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to route request"})
		return
	}

	if selectedNode == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "No healthy nodes available"})
		return
	}

	// Calculate distance and load score
	distance := routing.CalculateDistance(req.Coordinates.X, req.Coordinates.Y, selectedNode.LocationX, selectedNode.LocationY)
	loadScore := routing.CalculateLoadScore(*selectedNode)

	// Create routing request record in database would go here
	// For now, just send the response

	// Send real-time update
	h.wsHub.Broadcast <- websocket.Message{
		Type: "route_request",
		Data: map[string]interface{}{
			"request_id":    req.RequestID,
			"coordinates_x": req.Coordinates.X,
			"coordinates_y": req.Coordinates.Y,
			"selected_node": selectedNode,
			"distance":      distance,
			"load_score":    loadScore,
			"status":        "routed",
			"timestamp":     time.Now().UTC(),
		},
	}

	c.JSON(http.StatusOK, RouteResponse{
		RoutedTo: NodeInfo{
			ID:        selectedNode.ID,
			Name:      selectedNode.Name,
			Endpoint:  selectedNode.Endpoint,
			Distance:  distance,
			LoadScore: loadScore,
		},
		RequestID: req.RequestID,
	})
}

// GET /api/v1/nodes
func (h *PublicHandler) GetNodes(c *gin.Context) {
	nodes, err := h.router.GetAllNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes"})
		return
	}

	c.JSON(http.StatusOK, nodes)
}

// POST /api/v1/nodes/register
func (h *PublicHandler) RegisterNode(c *gin.Context) {
	var req RegisterNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create node in database would go here
	// For now, just return a mock response
	nodeUUID := uuid.New()
	mockNode := models.Node{
		ID:        nodeUUID,
		Name:      req.Name,
		LocationX: req.Location.X,
		LocationY: req.Location.Y,
		Endpoint:  req.Endpoint,
		Capacity:  100,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Broadcast update
	h.wsHub.Broadcast <- websocket.Message{
		Type: "node_registered",
		Data: mockNode,
	}

	c.JSON(http.StatusCreated, mockNode)
}

// GET /api/v1/health
func (h *PublicHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "supervisor",
		"timestamp": time.Now().UTC(),
	})
}
