# Admin UI Implementation Plan - Simplified

## Overview
This plan outlines a concise implementation of an admin UI for monitoring and managing the location-based supervisor system. Built with React, TypeScript, Zustand, TanStack Router, and TanStack Query.

## Tech Stack
- React 18 + TypeScript
- TanStack Router (routing)
- TanStack Query (server state)
- Zustand (client state)
- TailwindCSS (styling)
- Vite (build tool)

## Project Structure
```
admin-ui/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── index.ts
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── Dashboard/
│   │   │   ├── OverviewCards.tsx
│   │   │   └── MetricsChart.tsx
│   │   ├── Nodes/
│   │   │   ├── NodeList.tsx
│   │   │   ├── NodeCard.tsx
│   │   │   ├── NodeForm.tsx
│   │   │   └── NodeMap.tsx
│   │   └── Requests/
│   │       ├── RequestTable.tsx
│   │       └── RequestDetails.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Nodes.tsx
│   │   └── Requests.tsx
│   ├── stores/
│   │   ├── useNodeStore.ts
│   │   └── useUIStore.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── types/
│   │   ├── api.ts
│   │   └── ui.ts
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   └── useDebounce.ts
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── nodes.tsx
│   │   └── requests.tsx
│   └── lib/
│       └── utils.ts
```

## Phase 1: Core Types & API

### 1.1 Type Definitions
**src/types/api.ts:**
```typescript
export interface Node {
  id: string;
  name: string;
  location_x: number;
  location_y: number;
  endpoint: string;
  capacity: number;
  status: 'inactive' | 'active' | 'healthy' | 'unhealthy';
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
  status: 'pending' | 'routed' | 'failed' | 'completed';
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
  metric_type: 'cpu_usage' | 'memory_usage' | 'active_connections' | 'response_time';
  node_id?: string;
  value: number;
  timestamp: string;
}
```

