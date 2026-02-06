import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { NodeList } from '@/components/Nodes/NodeList'
import { NodeForm } from '@/components/Nodes/NodeForm'
import { Button } from '@/components/ui/Button'
import { useNodeStore } from '@/stores/useNodeStore'
import type { Node, CreateNodeRequest, UpdateNodeRequest } from '@/types/api'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/nodes')({
  component: NodesComponent,
})

function NodesComponent() {
  const { nodes, createNode, updateNode, deleteNode, loading } = useNodeStore()
  const [showForm, setShowForm] = useState(false)
  const [editingNode, setEditingNode] = useState<Node | null>(null)

  const handleCreate = async (data: CreateNodeRequest) => {
    try {
      await createNode(data)
      setShowForm(false)
    } catch (error) {
      console.error('Failed to create node:', error)
      alert('Failed to create node. Please try again.')
    }
  }

  const handleUpdate = async (data: UpdateNodeRequest) => {
    if (!editingNode) return
    
    try {
      await updateNode(editingNode.id, data)
      setEditingNode(null)
    } catch (error) {
      console.error('Failed to update node:', error)
      alert('Failed to update node. Please try again.')
    }
  }

  const handleDelete = (node: Node) => {
    if (confirm(`Are you sure you want to delete "${node.name}"?`)) {
      deleteNode(node.id).catch(error => {
        console.error('Failed to delete node:', error)
        alert('Failed to delete node. Please try again.')
      })
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nodes</h1>
        <Button onClick={() => setShowForm(true)} disabled={loading}>
          <Plus size={20} className="mr-2" />
          Add Node
        </Button>
      </div>

      {showForm && (
        <div className="mb-6">
          <NodeForm
            onSubmit={(data: CreateNodeRequest) => handleCreate(data)}
            onCancel={() => setShowForm(false)}
            loading={loading}
          />
        </div>
      )}

      {editingNode && (
        <div className="mb-6">
          <NodeForm
            node={editingNode}
            onSubmit={handleUpdate}
            onCancel={() => setEditingNode(null)}
            loading={loading}
          />
        </div>
      )}

      <NodeList
        nodes={nodes}
        onEditNode={setEditingNode}
        onDeleteNode={handleDelete}
      />
    </div>
  )
}