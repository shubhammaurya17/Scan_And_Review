import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/adminApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Database, Bot, Link2, Server } from 'lucide-react';

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export function SystemHealthPage() {
  const { data: health, dataUpdatedAt } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => adminApi.getHealth().then(r => r.data.data),
    refetchInterval: 30000,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 text-sm">Live status of core platform services</p>
        </div>
        {dataUpdatedAt && (
          <span className="text-xs text-gray-400">Last refreshed: {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Database size={18} className="text-gray-500" />
              <h3 className="font-semibold">Database</h3>
            </div>
            <Badge variant={health?.database?.status === 'healthy' ? 'success' : 'danger'}>
              {health?.database?.status || 'unknown'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Bot size={18} className="text-gray-500" />
              <h3 className="font-semibold">AI Engine</h3>
            </div>
            <div className="text-sm space-y-1 text-gray-600">
              <p>Provider: <span className="font-medium">{health?.ai?.provider || '—'}</span></p>
              <p>Model: <span className="font-medium">{health?.ai?.model || '—'}</span></p>
              <p>Base URL: <span className="font-medium">{health?.ai?.baseUrl || '—'}</span></p>
            </div>
            <Badge variant={health?.ai?.ollamaAvailable ? 'success' : 'warning'}>
              {health?.ai?.ollamaAvailable ? 'Ollama Available' : 'Ollama Unavailable'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Link2 size={18} className="text-gray-500" />
              <h3 className="font-semibold">Google Integration</h3>
            </div>
            <Badge variant={health?.google?.configured ? 'success' : 'default'}>
              {health?.google?.configured ? 'Configured' : 'Not Configured'}
            </Badge>
            <p className="text-sm text-gray-600">Active connections: {health?.google?.activeConnections ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Server size={18} className="text-gray-500" />
              <h3 className="font-semibold">Server</h3>
            </div>
            <div className="text-sm space-y-1 text-gray-600">
              <p>Uptime: <span className="font-medium">{health?.server?.uptime ? formatUptime(health.server.uptime) : '—'}</span></p>
              <p>Node Version: <span className="font-medium">{health?.server?.nodeVersion || '—'}</span></p>
              <p>Environment: <span className="font-medium">{health?.server?.environment || '—'}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SystemHealthPage;
