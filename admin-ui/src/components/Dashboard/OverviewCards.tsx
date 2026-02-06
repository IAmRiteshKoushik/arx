import { Card, CardContent } from '../ui';
import { useNodeStore } from '../../stores/useNodeStore';
import { Server, Activity, AlertCircle, Users } from 'lucide-react';

export function OverviewCards() {
  const { nodes } = useNodeStore();

  const stats = {
    total: nodes.length,
    healthy: nodes.filter(n => n.status === 'healthy').length,
    unhealthy: nodes.filter(n => n.status === 'unhealthy').length,
    totalConnections: nodes.reduce((sum, n) => sum + n.active_connections, 0),
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="flex items-center">
          <div className="p-3 bg-blue-100 rounded-lg mr-4">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Nodes</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center">
          <div className="p-3 bg-green-100 rounded-lg mr-4">
            <Activity className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Healthy Nodes</p>
            <p className="text-2xl font-bold text-green-600">{stats.healthy}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center">
          <div className="p-3 bg-red-100 rounded-lg mr-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Unhealthy Nodes</p>
            <p className="text-2xl font-bold text-red-600">{stats.unhealthy}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center">
          <div className="p-3 bg-purple-100 rounded-lg mr-4">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Active Connections</p>
            <p className="text-2xl font-bold">{stats.totalConnections}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}