### 1.2 API Client
**src/services/api.ts:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = {
  // Nodes
  getNodes: () => fetch(`${API_BASE}/admin/api/v1/nodes`).then(r => r.json()),
  createNode: (data: CreateNodeRequest) => 
    fetch(`${API_BASE}/admin/api/v1/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  updateNode: (id: string, data: UpdateNodeRequest) =>
    fetch(`${API_BASE}/admin/api/v1/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deleteNode: (id: string) =>
    fetch(`${API_BASE}/admin/api/v1/nodes/${id}`, { method: 'DELETE' }),

  // Dashboard
  getMetrics: () => fetch(`${API_BASE}/admin/api/v1/dashboard/metrics`).then(r => r.json()),
  getRequests: () => fetch(`${API_BASE}/admin/api/v1/requests`).then(r => r.json()),
  
  // Public
  getPublicNodes: () => fetch(`${API_BASE}/api/v1/nodes`).then(r => r.json()),
  simulateRoute: (data: { coordinates: { x: number; y: number } }) =>
    fetch(`${API_BASE}/api/v1/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
};
```

### 1.3 WebSocket Service
**src/services/websocket.ts:**
```typescript
type WebSocketMessage = {
  type: string;
  data: any;
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.listeners.get(message.type)?.forEach(cb => cb(message.data));
    };
  }

  subscribe(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(callback);
  }

  disconnect() {
    this.ws?.close();
  }
}
```

## Phase 2: State Management

### 2.1 Node Store
**src/stores/useNodeStore.ts:**
```typescript
import { create } from 'zustand';
import { Node, CreateNodeRequest, UpdateNodeRequest } from '../types/api';

interface NodeState {
  nodes: Node[];
  selectedNode: Node | null;
  loading: boolean;
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setSelectedNode: (node: Node | null) => void;
  setLoading: (loading: boolean) => void;
  createNode: (node: CreateNodeRequest) => Promise<void>;
  updateNode: (id: string, updates: UpdateNodeRequest) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  updateNodeFromWS: (data: Partial<Node>) => void;
}

export const useNodeStore = create<NodeState>((set, get) => ({
  nodes: [],
  selectedNode: null,
  loading: false,

  setNodes: (nodes) => set({ nodes }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setLoading: (loading) => set({ loading }),

  createNode: async (nodeData) => {
    set({ loading: true });
    try {
      const newNode = await api.createNode(nodeData);
      set(state => ({ 
        nodes: [...state.nodes, newNode], 
        loading: false 
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateNode: async (id, updates) => {
    set({ loading: true });
    try {
      const updatedNode = await api.updateNode(id, updates);
      set(state => ({
        nodes: state.nodes.map(node => 
          node.id === id ? updatedNode : node
        ),
        loading: false
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  deleteNode: async (id) => {
    set({ loading: true });
    try {
      await api.deleteNode(id);
      set(state => ({
        nodes: state.nodes.filter(node => node.id !== id),
        loading: false
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateNodeFromWS: (data) => {
    set(state => ({
      nodes: state.nodes.map(node => 
        node.id === data.id ? { ...node, ...data } : node
      )
    }));
  },
}));
```

### 2.2 UI Store
**src/stores/useUIStore.ts:**
```typescript
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  
  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',

  toggleSidebar: () => set(state => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),
  
  setTheme: (theme) => set({ theme }),
}));
```

## Phase 3: Core Components

### 3.1 UI Components
**src/components/ui/Card.tsx:**
```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold text-lg mb-2">{children}</div>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

**src/components/ui/Button.tsx:**
```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '' 
}: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

### 3.2 Layout Components
**src/components/Layout/Sidebar.tsx:**
```typescript
import { Link } from '@tanstack/react-router';
import { useUIStore } from '../../stores/useUIStore';

export function Sidebar() {
  const { sidebarOpen } = useUIStore();

  return (
    <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 text-white transition-all duration-300`}>
      <div className="p-4">
        <h1 className={`font-bold text-xl ${!sidebarOpen && 'text-center'}`}>
          {sidebarOpen ? 'Arx Admin' : 'A'}
        </h1>
      </div>
      
      <nav className="mt-8">
        <Link to="/" className="block px-4 py-2 hover:bg-gray-800">
          Dashboard
        </Link>
        <Link to="/nodes" className="block px-4 py-2 hover:bg-gray-800">
          Nodes
        </Link>
        <Link to="/requests" className="block px-4 py-2 hover:bg-gray-800">
          Requests
        </Link>
      </nav>
    </div>
  );
}
```

**src/components/Layout/Header.tsx:**
```typescript
import { useUIStore } from '../../stores/useUIStore';

export function Header() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="bg-white shadow-sm border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 rounded"
        >
          ☰
        </button>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Admin UI</span>
        </div>
      </div>
    </header>
  );
}
```

### 3.3 Dashboard Components
**src/components/Dashboard/OverviewCards.tsx:**
```typescript
import { Card, CardHeader, CardContent } from '../ui';
import { useNodeStore } from '../../stores/useNodeStore';

export function OverviewCards() {
  const { nodes } = useNodeStore();

  const stats = {
    total: nodes.length,
    healthy: nodes.filter(n => n.status === 'healthy').length,
    unhealthy: nodes.filter(n => n.status === 'unhealthy').length,
    totalConnections: nodes.reduce((sum, n) => sum + n.active_connections, 0),
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader>Total Nodes</CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Healthy Nodes</CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.healthy}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Unhealthy Nodes</CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.unhealthy}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Active Connections</CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalConnections}</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**src/components/Dashboard/MetricsChart.tsx:**
```typescript
import { Card, CardHeader, CardContent } from '../ui';
import { useNodeStore } from '../../stores/useNodeStore';

export function MetricsChart() {
  const { nodes } = useNodeStore();

  const chartData = nodes.map(node => ({
    name: node.name,
    cpu: node.cpu_usage,
    memory: node.memory_usage,
    connections: node.active_connections,
  }));

  return (
    <Card>
      <CardHeader>Node Performance</CardHeader>
      <CardContent>
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available
            </div>
          ) : (
            <div className="space-y-2">
              {chartData.map(item => (
                <div key={item.name} className="border-b pb-2">
                  <div className="font-medium">{item.name}</div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                    <span>CPU: {item.cpu}%</span>
                    <span>Memory: {item.memory}%</span>
                    <span>Connections: {item.connections}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.4 Node Components
**src/components/Nodes/NodeCard.tsx:**
```typescript
import { Node } from '../../types/api';
import { Card, CardHeader, CardContent, Button } from '../ui';
import { useNodeStore } from '../../stores/useNodeStore';

