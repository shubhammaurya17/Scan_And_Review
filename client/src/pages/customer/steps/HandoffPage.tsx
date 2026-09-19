import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Copy, ExternalLink, Check } from 'lucide-react';

interface Props {
  reviewText: string;
  googleReviewUrl: string;
  onHandoff: () => void;
}

export function HandoffPage({ reviewText, googleReviewUrl, onHandoff }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reviewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
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
    if (googleReviewUrl) {
      window.open(googleReviewUrl, '_blank', 'noopener');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Almost Done!</h2>
      <p className="text-gray-500 text-sm mb-6">Copy your review and paste it on Google</p>

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

        <Button
          onClick={handleOpenGoogle}
          size="lg"
          className="w-full"
        >
          <ExternalLink size={18} className="mr-2" />
          Continue to Google
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        You'll paste your review on Google's review page
      </p>
    </div>
  );
}
