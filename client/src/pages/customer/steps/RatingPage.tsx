import { StarRating } from '../../../components/ui/StarRating';
import { Button } from '../../../components/ui/Button';
import { Star } from 'lucide-react';

interface Props {
  business: { name: string; description?: string; logoUrl?: string; isDemo?: boolean };
  questions: Array<{ id: string; text: string; sortOrder: number }>;
  ratings: Record<string, number>;
  onSetRating: (questionId: string, rating: number) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function RatingPage({ business, questions, ratings, onSetRating, onSubmit, isLoading }: Props) {
  const allRated = questions.every(q => ratings[q.id] > 0);
  const avgRating = Object.values(ratings).length > 0
    ? Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length
    : 0;

  return (
    <div>
      {/* Business header */}
      <div className="text-center mb-6">
        {business.logoUrl ? (
          <img src={business.logoUrl} alt={business.name} className="w-16 h-16 mx-auto rounded-full object-cover mb-3" />
        ) : (
          <div className="w-16 h-16 mx-auto bg-primary-100 rounded-full flex items-center justify-center mb-3">
            <Star className="w-8 h-8 text-primary-600" />
          </div>
        )}
        <h1 className="text-lg font-bold text-gray-900">{business.name}</h1>
        {business.description && (
          <p className="text-gray-500 text-xs mt-1">{business.description}</p>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Rate Your Experience</h2>
      <p className="text-gray-500 text-sm mb-5">Tap the stars to rate each aspect</p>

      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">{q.text}</span>
              <span className="text-xs text-gray-400">{index + 1}/{questions.length}</span>
            </div>
            <div className="flex justify-center mt-3">
              <StarRating
                value={ratings[q.id] || 0}
                onChange={(rating) => onSetRating(q.id, rating)}
                size="lg"
                label={q.text}
              />
            </div>
            {ratings[q.id] > 0 && (
              <p className="text-center text-xs text-gray-400 mt-1">
                {ratings[q.id] === 5 ? 'Excellent!' : ratings[q.id] === 4 ? 'Great!' : ratings[q.id] === 3 ? 'Good' : ratings[q.id] === 2 ? 'Fair' : 'Poor'}
              </p>
            )}
          </div>
        ))}
      </div>

      {allRated && avgRating > 0 && (
        <div className="text-center mt-4">
          <span className="text-sm text-gray-500">Overall: </span>
          <span className="text-sm font-semibold text-primary-600">{avgRating.toFixed(1)}/5</span>
        </div>
      )}

      <Button
        onClick={onSubmit}
        disabled={!allRated}
        isLoading={isLoading}
        size="lg"
        className="w-full mt-6"
      >
        Generate My Review
      </Button>
    </div>
  );
}
