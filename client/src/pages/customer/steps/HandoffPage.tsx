import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Copy, ExternalLink, Check, CheckCircle } from 'lucide-react';

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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = reviewText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <h2 className="text-xl font-bold text-gray-900 mb-2">Almost Done!</h2>
      <p className="text-gray-500 text-sm mb-6">
        {hasGoogleUrl
          ? 'Copy your review and paste it on Google'
          : 'Your review has been saved — copy it and paste on Google whenever ready'}
      </p>

      <div className="bg-white rounded-xl border-2 border-primary-200 p-4 mb-6">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{reviewText}</p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleCopy}
          variant={copied ? 'secondary' : 'outline'}
          size="lg"
          className="w-full"
        >
          {copied ? (
            <><Check size={18} className="mr-2" /> Copied!</>
          ) : (
            <><Copy size={18} className="mr-2" /> Copy Review Text</>
          )}
        </Button>

        {hasGoogleUrl ? (
          <Button onClick={handleOpenGoogle} size="lg" className="w-full">
            <ExternalLink size={18} className="mr-2" />
            Continue to Google
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

      {hasGoogleUrl && (
        <p className="text-xs text-gray-400 text-center mt-4">
          You'll paste your review on Google's review page
        </p>
      )}
    </div>
  );
}
