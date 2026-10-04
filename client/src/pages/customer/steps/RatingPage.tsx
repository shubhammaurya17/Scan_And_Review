import { StarRating } from '../../../components/ui/StarRating';
import { Button } from '../../../components/ui/Button';

interface Question {
  id: string;
  text: string;
  type: 'STAR_RATING' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT';
  options: string[] | null;
  placeholder: string | null;
  sortOrder: number;
}

interface Insight {
  id: string;
  label: string;
}

interface Props {
  business: { name: string; description?: string; logoUrl?: string; isDemo?: boolean };
  questions: Question[];
  responses: Record<string, { rating?: number; answer?: string }>;
  insights: Insight[];
  selectedInsights: string[];
  onSetResponse: (questionId: string, data: { rating?: number; answer?: string }) => void;
  onToggleInsight: (id: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function RatingPage({ business, questions, responses, insights, selectedInsights, onSetResponse, onToggleInsight, onSubmit, isLoading }: Props) {
  const questionsComplete = questions.every(q => {
    if (q.type === 'STAR_RATING') return (responses[q.id]?.rating ?? 0) > 0;
    if (q.type === 'SINGLE_CHOICE') return !!responses[q.id]?.answer;
    return true; // MULTI_CHOICE and TEXT are optional
  });

  const hasInsights = insights.length > 0;
  const insightsComplete = !hasInsights || selectedInsights.length >= 1;
  const isComplete = questionsComplete && insightsComplete;

  const starResponses = questions
    .filter(q => q.type === 'STAR_RATING')
    .map(q => responses[q.id]?.rating)
    .filter((r): r is number => r != null && r > 0);
  const avgRating = starResponses.length > 0
    ? starResponses.reduce((a, b) => a + b, 0) / starResponses.length
    : 0;

  return (
    <div>
      {/* Business header — compact, no icon */}
      <div className="text-center mb-5">
        <h1 className="text-lg font-bold text-gray-900">{business.name}</h1>
        {business.description && (
          <p className="text-gray-500 text-xs mt-0.5">{business.description}</p>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Share Your Feedback</h2>
      <p className="text-gray-500 text-sm mb-5">Help us understand your experience</p>

      <div className="space-y-3">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white rounded-xl p-3 shadow-sm border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-900">{q.text}</span>
              <span className="text-xs text-gray-400">{index + 1}/{questions.length}</span>
            </div>

            {q.type === 'STAR_RATING' && (
              <div className="flex justify-center mt-2">
                <StarRating
                  value={responses[q.id]?.rating || 0}
                  onChange={(rating) => onSetResponse(q.id, { rating })}
                  size="lg"
                  label={q.text}
                />
              </div>
            )}

            {q.type === 'STAR_RATING' && (responses[q.id]?.rating ?? 0) > 0 && (
              <p className="text-center text-xs text-gray-400 mt-1">
                {responses[q.id]?.rating === 5 ? 'Excellent!' : responses[q.id]?.rating === 4 ? 'Great!' : responses[q.id]?.rating === 3 ? 'Good' : responses[q.id]?.rating === 2 ? 'Fair' : 'Poor'}
              </p>
            )}

            {q.type === 'SINGLE_CHOICE' && q.options && (
              <div className="flex flex-wrap gap-2 mt-2">
                {q.options.map(opt => {
                  const selected = responses[q.id]?.answer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => onSetResponse(q.id, { answer: opt })}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        selected
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'MULTI_CHOICE' && q.options && (
              <div className="flex flex-wrap gap-2 mt-2">
                {q.options.map(opt => {
                  const currentAnswers: string[] = (() => {
                    try { return responses[q.id]?.answer ? JSON.parse(responses[q.id].answer!) : []; }
                    catch { return []; }
                  })();
                  const selected = currentAnswers.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        const updated = selected
                          ? currentAnswers.filter(a => a !== opt)
                          : [...currentAnswers, opt];
                        onSetResponse(q.id, { answer: updated.length > 0 ? JSON.stringify(updated) : undefined });
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        selected
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {selected && <span className="mr-1">&#10003;</span>}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'TEXT' && (
              <textarea
                value={responses[q.id]?.answer || ''}
                onChange={(e) => onSetResponse(q.id, { answer: e.target.value || undefined })}
                placeholder={q.placeholder || 'Share your thoughts...'}
                maxLength={500}
                rows={2}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
          </div>
        ))}
      </div>

      {/* Quick Insights section */}
      {hasInsights && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">What stood out to you?</h3>
          <p className="text-xs text-gray-500 mb-3">Select at least one that matches your experience</p>
          <div className="flex flex-wrap gap-2">
            {insights.map((insight) => {
              const isSelected = selectedInsights.includes(insight.id);
              return (
                <button
                  key={insight.id}
                  onClick={() => onToggleInsight(insight.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {isSelected && <span className="mr-1">&#10003;</span>}
                  {insight.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {questionsComplete && avgRating > 0 && (
        <div className="text-center mt-4">
          <span className="text-sm text-gray-500">Overall: </span>
          <span className="text-sm font-semibold text-primary-600">{avgRating.toFixed(1)}/5</span>
        </div>
      )}

      <Button
        onClick={onSubmit}
        disabled={!isComplete}
        isLoading={isLoading}
        size="lg"
        className="w-full mt-6"
      >
        Continue
      </Button>
    </div>
  );
}
