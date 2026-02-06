import type { Node } from '../../types/api';
import { Card, CardHeader, CardContent, Button } from '../ui';
import { useNodeStore } from '../../stores/useNodeStore';
import { Edit, Trash2, MapPin, Server, Cpu, HardDrive, Users, Clock } from 'lucide-react';

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

  const getHealthIndicator = (status: string) => {
    switch (status) {
      case 'healthy': return '🟢';
      case 'unhealthy': return '🔴';
      case 'active': return '🟡';
      default: return '⚪';
    }
  };

  const handleCardClick = () => {
    setSelectedNode(node);
  };

  return (
    <Card className="mb-4 hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3" onClick={handleCardClick}>
          <div className="text-2xl">{getHealthIndicator(node.status)}</div>
          <div>
            <h3 className="font-semibold text-lg">{node.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}>
              {node.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Button variant="secondary" onClick={onEdit} className="p-2">
              <Edit size={16} />
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="p-2">
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gray-500" />
            <span className="font-medium">Location:</span>
            <span>({node.location_x}, {node.location_y})</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Server size={16} className="text-gray-500" />
            <span className="font-medium">Endpoint:</span>
            <span className="truncate">{node.endpoint}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-500" />
            <span className="font-medium">Capacity:</span>
            <span>{node.active_connections}/{node.capacity}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(node.active_connections / node.capacity) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-gray-500" />
            <span className="font-medium">CPU Usage:</span>
            <span>{node.cpu_usage}%</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
              <div 
                className={`${node.cpu_usage > 80 ? 'bg-red-600' : 'bg-green-600'} h-2 rounded-full`} 
                style={{ width: `${node.cpu_usage}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-gray-500" />
            <span className="font-medium">Memory Usage:</span>
            <span>{node.memory_usage}%</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
              <div 
                className={`${node.memory_usage > 80 ? 'bg-red-600' : 'bg-green-600'} h-2 rounded-full`} 
                style={{ width: `${node.memory_usage}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-500" />
            <span className="font-medium">Last Health Check:</span>
            <span className="text-gray-600">
              {node.last_health_check 
                ? new Date(node.last_health_check).toLocaleString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}