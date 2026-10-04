import { useEffect } from 'react';
import { ClipboardPaste } from 'lucide-react';

interface Props {
  googleReviewUrl: string | null;
}

export function PasteReminderPage({ googleReviewUrl }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (googleReviewUrl) {
        window.open(googleReviewUrl, '_blank', 'noopener');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [googleReviewUrl]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center animate-pulse">
          <ClipboardPaste size={36} className="text-primary-600" />
        </div>
      </div>

      <p className="text-base text-gray-500 mb-2">Review Copied!</p>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
        Paste your review in the text box
      </h2>
      <p className="text-sm text-gray-400">Redirecting you to Google...</p>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-6 overflow-hidden">
        <div
          className="h-full bg-primary-600 rounded-full"
          style={{
            animation: 'pasteProgress 2s linear forwards',
          }}
        />
      </div>

      <style>{`
        @keyframes pasteProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
