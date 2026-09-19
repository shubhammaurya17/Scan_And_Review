import { CheckCircle } from 'lucide-react';

interface Props {
  businessName?: string;
}

export function ThankYouPage({ businessName }: Props) {
  return (
    <div className="text-center py-16">
      <div className="mb-6 flex justify-center">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
      <p className="text-gray-600 mb-2">
        Your feedback helps {businessName || 'this business'} improve.
      </p>
      <p className="text-gray-400 text-sm">
        You can close this page now.
      </p>
    </div>
  );
}
