import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { StarRating } from '../../components/ui/StarRating';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function FeedbackInboxPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', businessId, page, ratingFilter],
    queryFn: () => businessApi.getFeedback(businessId, { page, pageSize: 20, rating: ratingFilter }),
    enabled: !!businessId,
  });

  const feedback = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback Inbox</h1>
        <p className="text-gray-500 text-sm">Customer feedback from your review flow</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={ratingFilter === undefined ? 'primary' : 'outline'}
          size="sm"
          onClick={() => { setRatingFilter(undefined); setPage(1); }}
        >
          All
        </Button>
        {[5, 4, 3, 2, 1].map(r => (
          <Button
            key={r}
            variant={ratingFilter === r ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setRatingFilter(r); setPage(1); }}
          >
            {r} ⭐
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : feedback.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-gray-500 text-center py-8">No feedback found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedback.map((fb: any) => (
            <Card key={fb.id}>
              <CardContent>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === fb.id ? null : fb.id)}
                >
                  <div className="flex items-center gap-4">
                    <StarRating value={Math.round(fb.averageRating)} readonly size="sm" />
                    <span className="text-sm font-medium">{fb.averageRating.toFixed(1)}</span>
                    <Badge variant={
                      fb.averageRating >= 4 ? 'success' : fb.averageRating >= 3 ? 'warning' : 'danger'
                    }>
                      {fb.averageRating >= 4 ? 'Positive' : fb.averageRating >= 3 ? 'Neutral' : 'Negative'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </span>
                    {expandedId === fb.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expandedId === fb.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {fb.ratings?.map((r: any) => (
                      <div key={r.question} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{r.question}</span>
                        <StarRating value={r.rating} readonly size="sm" />
                      </div>
                    ))}
                    {fb.comment && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 mb-1">Comment:</p>
                        <p className="text-sm text-gray-700">{fb.comment}</p>
                      </div>
                    )}
                    {fb.selectedDraft && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-600 mb-1">Selected Draft:</p>
                        <p className="text-sm text-gray-700">{fb.selectedDraft}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Status: {fb.status} | Session: {fb.sessionToken?.substring(0, 8)}...
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
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
