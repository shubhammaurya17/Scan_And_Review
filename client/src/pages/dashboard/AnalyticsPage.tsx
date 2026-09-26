import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { Sparkles, Tag } from 'lucide-react';

export function AnalyticsPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const [period, setPeriod] = useState('30d');

  const { data: analytics } = useQuery({
    queryKey: ['analytics', businessId, period],
    queryFn: () => businessApi.getAnalytics(businessId, period),
    enabled: !!businessId,
  });

  const feedback = analytics?.feedback;
  const funnel = analytics?.funnel;
  const googleReviewTrend = analytics?.googleReviewTrend || [];

  const { data: feedbackList } = useQuery({
    queryKey: ['feedback-timeseries', businessId, period],
    queryFn: () => businessApi.getFeedback(businessId, { page: 1, pageSize: 100 }),
    enabled: !!businessId,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['ai-insights', businessId],
    queryFn: () => businessApi.getAIInsights(businessId),
    enabled: !!businessId,
  });

  const dailyStats = useMemo(() => {
    const items = feedbackList?.data || [];
    const grouped: Record<string, { total: number; count: number; feedbackCount: number }> = {};
    for (const fb of items) {
      const date = new Date(fb.createdAt).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { total: 0, count: 0, feedbackCount: 0 };
      grouped[date].feedbackCount++;
      if (fb.averageRating) {
        grouped[date].total += fb.averageRating;
        grouped[date].count++;
      }
    }
    // Merge Google review trend data
    for (const gr of googleReviewTrend) {
      if (!grouped[gr.date]) grouped[gr.date] = { total: 0, count: 0, feedbackCount: 0 };
      grouped[gr.date].feedbackCount += gr.feedbackCount;
      grouped[gr.date].total += gr.averageRating * gr.feedbackCount;
      grouped[gr.date].count += gr.feedbackCount;
    }
    return Object.entries(grouped)
      .map(([date, d]) => ({
        date,
        averageRating: d.count > 0 ? Math.round((d.total / d.count) * 10) / 10 : 0,
        feedbackCount: d.feedbackCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [feedbackList, googleReviewTrend]);

  const maxFeedbackCount = Math.max(1, ...dailyStats.map(d => d.feedbackCount));
  const topics: Record<string, number> = insights?.topics || {};
  const sortedTopics = Object.entries(topics).sort(([, a], [, b]) => (b as number) - (a as number));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm">Feedback and conversion insights</p>
        </div>
        <div className="flex gap-2">
          {['today', '7d', '30d'].map(p => (
            <Button
              key={p}
              variant={period === p ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Rating Distribution */}
      {feedback && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Rating Distribution</h3>
              {feedback.sources && (
                <span className="text-xs text-gray-400">
                  {feedback.sources.appFeedback} app feedback · {feedback.sources.googleReviews} Google reviews
                </span>
              )}
            </div>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map(rating => {
                const dist = feedback.ratingDistribution?.find((d: any) => d.rating === rating);
                const count = dist?.count || 0;
                const pct = dist?.percentage || 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="w-12 flex items-center gap-1">
                      <span className="text-sm font-medium">{rating}</span>
                      <StarRating value={1} readonly size="sm" />
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel */}
      {funnel && (
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Conversion Funnel</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Sessions', value: funnel.sessionsStarted },
                { label: 'Rated', value: funnel.ratingsCompleted },
                { label: 'Drafts', value: funnel.draftsGenerated },
                { label: 'Handoffs', value: funnel.googleHandoffs },
              ].map(step => (
                <div key={step.label} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-primary-600">{step.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{step.label}</p>
                </div>
              ))}
            </div>
            {funnel.sessionsStarted > 0 && (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Overall conversion: {Math.round((funnel.googleHandoffs / funnel.sessionsStarted) * 100)}% from session to Google handoff
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Time Series */}
      <Card>
        <CardContent>
          <h3 className="font-semibold mb-4">Daily Trend (Last 14 Days with Activity — App + Google)</h3>
          {dailyStats.length === 0 ? (
            <p className="text-gray-500 text-sm">Not enough data yet to show a trend.</p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {dailyStats.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{d.averageRating.toFixed(1)}★</span>
                  <div className="w-full flex-1 flex items-end bg-gray-50 rounded-t-md overflow-hidden">
                    <div
                      className="w-full bg-primary-500 rounded-t-md transition-all"
                      style={{ height: `${(d.feedbackCount / maxFeedbackCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{d.feedbackCount}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topics */}
      <Card>
        <CardContent>
          <h3 className="font-semibold mb-4">Detected Topics</h3>
          {sortedTopics.length === 0 ? (
            <p className="text-gray-500 text-sm">No topics detected yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sortedTopics.map(([topic, count]) => (
                <div key={topic} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Tag size={16} className="text-primary-500" />
                  <div>
                    <p className="text-sm font-medium capitalize">{topic}</p>
                    <p className="text-xs text-gray-500">{count as number}x mentioned</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-primary-500" />
            <h3 className="font-semibold">AI Insights</h3>
          </div>
          {insightsLoading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : !insights?.insights?.length ? (
            <p className="text-gray-500 text-sm">No insights available yet — check back once you have more feedback.</p>
          ) : (
            <ul className="space-y-2">
              {insights.insights.map((insight: string, i: number) => (
                <li key={i} className="text-sm text-gray-700 bg-primary-50 rounded-lg p-3">
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
