import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Copy, ExternalLink, Check, CheckCircle, ClipboardPaste } from 'lucide-react';

interface Props {
  reviewText: string;
  googleReviewUrl: string;
  onHandoff: () => void;
}

export function HandoffPage({ reviewText, googleReviewUrl, onHandoff }: Props) {
  const [copied, setCopied] = useState(false);
  const hasGoogleUrl = !!googleReviewUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reviewText);
      setCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = reviewText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
    }
  };

  const handleOpenGoogle = () => {
    onHandoff();
    if (hasGoogleUrl) {
      window.open(googleReviewUrl, '_blank', 'noopener');
    }
  };

  const handleDone = () => {
    onHandoff();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Almost Done! 🎉</h2>
      <p className="text-gray-500 text-sm mb-4">
        Just 2 quick steps to post your review on Google
      </p>

      {/* Step-by-step instructions */}
      {hasGoogleUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3 mb-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${copied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
              {copied ? '✓' : '1'}
            </span>
            <p className={`text-sm ${copied ? 'text-green-700 font-medium' : 'text-blue-800 font-medium'}`}>
              {copied ? 'Review text copied! ✓' : 'Tap "Copy Review Text" below'}
            </p>
          </div>
          <div className="flex items-start gap-3 mb-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${copied ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
            <p className={`text-sm ${copied ? 'text-blue-800 font-medium' : 'text-gray-500'}`}>
              Tap "Continue to Google" to open the review page
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-bold">3</span>
            <p className="text-sm text-gray-500">
              On Google: select your stars, <strong>long-press the text box → Paste</strong>, then submit
            </p>
          </div>
        </div>
      )}

      {/* Review text preview */}
      <div className="bg-white rounded-xl border-2 border-primary-200 p-4 mb-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Your Review</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{reviewText}</p>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleCopy}
          variant={copied ? 'secondary' : 'outline'}
          size="lg"
          className="w-full"
        >
          {copied ? (
            <><Check size={18} className="mr-2" /> Copied to Clipboard!</>
          ) : (
            <><Copy size={18} className="mr-2" /> Step 1: Copy Review Text</>
          )}
        </Button>

        {hasGoogleUrl ? (
          <Button
            onClick={handleOpenGoogle}
            size="lg"
            className={`w-full ${!copied ? 'opacity-50' : ''}`}
            disabled={!copied}
          >
            <ExternalLink size={18} className="mr-2" />
            Step 2: Continue to Google
          </Button>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-sm text-amber-700">
                No Google review page is configured for this business yet.
                You can paste your review on Google manually.
              </p>
            </div>
            <Button onClick={handleDone} variant="outline" size="lg" className="w-full">
              <CheckCircle size={18} className="mr-2" />
              Done
            </Button>
          </>
        )}
      </div>

      {/* Paste reminder */}
      {hasGoogleUrl && copied && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <ClipboardPaste size={16} className="inline mr-1 text-green-600" />
          <span className="text-sm text-green-700 font-medium">
            Remember: long-press the text box on Google and tap "Paste"
          </span>
        </div>
      )}
    </div>
  );
}
