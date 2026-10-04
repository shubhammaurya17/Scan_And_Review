import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
  icon?: React.ReactNode;
}

export function Toast({ message, visible, onClose, duration = 3000, icon }: ToastProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLeaving(false);
    const fadeTimer = setTimeout(() => setLeaving(true), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border
          bg-green-50 border-green-200 text-green-800
          ${leaving ? 'animate-[slideUp_300ms_ease-in_forwards]' : 'animate-[slideDown_300ms_ease-out]'}`}
      >
        {icon || <CheckCircle size={18} className="text-green-600 flex-shrink-0" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-green-500 hover:text-green-700 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
