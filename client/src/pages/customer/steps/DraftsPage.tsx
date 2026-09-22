import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Edit3, Check, RefreshCw } from 'lucide-react';

const STYLE_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Balanced & Authentic',
  FRIENDLY: 'Warm & Natural',
  CONCISE: 'Short & Direct',
};

const STYLE_VARIANTS: Record<string, 'info' | 'success' | 'warning'> = {
  PROFESSIONAL: 'info',
  FRIENDLY: 'success',
  CONCISE: 'warning',
};

interface Props {
  drafts: Array<{ id: string; style: string; content: string }>;
  onSelectDraft: (draftId: string, editedText?: string) => void;
  onRetry?: () => void;
}

export function DraftsPage({ drafts, onSelectDraft, onRetry }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');

  const handleEdit = (draft: { id: string; content: string }) => {
    setEditingId(draft.id);
    setEditedText(draft.content);
  };

  const handleSelect = (draftId: string) => {
    if (editingId === draftId) {
      onSelectDraft(draftId, editedText);
    } else {
      onSelectDraft(draftId);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your Review</h2>
      <p className="text-gray-500 text-sm mb-6">Select a style that feels right, or edit to make it yours</p>

      {drafts.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-600 mb-4">We couldn't generate reviews right now. Please try again.</p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw size={16} className="mr-2" />
              Try Again
            </Button>
          )}
        </div>
      ) : (
      <div className="space-y-4">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="bg-white rounded-xl border-2 border-gray-200 p-4 transition-all hover:border-primary-300"
          >
            <div className="flex items-center justify-between mb-3">
              <Badge variant={STYLE_VARIANTS[draft.style] || 'default'}>
                {STYLE_LABELS[draft.style] || draft.style}
              </Badge>
              <button
                onClick={() => editingId === draft.id ? setEditingId(null) : handleEdit(draft)}
                className="text-gray-400 hover:text-primary-600 transition-colors p-1"
                aria-label="Edit draft"
              >
                <Edit3 size={16} />
              </button>
            </div>

            {editingId === draft.id ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={4}
              />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{draft.content}</p>
            )}

            <Button
              onClick={() => handleSelect(draft.id)}
              size="sm"
              className="w-full mt-3"
            >
              <Check size={16} className="mr-1" />
              Use This Review
            </Button>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
