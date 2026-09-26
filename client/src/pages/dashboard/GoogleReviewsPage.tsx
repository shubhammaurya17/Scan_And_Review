import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { googleApi } from '../../services/googleApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { Badge } from '../../components/ui/Badge';
import { Bot, Send, Save, Link2, Info } from 'lucide-react';

const TONES = ['Professional', 'Friendly', 'Grateful', 'Apologetic', 'Concise'];

export function GoogleReviewsPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [tone, setTone] = useState('Professional');
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const { data: statusData } = useQuery({
    queryKey: ['google-status', businessId],
    queryFn: () => googleApi.getConnectionStatus(businessId).then(r => r.data.data),
    enabled: !!businessId,
  });

  const canSync = statusData?.canSync && statusData?.hasPlaceId;
  const canPostReplies = statusData?.canPostReplies === true;

  // Load reviews if sync is available or if there might be existing reviews
  const { data, isLoading } = useQuery({
    queryKey: ['google-reviews', businessId, page],
    queryFn: () => googleApi.getReviews(businessId, page).then(r => r.data),
    enabled: !!businessId,
  });

  const reviews = data?.data || [];
  const pagination = data?.pagination;

  const openGenerator = (reviewId: string, existingReply?: string) => {
    setActiveReviewId(activeReviewId === reviewId ? null : reviewId);
    setDraft(existingReply || '');
    setTone('Professional');
  };

  const handleGenerate = async (reviewId: string) => {
    setIsGenerating(true);
    try {
      const res = await googleApi.generateReply(businessId, reviewId, tone.toUpperCase());
      setDraft(res.data.data.content || '');
    } catch {
      // no-op, keep draft as-is
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async (reviewId: string) => {
    setIsPosting(true);
    try {
      await googleApi.postReply(businessId, reviewId, draft);
      queryClient.invalidateQueries({ queryKey: ['google-reviews', businessId] });
      setActiveReviewId(null);
    } finally {
      setIsPosting(false);
    }
  };

  // Show setup prompt if sync is not available and no reviews exist
  if (!canSync && reviews.length === 0 && !isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Google Reviews</h1>
        <Card className="mt-6">
          <CardContent className="text-center py-10">
            <Link2 size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 mb-4">Set up your Google Place ID and sync to view reviews.</p>
            <Link to="/dashboard/google-connection">
              <Button variant="primary" size="sm">Go to Google Connection</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Reviews</h1>
        <p className="text-gray-500 text-sm">Reviews synced from your Google Business Profile</p>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <p className="text-gray-500">No reviews synced yet. Try syncing from the Google Connection page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review: any) => (
            <Card key={review.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{review.authorName}</span>
                      <StarRating value={review.rating} readonly size="sm" />
                    </div>
                    <p className="text-sm text-gray-700 mt-2">{review.comment || 'No comment'}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {review.publishedAt ? new Date(review.publishedAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <Badge variant={review.replyText ? 'success' : 'default'}>
                    {review.replyText ? 'Replied' : 'No Reply'}
                  </Badge>
                </div>

                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => openGenerator(review.id, review.replyText)}>
                    <Bot size={16} className="mr-1.5" /> Generate AI Reply
                  </Button>
                </div>

                {activeReviewId === review.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {TONES.map(t => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            tone === t
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={isGenerating}
                      onClick={() => handleGenerate(review.id)}
                    >
                      Generate Reply
                    </Button>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Generated reply will appear here — you can edit before posting"
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isPosting}
                        disabled={!draft.trim()}
                        onClick={() => handlePost(review.id)}
                      >
                        {canPostReplies ? (
                          <><Send size={16} className="mr-1.5" /> Post Reply</>
                        ) : (
                          <><Save size={16} className="mr-1.5" /> Save Reply</>
                        )}
                      </Button>
                      {!canPostReplies && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Info size={12} /> Reply saved locally — connect OAuth to post to Google
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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

export default GoogleReviewsPage;
