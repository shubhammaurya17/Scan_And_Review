import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Smartphone, ClipboardPaste, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface HandoffOverlayProps {
  visible: boolean;
  onRedirect: () => void;
  onCancel: () => void;
  countdownSeconds?: number;
}

export function HandoffOverlay({
  visible,
  onRedirect,
  onCancel,
  countdownSeconds = 4,
}: HandoffOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(countdownSeconds);
  const [activeStep, setActiveStep] = useState(0);

  const handleRedirect = useCallback(() => {
    onRedirect();
  }, [onRedirect]);

  // Countdown timer
  useEffect(() => {
    if (!visible) {
      setTimeLeft(countdownSeconds);
      setActiveStep(0);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, countdownSeconds, handleRedirect]);

  // Step animation — cycle through steps as countdown progresses
  useEffect(() => {
    if (!visible) return;

    const stepTimers = [
      setTimeout(() => setActiveStep(1), 800),
      setTimeout(() => setActiveStep(2), 1800),
    ];

    return () => stepTimers.forEach(clearTimeout);
  }, [visible]);

  if (!visible) return null;

  const progress = ((countdownSeconds - timeLeft) / countdownSeconds) * 100;

  const steps = [
    {
      icon: <CheckCircle size={22} className="text-green-500" />,
      title: 'Review copied!',
      subtitle: 'Your review is on the clipboard',
      done: true,
    },
    {
      icon: <Smartphone size={22} className="text-primary-500" />,
      title: 'Opening Google Maps...',
      subtitle: 'You\'ll be redirected shortly',
      done: false,
    },
    {
      icon: <ClipboardPaste size={22} className="text-primary-600 animate-[pulseGentle_1.5s_ease-in-out_infinite]" />,
      title: 'Paste your review',
      subtitle: 'Long-press the text box → Paste',
      done: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center animate-[fadeIn_200ms_ease-out]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Card */}
      <div className="relative mx-4 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-[scaleIn_300ms_ease-out]">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-primary-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Cancel"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-6 pt-5">
          <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Almost there! 🎉</h3>
          <p className="text-xs text-gray-500 text-center mb-5">Here's what happens next</p>

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {steps.map((step, idx) => {
              const isActive = idx <= activeStep;
              const isCurrent = idx === activeStep;
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-500 ${
                    isCurrent
                      ? 'bg-primary-50 border border-primary-200 shadow-sm'
                      : isActive
                        ? 'bg-green-50/50 border border-transparent'
                        : 'opacity-40 border border-transparent'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {step.done && isActive ? (
                      <CheckCircle size={22} className="text-green-500" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.title}
                    </p>
                    <p className={`text-xs ${isActive ? 'text-gray-600' : 'text-gray-300'}`}>
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <Button onClick={handleRedirect} size="lg" className="w-full">
            <ArrowRight size={18} className="mr-2" />
            Go to Google Now
          </Button>
          <button
            onClick={onCancel}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Cancel — stay here
          </button>
        </div>
      </div>
    </div>
  );
}