interface NodeCardProps {
  node: Node;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function NodeCard({ node, onEdit, onDelete }: NodeCardProps) {
  const { setSelectedNode } = useNodeStore();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">{node.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(node.status)}`}>
            {node.status}
          </span>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Location:</strong> ({node.location_x}, {node.location_y})
          </div>
          <div>
            <strong>Endpoint:</strong> {node.endpoint}
          </div>
          <div>
            <strong>Capacity:</strong> {node.active_connections}/{node.capacity}
          </div>
          <div>
            <strong>CPU Usage:</strong> {node.cpu_usage}%
          </div>
          <div>
            <strong>Memory Usage:</strong> {node.memory_usage}%
          </div>
          <div>
            <strong>Last Health Check:</strong> {node.last_health_check || 'Never'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**src/components/Nodes/NodeForm.tsx:**
```typescript
import { useState } from 'react';
import { CreateNodeRequest, UpdateNodeRequest } from '../../types/api';
import { Card, CardHeader, CardContent, Button } from '../ui';

interface NodeFormProps {
  node?: CreateNodeRequest | UpdateNodeRequest;
  onSubmit: (data: CreateNodeRequest | UpdateNodeRequest) => void;
  onCancel: () => void;
}

export function NodeForm({ node, onSubmit, onCancel }: NodeFormProps) {
  const [formData, setFormData] = useState({
    name: node?.name || '',
    location: node?.location || { x: 0, y: 0 },
    endpoint: node?.endpoint || '',
    capacity: node?.capacity || 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        {node ? 'Edit Node' : 'Create New Node'}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Location X</label>
              <input
                type="number"
                value={formData.location.x}
                onChange={(e) => setFormData({
                  ...formData,
                  location: { ...formData.location, x: parseFloat(e.target.value) }
                })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location Y</label>
              <input
                type="number"
                value={formData.location.y}
                onChange={(e) => setFormData({
                  ...formData,
                  location: { ...formData.location, y: parseFloat(e.target.value) }
                })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Endpoint URL</label>
            <input
              type="text"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="http://node-ip:port"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Capacity</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

## Phase 4: Pages & Routing

### 4.1 Root Layout
**src/routes/__root.tsx:**
```typescript
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { useUIStore } from '../stores/useUIStore';

export function RootComponent() {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className={`flex-1 flex flex-col ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 4.2 Dashboard Page
**src/routes/index.tsx:**
```typescript
import { createFileRoute } from '@tanstack/react-router';
import { OverviewCards } from '../components/Dashboard/OverviewCards';
import { MetricsChart } from '../components/Dashboard/MetricsChart';
import { useNodeStore } from '../stores/useNodeStore';
import { useWebSocket } from '../hooks/useWebSocket';

export const Route = createFileRoute('/')({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { setNodes, updateNodeFromWS } = useNodeStore();
  
  // WebSocket integration
  useWebSocket('ws://localhost:8080/admin/api/v1/realtime', (ws) => {
    ws.subscribe('node_health_updated', updateNodeFromWS);
    ws.subscribe('node_created', (node) => {
      setNodes([...useNodeStore.getState().nodes, node]);
    });
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <OverviewCards />
      <MetricsChart />
    </div>
  );
}
```

### 4.3 Nodes Page
**src/routes/nodes.tsx:**
```typescript
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { NodeCard } from '../components/Nodes/NodeCard';
import { NodeForm } from '../components/Nodes/NodeForm';
import { Button } from '../components/ui/Button';
import { useNodeStore } from '../stores/useNodeStore';
import { Node, CreateNodeRequest, UpdateNodeRequest } from '../types/api';

export const Route = createFileRoute('/nodes')({
  component: NodesComponent,
});

function NodesComponent() {
  const { nodes, createNode, updateNode, deleteNode } = useNodeStore();
  const [showForm, setShowForm] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  const handleCreate = async (data: CreateNodeRequest) => {
    try {
      await createNode(data);
      setShowForm(false);
    } catch (error) {
      console.error('Failed to create node:', error);
    }
  };

  const handleUpdate = async (data: UpdateNodeRequest) => {
    if (!editingNode) return;
    
    try {
      await updateNode(editingNode.id, data);
      setEditingNode(null);
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nodes</h1>
        <Button onClick={() => setShowForm(true)}>
          Add Node
        </Button>
      </div>

      {showForm && (
        <div className="mb-6">
          <NodeForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {editingNode && (
        <div className="mb-6">
          <NodeForm
            node={editingNode}
            onSubmit={handleUpdate}
            onCancel={() => setEditingNode(null)}
          />
        </div>
      )}

      <div>
        {nodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No nodes configured
          </div>
        ) : (
          nodes.map(node => (
            <NodeCard
              key={node.id}
              node={node}
              onEdit={() => setEditingNode(node)}
              onDelete={() => {
                if (confirm(`Delete ${node.name}?`)) {
                  deleteNode(node.id);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

### 4.4 Requests Page
**src/routes/requests.tsx:**
```typescript
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

export const Route = createFileRoute('/requests')({
  component: RequestsComponent,
});

function RequestsComponent() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Routing Requests</h1>
      <Card>
        <CardHeader>Recent Requests</CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Request tracking coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Phase 5: TanStack Query Integration

### 5.1 Query Provider
**src/integrations/tanstack-query/root-provider.tsx:**
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchInterval: 30 * 1000, // 30 seconds
    },
  },
});

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### 5.2 Update Root Layout
**src/routes/__root.tsx** (updated):
```typescript
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { useUIStore } from '../stores/useUIStore';
import { RootProvider } from '../integrations/tanstack-query/root-provider';

export function RootComponent() {
  const { sidebarOpen } = useUIStore();

  return (
    <RootProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className={`flex-1 flex flex-col ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </RootProvider>
  );
}
```

## Phase 6: Build & Deployment

### 6.1 Environment Variables
**.env:**
```env
VITE_API_URL=http://localhost:8080
```

### 6.2 Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=app /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 6.3 Nginx Configuration
**nginx.conf:**
```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        location /api/ {
            proxy_pass http://supervisor:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

## Implementation Timeline

**Day 1-2:** Setup project structure, types, and API client
**Day 3-4:** Build state management and WebSocket integration
**Day 5-7:** Create core UI components and layouts
**Day 8-10:** Implement pages and routing with TanStack
**Day 11-12:** Add charts, tables, and advanced features
**Day 13-14:** Testing, refinement, and deployment setup

## Key Features

✅ **Simple Dashboard**: Overview with key metrics  
✅ **Node Management**: CRUD operations with forms  
✅ **Real-time Updates**: WebSocket integration  
✅ **Modern Stack**: TanStack Router + Query + Zustand  
✅ **Responsive Design**: TailwindCSS mobile-first  
✅ **Production Ready**: Docker deployment  

This simplified approach focuses on essential functionality while maintaining clean architecture and modern React patterns.