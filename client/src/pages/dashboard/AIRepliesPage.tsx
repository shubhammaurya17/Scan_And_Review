import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { googleApi } from '../../services/googleApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { Copy, Check, Bot } from 'lucide-react';

const TONES = ['Professional', 'Friendly', 'Grateful', 'Apologetic', 'Concise'];

export function AIRepliesPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const [reviewText, setReviewText] = useState('');
  const [tone, setTone] = useState('Professional');
  const [reply, setReply] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: reviewsData } = useQuery({
    queryKey: ['google-reviews-history', businessId],
    queryFn: () => googleApi.getReviews(businessId, 1).then(r => r.data),
    enabled: !!businessId,
  });

  const reviewsWithReplies = (reviewsData?.data || []).filter((r: any) => r.latestAIReply);

  const handleGenerate = async () => {
    if (!reviewText.trim()) return;
    setIsGenerating(true);
    try {
      const res = await googleApi.generateAIReply(businessId, reviewText, tone.toUpperCase());
      setReply(res.data.data.reply || '');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Replies</h1>
        <p className="text-gray-500 text-sm">Generate a reply to any review text using AI</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Text</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              placeholder="Paste a customer review here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
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
          </div>

          <Button variant="primary" size="sm" isLoading={isGenerating} disabled={!reviewText.trim()} onClick={handleGenerate}>
            <Bot size={16} className="mr-1.5" /> Generate Reply
          </Button>
        </CardContent>
      </Card>

      {reply && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Generated Reply</h3>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{reply}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="font-semibold mb-3">Recent AI Replies to Google Reviews</h3>
          {reviewsWithReplies.length === 0 ? (
            <p className="text-gray-500 text-sm">No AI-generated replies yet.</p>
          ) : (
            <div className="space-y-3">
              {reviewsWithReplies.map((review: any) => (
                <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{review.authorName}</span>
                    <StarRating value={review.rating} readonly size="sm" />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{review.comment}</p>
                  <p className="text-sm text-gray-700 border-t pt-2">{review.latestAIReply.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AIRepliesPage;
