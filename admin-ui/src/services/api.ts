import type {
	CreateNodeRequest,
	UpdateNodeRequest,
	Node,
	DashboardMetrics,
	RoutingRequest,
} from "../types/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const api = {
	// Nodes
	getNodes: (): Promise<Node[]> =>
		fetch(`${API_BASE}/admin/api/v1/nodes`).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),

	createNode: (data: CreateNodeRequest): Promise<Node> =>
		fetch(`${API_BASE}/admin/api/v1/nodes`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),

	updateNode: (id: string, data: UpdateNodeRequest): Promise<Node> =>
		fetch(`${API_BASE}/admin/api/v1/nodes/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),

	deleteNode: (id: string): Promise<void> =>
		fetch(`${API_BASE}/admin/api/v1/nodes/${id}`, {
			method: "DELETE",
		}).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
		}),

	// Dashboard
	getMetrics: (): Promise<DashboardMetrics> =>
		fetch(`${API_BASE}/admin/api/v1/dashboard/metrics`).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),

	getRequests: (): Promise<RoutingRequest[]> =>
		fetch(`${API_BASE}/admin/api/v1/requests`).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),

	// Public
	getPublicNodes: (): Promise<Node[]> =>
		fetch(`${API_BASE}/api/v1/nodes`).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),

	simulateRoute: (data: { coordinates: { x: number; y: number } }) =>
		fetch(`${API_BASE}/api/v1/route`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}).then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		}),
};

