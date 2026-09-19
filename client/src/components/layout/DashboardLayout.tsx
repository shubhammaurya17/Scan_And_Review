import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { alertApi } from '../../services/alertApi';
import {
  LayoutDashboard, MessageSquare, Star, Bot, BarChart3,
  Bell, HelpCircle, QrCode, Link2, Settings, LogOut, Menu, X, Shield
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/dashboard/feedback', icon: MessageSquare, label: 'Feedback Inbox' },
  { to: '/dashboard/google-reviews', icon: Star, label: 'Google Reviews' },
  { to: '/dashboard/ai-replies', icon: Bot, label: 'AI Replies' },
  { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/dashboard/alerts', icon: Bell, label: 'Alerts' },
  { to: '/dashboard/questions', icon: HelpCircle, label: 'Questions' },
  { to: '/dashboard/qr-studio', icon: QrCode, label: 'QR Studio' },
  { to: '/dashboard/google-connection', icon: Link2, label: 'Google Connection' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export function DashboardLayout() {
  const { user, currentBusiness, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: unreadCount } = useQuery({
    queryKey: ['alerts-unread-count', currentBusiness?.id],
    queryFn: () => alertApi.getUnreadCount(currentBusiness!.id).then(r => r.data.data.count),
    enabled: !!currentBusiness?.id,
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="font-bold text-primary-600">ReputeAI</h1>
        <div className="w-10" />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b">
              <h1 className="text-xl font-bold text-primary-600">ReputeAI</h1>
              {currentBusiness && (
                <p className="text-sm text-gray-500 mt-1 truncate">
                  {currentBusiness.name}
                  {/* Demo badge */}
                </p>
              )}
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {item.label === 'Alerts' && !!unreadCount && unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t">
              {user?.role === 'ADMIN' && (
                <NavLink
                  to="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-3',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-indigo-600 hover:bg-indigo-50'
                  )}
                >
                  <Shield size={18} />
                  Admin Panel
                </NavLink>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">
                    {user?.name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full px-3 py-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen lg:min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
