import { useUIStore } from '../../stores/useUIStore';
import { Menu, Bell, Settings } from 'lucide-react';

export function Header() {
  const { sidebarOpen } = useUIStore();

  return (
    <header className="bg-white shadow-sm border-b px-4 py-3 lg:ml-64">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => useUIStore.setState({ sidebarOpen: !sidebarOpen })}
            className="p-2 hover:bg-gray-100 rounded hidden lg:block"
          >
            <Menu size={20} />
          </button>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Admin Panel</h2>
            <p className="text-sm text-gray-600">Location-based Supervisor System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded">
            <Settings size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
              A
            </div>
            <span className="hidden md:block text-sm font-medium">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}