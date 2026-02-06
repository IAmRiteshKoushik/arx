import { create } from 'zustand';
import type { Node, CreateNodeRequest, UpdateNodeRequest } from '../types/api';
import { api } from '../services/api';

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
  fetchNodes: () => Promise<void>;
}

export const useNodeStore = create<NodeState>((set) => ({
  nodes: [],
  selectedNode: null,
  loading: false,

  setNodes: (nodes: Node[]) => set({ nodes }),
  setSelectedNode: (node: Node | null) => set({ selectedNode: node }),
  setLoading: (loading: boolean) => set({ loading }),

  fetchNodes: async () => {
    set({ loading: true });
    try {
      const nodes = await api.getNodes();
      set({ nodes, loading: false });
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
      set({ loading: false });
    }
  },

  createNode: async (nodeData: CreateNodeRequest) => {
    set({ loading: true });
    try {
      const newNode = await api.createNode(nodeData);
      set(state => ({ 
        nodes: [...state.nodes, newNode], 
        loading: false 
      }));
    } catch (error) {
      console.error('Failed to create node:', error);
      set({ loading: false });
      throw error;
    }
  },

  updateNode: async (id: string, updates: UpdateNodeRequest) => {
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
      console.error('Failed to update node:', error);
      set({ loading: false });
      throw error;
    }
  },

  deleteNode: async (id: string) => {
    set({ loading: true });
    try {
      await api.deleteNode(id);
      set(state => ({
        nodes: state.nodes.filter(node => node.id !== id),
        loading: false
      }));
    } catch (error) {
      console.error('Failed to delete node:', error);
      set({ loading: false });
      throw error;
    }
  },

  updateNodeFromWS: (data: Partial<Node>) => {
    set(state => ({
      nodes: state.nodes.map(node => 
        node.id === data.id ? { ...node, ...data } : node
      )
    }));
  },
}));