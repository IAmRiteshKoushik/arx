import { NodeCard } from './NodeCard';
import type { Node } from '../../types/api';

interface NodeListProps {
  nodes: Node[];
  onEditNode: (node: Node) => void;
  onDeleteNode: (node: Node) => void;
}

export function NodeList({ nodes, onEditNode, onDeleteNode }: NodeListProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <div className="text-6xl mb-4">🖥️</div>
          <h3 className="text-xl font-medium mb-2">No nodes configured</h3>
          <p>Add your first node to start managing your infrastructure</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {nodes.map(node => (
        <NodeCard
          key={node.id}
          node={node}
          onEdit={() => onEditNode(node)}
          onDelete={() => onDeleteNode(node)}
        />
      ))}
    </div>
  );
}