import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/adminApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Building2, Users, Activity, FolderTree, Database, Bot, Link2 } from 'lucide-react';

export function AdminDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(r => r.data.data),
  });

  const { data: health } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => adminApi.getHealth().then(r => r.data.data),
  });

  const statCards = [
    { label: 'Total Businesses', value: stats?.businessCount ?? 0, icon: Building2, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Users', value: stats?.userCount ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Sessions', value: stats?.sessionCount ?? 0, icon: Activity, color: 'text-green-600 bg-green-50' },
    { label: 'Categories', value: stats?.categoryCount ?? 0, icon: FolderTree, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Platform-wide overview and system health</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <Card key={stat.label}>
            <CardContent className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent>
          <h3 className="font-semibold mb-4">System Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Database size={20} className="text-gray-500" />
              <div>
                <p className="text-sm font-medium">Database</p>
                <Badge variant={health?.database?.status === 'healthy' ? 'success' : 'danger'}>
                  {health?.database?.status || 'unknown'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Bot size={20} className="text-gray-500" />
              <div>
                <p className="text-sm font-medium">AI Engine ({health?.ai?.model || 'n/a'})</p>
                <Badge variant={health?.ai?.ollamaAvailable ? 'success' : 'warning'}>
                  {health?.ai?.ollamaAvailable ? 'Ollama Available' : 'Fallback Mode'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Link2 size={20} className="text-gray-500" />
              <div>
                <p className="text-sm font-medium">Google Integration</p>
                <Badge variant={health?.google?.configured ? 'success' : 'default'}>
                  {health?.google?.configured ? `Configured (${health.google.activeConnections} active)` : 'Not Configured'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminDashboardPage;
