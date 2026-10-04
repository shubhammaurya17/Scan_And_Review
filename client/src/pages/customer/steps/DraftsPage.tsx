import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Edit3, Check, RefreshCw, Copy, ClipboardPaste } from 'lucide-react';

const STYLE_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Balanced & Authentic',
  FRIENDLY: 'Warm & Natural',
  HEARTFELT: 'Heartfelt & Personal',
};

const STYLE_VARIANTS: Record<string, 'info' | 'success' | 'warning'> = {
  PROFESSIONAL: 'info',
  FRIENDLY: 'success',
  HEARTFELT: 'warning',
};

interface Props {
  drafts: Array<{ id: string; style: string; content: string }>;
  googleReviewUrl: string | null;
  onSelectDraft: (draftId: string, editedText?: string) => void;
  onRetry?: () => void;
}

export function DraftsPage({ drafts, googleReviewUrl, onSelectDraft, onRetry }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEdit = (draft: { id: string; content: string }) => {
    setEditingId(draft.id);
    setEditedText(draft.content);
  };

  const handleSelect = (draftId: string) => {
    setSelectedId(draftId);
    setCopied(false);
    // Record the selection in the backend
    if (editingId === draftId) {
      onSelectDraft(draftId, editedText);
    } else {
      onSelectDraft(draftId);
    }
  };

  const getSelectedText = () => {
    if (!selectedId) return '';
    if (editingId === selectedId) return editedText;
    return drafts.find(d => d.id === selectedId)?.content || '';
  };

  const handleCopyAndContinue = async () => {
    const text = getSelectedText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);

    // Open Google Maps after a brief moment so user sees the "Copied" state
    if (googleReviewUrl) {
      setTimeout(() => {
        window.open(googleReviewUrl, '_blank', 'noopener');
      }, 400);
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
        {drafts.map((draft) => {
          const isSelected = selectedId === draft.id;
          return (
            <div
              key={draft.id}
              className={`bg-white rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? 'border-primary-500 shadow-md ring-2 ring-primary-200'
                  : selectedId && !isSelected
                    ? 'border-gray-200 opacity-[0.65]'
                    : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant={STYLE_VARIANTS[draft.style] || 'default'}>
                  {STYLE_LABELS[draft.style] || draft.style}
                </Badge>
                <div className="flex items-center gap-1">
                  {isSelected && (
                    <span className="text-xs text-primary-600 font-medium mr-1">Selected</span>
                  )}
                  <button
                    onClick={() => editingId === draft.id ? setEditingId(null) : handleEdit(draft)}
                    className="text-gray-400 hover:text-primary-600 transition-colors p-1"
                    aria-label="Edit draft"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
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

              {!isSelected && (
                <Button
                  onClick={() => handleSelect(draft.id)}
                  size="sm"
                  className="w-full mt-3"
                >
                  <Check size={16} className="mr-1" />
                  Use This Review
                </Button>
              )}
            </div>
          );
        })}

        {/* Copy & Continue — shown inline after selecting a draft */}
        {selectedId && (
          <div className="mt-2 space-y-3">
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center">
              {copied ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <ClipboardPaste size={18} />
                  <span className="text-sm font-medium">Copied! Opening Google Maps...</span>
                </div>
              ) : (
                <p className="text-sm text-primary-700">
                  Tap below to copy your review and open Google Maps
                </p>
              )}
            </div>

            <Button
              onClick={handleCopyAndContinue}
              size="lg"
              className="w-full"
              disabled={copied}
            >
              {copied ? (
                <><Check size={18} className="mr-2" /> Copied & Redirecting...</>
              ) : (
                <><Copy size={18} className="mr-2" /> Copy & Continue to Google</>
              )}
            </Button>

            {!googleReviewUrl && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-700">
                  No Google review page is configured. You can paste your review on Google manually.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
