import { StarRating } from '../../../components/ui/StarRating';
import { Button } from '../../../components/ui/Button';

interface Props {
  questions: Array<{ id: string; text: string; sortOrder: number }>;
  ratings: Record<string, number>;
  onSetRating: (questionId: string, rating: number) => void;
  onSubmit: () => void;
}

export function RatingPage({ questions, ratings, onSetRating, onSubmit }: Props) {
  const allRated = questions.every(q => ratings[q.id] > 0);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Rate Your Experience</h2>
      <p className="text-gray-500 text-sm mb-6">Tap the stars to rate each aspect</p>

      <div className="space-y-6">
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

      <Button
        onClick={onSubmit}
        disabled={!allRated}
        size="lg"
        className="w-full mt-8"
      >
        Continue
      </Button>
    </div>
  );
}
