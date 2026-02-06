package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Node struct {
	ID                uuid.UUID  `json:"id"`
	Name              string     `json:"name"`
	LocationX         float64    `json:"location_x"`
	LocationY         float64    `json:"location_y"`
	Endpoint          string     `json:"endpoint"`
	Capacity          int        `json:"capacity"`
	Status            string     `json:"status"`
	CPUUsage          float64    `json:"cpu_usage"`
	MemoryUsage       float64    `json:"memory_usage"`
	ActiveConnections int        `json:"active_connections"`
	LastHealthCheck   *time.Time `json:"last_health_check"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type RoutingRequest struct {
	ID                uuid.UUID  `json:"id"`
	RequestID         string     `json:"request_id"`
	CoordinatesX      float64    `json:"coordinates_x"`
	CoordinatesY      float64    `json:"coordinates_y"`
	SelectedNodeID    *uuid.UUID `json:"selected_node_id"`
	Distance          *float64   `json:"distance"`
	LoadScore         *float64   `json:"load_score"`
	Status            string     `json:"status"`
	ResponseTimeMs    *int       `json:"response_time_ms"`
	RequestData       *string    `json:"request_data"`       // Full request payload
	ResponseData      *string    `json:"response_data"`      // Response data
	Metadata          *string    `json:"metadata"`           // Request metadata
	ClientInfo        *string    `json:"client_info"`        // Client identification
	ProcessingMetrics *string    `json:"processing_metrics"` // Detailed metrics
	CreatedAt         time.Time  `json:"created_at"`
}

type SystemMetric struct {
	ID         uuid.UUID  `json:"id"`
	MetricType string     `json:"metric_type"`
	NodeID     *uuid.UUID `json:"node_id"`
	Value      float64    `json:"value"`
	Timestamp  time.Time  `json:"timestamp"`
}

type Location struct {
	X float64 `json:"x" binding:"required"`
	Y float64 `json:"y" binding:"required"`
}

// Helper functions for working with JSONB
func (r *RoutingRequest) ScanRequestData(value interface{}) error {
	if value == nil {
		r.RequestData = nil
		return nil
	}

	switch v := value.(type) {
	case string:
		r.RequestData = &v
		return nil
	case []byte:
		s := string(v)
		r.RequestData = &s
		return nil
	default:
		return fmt.Errorf("cannot scan %T into string", value)
	}
}

func (r *RoutingRequest) ScanResponseData(value interface{}) error {
	if value == nil {
		r.ResponseData = nil
		return nil
	}

	switch v := value.(type) {
	case string:
		r.ResponseData = &v
		return nil
	case []byte:
		s := string(v)
		r.ResponseData = &s
		return nil
	default:
		return fmt.Errorf("cannot scan %T into string", value)
	}
}

func (r *RoutingRequest) ScanMetadata(value interface{}) error {
	if value == nil {
		r.Metadata = nil
		return nil
	}

	switch v := value.(type) {
	case string:
		r.Metadata = &v
		return nil
	case []byte:
		s := string(v)
		r.Metadata = &s
		return nil
	default:
		return fmt.Errorf("cannot scan %T into string", value)
	}
}

func (r *RoutingRequest) ScanClientInfo(value interface{}) error {
	if value == nil {
		r.ClientInfo = nil
		return nil
	}

	switch v := value.(type) {
	case string:
		r.ClientInfo = &v
		return nil
	case []byte:
		s := string(v)
		r.ClientInfo = &s
		return nil
	default:
		return fmt.Errorf("cannot scan %T into string", value)
	}
}

func (r *RoutingRequest) ScanProcessingMetrics(value interface{}) error {
	if value == nil {
		r.ProcessingMetrics = nil
		return nil
	}

	switch v := value.(type) {
	case string:
		r.ProcessingMetrics = &v
		return nil
	case []byte:
		s := string(v)
		r.ProcessingMetrics = &s
		return nil
	default:
		return fmt.Errorf("cannot scan %T into string", value)
	}
}
