import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';

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
            <h3 className="font-semibold mb-4">Rating Distribution</h3>
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
    </div>
  );
}
