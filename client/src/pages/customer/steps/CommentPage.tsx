import { Button } from '../../../components/ui/Button';

interface Props {
  comment: string;
  onSetComment: (comment: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export function CommentPage({ comment, onSetComment, onSubmit, onSkip }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Anything else?</h2>
      <p className="text-gray-500 text-sm mb-6">Share any additional thoughts (optional)</p>

      <textarea
        value={comment}
        onChange={(e) => onSetComment(e.target.value)}
        placeholder="What stood out during your visit?"
        maxLength={500}
        rows={4}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
      <p className="text-xs text-gray-400 text-right mt-1">{comment.length}/500</p>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onSkip} size="lg" className="flex-1">
          Skip
        </Button>
        <Button onClick={onSubmit} size="lg" className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
