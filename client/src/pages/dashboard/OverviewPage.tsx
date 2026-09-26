import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { alertApi } from '../../services/alertApi';
import { Card, CardContent } from '../../components/ui/Card';
import { StarRating } from '../../components/ui/StarRating';
import { Badge } from '../../components/ui/Badge';
import { TrendingUp, Users, MessageSquare, ArrowRight, AlertTriangle, TrendingDown, Frown, Bell, Star } from 'lucide-react';

const alertTypeMeta: Record<string, { icon: any; color: string }> = {
  LOW_RATING: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  RATING_DROP: { icon: TrendingDown, color: 'text-orange-600 bg-orange-50' },
  NEGATIVE_SENTIMENT: { icon: Frown, color: 'text-purple-600 bg-purple-50' },
};

export function OverviewPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';

  const { data: analytics } = useQuery({
    queryKey: ['analytics', businessId, '30d'],
    queryFn: () => businessApi.getAnalytics(businessId, '30d'),
    enabled: !!businessId,
  });

  const { data: feedbackResult } = useQuery({
    queryKey: ['feedback', businessId, 1],
    queryFn: () => businessApi.getFeedback(businessId, { page: 1, pageSize: 5 }),
    enabled: !!businessId,
  });

  const { data: alertsResult } = useQuery({
    queryKey: ['alerts', businessId, 'overview'],
    queryFn: () => alertApi.getAlerts(businessId, { page: 1 }).then(r => r.data),
    enabled: !!businessId,
  });

  const feedback = analytics?.feedback;
  const funnel = analytics?.funnel;
  const recentFeedback = feedbackResult?.data || [];
  const recentAlerts = (alertsResult?.data || []).slice(0, 3);
  const unreadAlertCount = alertsResult?.unreadCount || 0;

  const stats = [
    { label: 'QR Feedbacks', value: feedback?.sources?.appFeedback || 0, icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
    { label: 'Average Rating', value: feedback?.averageRating?.toFixed(1) || '0.0', icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
    { label: 'Google Reviews', value: funnel?.googleReviewCount || 0, icon: Star, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Sessions Started', value: funnel?.sessionsStarted || 0, icon: Users, color: 'text-green-600 bg-green-50' },
    { label: 'Google Redirects', value: funnel?.googleRedirects || funnel?.googleHandoffs || 0, icon: ArrowRight, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Last 30 days overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(stat => (
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

      {/* Sentiment */}
      {feedback && feedback.totalFeedback > 0 && (
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-3">Sentiment Breakdown</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600">Positive</span>
                  <span>{feedback.sentiment?.positive || 0}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${feedback.totalFeedback > 0 ? ((feedback.sentiment?.positive || 0) / feedback.totalFeedback * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Neutral</span>
                  <span>{feedback.sentiment?.neutral || 0}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 rounded-full"
                    style={{ width: `${feedback.totalFeedback > 0 ? ((feedback.sentiment?.neutral || 0) / feedback.totalFeedback * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600">Negative</span>
                  <span>{feedback.sentiment?.negative || 0}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${feedback.totalFeedback > 0 ? ((feedback.sentiment?.negative || 0) / feedback.totalFeedback * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel */}
      {funnel && (
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-3">Conversion Funnel</h3>
            <div className="space-y-2">
              {[
                { label: 'Sessions Started', value: funnel.sessionsStarted },
                { label: 'Ratings Selected', value: funnel.ratingsCompleted },
                { label: 'Drafts Generated', value: funnel.draftsGenerated },
                { label: 'Drafts Selected', value: funnel.draftsSelected },
                { label: 'Google Redirects', value: funnel.googleRedirects || funnel.googleHandoffs },
              ].map((step, i, arr) => {
                const prev = i === 0 ? step.value : arr[i - 1].value;
                const rate = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
                const totalRate = funnel.sessionsStarted > 0 ? Math.round((step.value / funnel.sessionsStarted) * 100) : 0;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="w-40 text-sm text-gray-600">{step.label}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${totalRate}%` }}
                      />
                    </div>
                    <div className="w-16 text-sm text-right font-medium">{step.value}</div>
                    {i > 0 && (
                      <Badge variant={rate >= 70 ? 'success' : rate >= 40 ? 'warning' : 'danger'}>
                        {rate}%
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Reputation Alerts</h3>
              {unreadAlertCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                  {unreadAlertCount}
                </span>
              )}
            </div>
            <Link to="/dashboard/alerts" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View All Alerts <ArrowRight size={14} />
            </Link>
          </div>
          {recentAlerts.length === 0 ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Bell size={16} className="text-gray-400" /> No alerts right now — you're all caught up!
            </p>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((alert: any) => {
                const meta = alertTypeMeta[alert.type] || alertTypeMeta.LOW_RATING;
                const Icon = meta.icon;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${!alert.isRead ? 'bg-blue-50/60 border-l-4 border-l-blue-500' : 'bg-gray-50'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${meta.color}`}>
                      <Icon size={16} />
                    </div>
                    <p className="text-sm text-gray-700 flex-1 truncate">{alert.message}</p>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Feedback */}
      <Card>
        <CardContent>
          <h3 className="font-semibold mb-3">Recent Feedback</h3>
          {recentFeedback.length === 0 ? (
            <p className="text-gray-500 text-sm">No feedback yet. Share your QR code to get started!</p>
          ) : (
            <div className="space-y-3">
              {recentFeedback.map((fb: any) => (
                <div key={fb.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <StarRating value={Math.round(fb.averageRating)} readonly size="sm" />
                    <span className="text-sm text-gray-600 truncate max-w-[200px]">
                      {fb.comment || 'No comment'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
