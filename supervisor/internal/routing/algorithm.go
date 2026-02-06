package routing

import (
	"math"
	"sort"

	"arx-supervisor/internal/models"
)

func CalculateDistance(x1, y1, x2, y2 float64) float64 {
	return math.Sqrt(math.Pow(x1-x2, 2) + math.Pow(y1-y2, 2))
}

func FindKNearestNodes(nodes []models.Node, x, y float64, k int) []models.Node {
	type NodeWithDistance struct {
		models.Node
		Distance float64
	}

	var nodesWithDistance []NodeWithDistance
	for _, node := range nodes {
		if node.Status == "healthy" {
			dist := CalculateDistance(x, y, node.LocationX, node.LocationY)
			nodesWithDistance = append(nodesWithDistance, NodeWithDistance{
				Node:     node,
				Distance: dist,
			})
		}
	}

	// Sort by distance
	sort.Slice(nodesWithDistance, func(i, j int) bool {
		return nodesWithDistance[i].Distance < nodesWithDistance[j].Distance
	})

	// Return k nearest
	result := make([]models.Node, 0, k)
	for i := 0; i < k && i < len(nodesWithDistance); i++ {
		result = append(result, nodesWithDistance[i].Node)
	}

	return result
}

func SelectBestNode(nodes []models.Node) models.Node {
	if len(nodes) == 0 {
		return models.Node{}
	}

	bestNode := nodes[0]
	bestScore := calculateLoadScore(bestNode)

	for _, node := range nodes[1:] {
		score := calculateLoadScore(node)
		if score < bestScore {
			bestNode = node
			bestScore = score
		}
	}

	return bestNode
}

func CalculateLoadScore(node models.Node) float64 {
	cpuWeight := 0.4
	memWeight := 0.3
	connWeight := 0.3

	cpuScore := node.CPUUsage / 100.0
	memScore := node.MemoryUsage / 100.0
	connScore := float64(node.ActiveConnections) / float64(node.Capacity)

	return cpuWeight*cpuScore + memWeight*memScore + connWeight*connScore
}

func calculateLoadScore(node models.Node) float64 {
	return CalculateLoadScore(node)
}
