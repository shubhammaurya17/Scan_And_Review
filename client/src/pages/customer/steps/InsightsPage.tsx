import React from 'react';

interface InsightsPageProps {
  insights: Array<{ id: string; label: string }>;
  selectedInsights: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export default function InsightsPage({
  insights,
  selectedInsights,
  onToggle,
  onContinue,
  onSkip,
}: InsightsPageProps) {
  const hasSelections = selectedInsights.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          What stood out to you?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Tap any that apply — this is optional
        </p>
      </div>

      {/* Chips grid */}
      <div className="flex flex-wrap gap-2 justify-center">
        {insights.map((insight) => {
          const isSelected = selectedInsights.includes(insight.id);
          return (
            <button
              key={insight.id}
              onClick={() => onToggle(insight.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                isSelected
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
              }`}
            >
              {isSelected && (
                <span className="mr-1">&#10003;</span>
              )}
              {insight.label}
            </button>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        {!hasSelections && (
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Skip
          </button>
        )}
        <button
          onClick={onContinue}
          className={`${hasSelections ? 'w-full' : 'flex-1'} px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
