export interface Node {
	id: string;
	name: string;
	location_x: number;
	location_y: number;
	endpoint: string;
	capacity: number;
	status: "inactive" | "active" | "healthy" | "unhealthy";
	cpu_usage: number;
	memory_usage: number;
	active_connections: number;
	last_health_check?: string;
	created_at: string;
	updated_at: string;
}

export interface CreateNodeRequest {
	name: string;
	location: { x: number; y: number };
	endpoint: string;
	capacity?: number;
}

export interface UpdateNodeRequest {
	name?: string;
	location?: { x: number; y: number };
	endpoint?: string;
	capacity?: number;
	status?: string;
}

export interface RoutingRequest {
	id: string;
	request_id: string;
	coordinates_x: number;
	coordinates_y: number;
	selected_node_id?: string;
	distance?: number;
	load_score?: number;
	status: "pending" | "routed" | "failed" | "completed";
	response_time_ms?: number;
	created_at: string;
}

export interface DashboardMetrics {
	total_nodes: number;
	healthy_nodes: number;
	recent_requests: RoutingRequest[];
	system_metrics: SystemMetric[];
}

export interface SystemMetric {
	id: string;
	metric_type:
		| "cpu_usage"
		| "memory_usage"
		| "active_connections"
		| "response_time";
	node_id?: string;
	value: number;
	timestamp: string;
}

