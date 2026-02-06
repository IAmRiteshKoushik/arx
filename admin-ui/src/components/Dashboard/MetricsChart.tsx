import { Card, CardHeader, CardContent } from '../ui';
import { useNodeStore } from '../../stores/useNodeStore';
import { Cpu, HardDrive, Zap } from 'lucide-react';

export function MetricsChart() {
  const { nodes } = useNodeStore();

  const chartData = nodes.map(node => ({
    name: node.name,
    cpu: node.cpu_usage,
    memory: node.memory_usage,
    connections: node.active_connections,
    status: node.status,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'unhealthy': return 'text-red-600';
      case 'active': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>Node Performance Metrics</CardHeader>
      <CardContent>
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="mb-2">No nodes available</div>
                <div className="text-sm">Add nodes to see performance metrics</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {chartData.map(item => (
                <div key={item.name} className="border-b pb-3 last:border-b-0">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">{item.name}</h4>
                    <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span>CPU: {item.cpu}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-green-500" />
                      <span>Memory: {item.memory}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span>Connections: {item.connections}</span>
                    </div>
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