import { Button } from '../../../components/ui/Button';
import { Star } from 'lucide-react';

interface Props {
  business: { name: string; description?: string; logoUrl?: string; isDemo?: boolean };
  onStart: () => void;
  isLoading: boolean;
}

export function WelcomePage({ business, onStart, isLoading }: Props) {
  return (
    <div className="text-center py-12">
      {business.isDemo && (
        <div className="mb-4 inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
          DEMO
        </div>
      )}

      <div className="mb-6">
        {business.logoUrl ? (
          <img src={business.logoUrl} alt={business.name} className="w-20 h-20 mx-auto rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
            <Star className="w-10 h-10 text-primary-600" />
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{business.name}</h1>
      {business.description && (
        <p className="text-gray-600 mb-8 text-sm">{business.description}</p>
      )}

      <p className="text-gray-500 mb-8">
        Tell us about your experience — it only takes 30 seconds!
      </p>

      <Button onClick={onStart} isLoading={isLoading} size="lg" className="w-full">
        Share Your Experience
      </Button>
    </div>
  );
}
