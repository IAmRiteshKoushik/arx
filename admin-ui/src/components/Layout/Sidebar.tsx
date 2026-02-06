import { Link } from '@tanstack/react-router';
import { useUIStore } from '../../stores/useUIStore';
import { Home, Server, BarChart3, Menu, X } from 'lucide-react';

export function Sidebar() {
  const { sidebarOpen } = useUIStore();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => useUIStore.setState({ sidebarOpen: !sidebarOpen })}
        className="fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-md lg:hidden"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-0 lg:w-64'
      }`}>
        <div className="p-4 border-b border-gray-700">
          <h1 className="font-bold text-xl">Arx Admin</h1>
        </div>
        
        <nav className="mt-8 px-4">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg hover:bg-gray-800 transition-colors"
            activeProps={{
              className: 'flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors',
            }}
          >
            <Home size={20} />
            <span>Dashboard</span>
          </Link>
          
          <Link
            to="/nodes"
            className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg hover:bg-gray-800 transition-colors"
            activeProps={{
              className: 'flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors',
            }}
          >
            <Server size={20} />
            <span>Nodes</span>
          </Link>
          
          <Link
            to="/requests"
            className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg hover:bg-gray-800 transition-colors"
            activeProps={{
              className: 'flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors',
            }}
          >
            <BarChart3 size={20} />
            <span>Requests</span>
          </Link>
        </nav>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => useUIStore.setState({ sidebarOpen: false })}
        />
      )}
    </>
  );
}