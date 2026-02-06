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
  
  setTheme: (theme: 'light' | 'dark') => set({ theme }),
}));