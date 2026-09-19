import { useState } from 'react';
import { cn } from '../../lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  label?: string;
}

const sizes = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

const touchTargets = {
  sm: 'p-1',
  md: 'p-2',
  lg: 'p-2',
};

export function StarRating({ value, onChange, size = 'md', readonly = false, label }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="radiogroup"
      aria-label={label || 'Rating'}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={cn(
              touchTargets[size],
              'transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded',
              !readonly && 'cursor-pointer hover:scale-110 active:scale-95',
              readonly && 'cursor-default'
            )}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            onKeyDown={(e) => {
              if (readonly) return;
              if (e.key === 'ArrowRight' && star < 5) onChange?.(star + 1);
              if (e.key === 'ArrowLeft' && star > 1) onChange?.(star - 1);
            }}
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            tabIndex={star === value ? 0 : -1}
          >
            <svg
              viewBox="0 0 24 24"
              className={cn(
                sizes[size],
                'transition-colors',
                filled ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'
              )}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
