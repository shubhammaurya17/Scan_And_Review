import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { alertApi } from '../../services/alertApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AlertTriangle, TrendingDown, Frown, X, ChevronDown, ChevronUp, CheckCheck } from 'lucide-react';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'LOW_RATING', label: 'Low Rating' },
  { key: 'RATING_DROP', label: 'Rating Drop' },
  { key: 'NEGATIVE_SENTIMENT', label: 'Negative Sentiment' },
];

const typeMeta: Record<string, { icon: any; color: string; badge: 'danger' | 'warning' | 'info'; label: string }> = {
  LOW_RATING: { icon: AlertTriangle, color: 'text-red-600 bg-red-50', badge: 'danger', label: 'Low Rating' },
  RATING_DROP: { icon: TrendingDown, color: 'text-orange-600 bg-orange-50', badge: 'warning', label: 'Rating Drop' },
  NEGATIVE_SENTIMENT: { icon: Frown, color: 'text-purple-600 bg-purple-50', badge: 'info', label: 'Negative Sentiment' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function AlertsPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params: any = { page };
  if (filter === 'unread') params.unread = true;
  else if (filter !== 'all') params.type = filter;

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', businessId, filter, page],
    queryFn: () => alertApi.getAlerts(businessId, params).then(r => r.data),
    enabled: !!businessId,
  });

  const alerts = data?.data || [];
  const pagination = data?.pagination;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts', businessId] });
    queryClient.invalidateQueries({ queryKey: ['alerts-unread-count', businessId] });
  };

  const handleMarkRead = async (alertId: string) => {
    await alertApi.markRead(businessId, alertId);
    invalidate();
  };

  const handleMarkAllRead = async () => {
    await alertApi.markAllRead(businessId);
    invalidate();
  };

  const handleDelete = async (alertId: string) => {
    await alertApi.deleteAlert(businessId, alertId);
    invalidate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reputation Alerts</h1>
          <p className="text-gray-500 text-sm">Stay on top of rating drops and negative sentiment</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
          <CheckCheck size={16} className="mr-1.5" /> Mark All as Read
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f.key); setPage(1); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-gray-500 text-center py-8">No alerts found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert: any) => {
            const meta = typeMeta[alert.type] || typeMeta.LOW_RATING;
            const Icon = meta.icon;
            const isExpanded = expandedId === alert.id;
            return (
              <Card
                key={alert.id}
                className={
                  !alert.isRead
                    ? 'border-l-4 border-l-blue-500 bg-blue-50/40'
                    : ''
                }
              >
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex items-start gap-3 flex-1 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                    >
                      <div className={`p-2 rounded-lg ${meta.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={meta.badge}>{meta.label}</Badge>
                          {!alert.isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <p className="text-sm text-gray-800 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(alert.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!alert.isRead && (
                        <Button variant="ghost" size="sm" onClick={() => handleMarkRead(alert.id)}>
                          Mark as Read
                        </Button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                        className="p-2 text-gray-400 hover:text-gray-700"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        aria-label="Delete alert"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && alert.sourceData && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-gray-500 mb-2">Source Data</p>
                      <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(alert.sourceData, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default AlertsPage;
