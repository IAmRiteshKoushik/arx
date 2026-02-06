import { useState } from 'react';
import type { CreateNodeRequest, UpdateNodeRequest } from '../../types/api';
import { Card, CardHeader, CardContent, Button, Input } from '../ui';
import type { Node } from '../../types/api';

interface NodeFormProps {
  node?: Node | CreateNodeRequest | UpdateNodeRequest;
  onSubmit: (data: any) => void; // Allow any data type for flexibility
  onCancel: () => void;
  loading?: boolean;
}

export function NodeForm({ node, onSubmit, onCancel, loading = false }: NodeFormProps) {
  const [formData, setFormData] = useState({
    name: (node as any)?.name || '',
    location: (node as any)?.location || { x: 0, y: 0 },
    endpoint: (node as any)?.endpoint || '',
    capacity: (node as any)?.capacity || 100,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.endpoint.trim()) {
      newErrors.endpoint = 'Endpoint is required';
    }
    
    if (formData.capacity <= 0) {
      newErrors.capacity = 'Capacity must be greater than 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        {node ? 'Edit Node' : 'Create New Node'}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Node name"
            error={errors.name}
            disabled={loading}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Location X"
              type="number"
              value={formData.location.x}
              onChange={(e) => setFormData({
                ...formData,
                location: { ...formData.location, x: parseFloat(e.target.value) || 0 }
              })}
              placeholder="X coordinate"
              disabled={loading}
            />
            <Input
              label="Location Y"
              type="number"
              value={formData.location.y}
              onChange={(e) => setFormData({
                ...formData,
                location: { ...formData.location, y: parseFloat(e.target.value) || 0 }
              })}
              placeholder="Y coordinate"
              disabled={loading}
            />
          </div>

          <Input
            label="Endpoint URL"
            value={formData.endpoint}
            onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
            placeholder="http://node-ip:port"
            error={errors.endpoint}
            disabled={loading}
          />

          <Input
            label="Capacity"
            type="number"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
            min="1"
            placeholder="Maximum connections"
            error={errors.capacity}
            disabled={loading}
          />

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}