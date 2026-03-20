'use client';

import { Check } from 'lucide-react';

interface ImportProgressBarProps {
  currentStep: number;
  steps: Array<{ number: number; label: string }>;
}

export function ImportProgressBar({ currentStep, steps }: ImportProgressBarProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, idx) => {
        const isActive = s.number === currentStep;
        const isCompleted = s.number < currentStep;

        return (
          <div key={s.number} className="flex items-center">
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-espresso text-pearl'
                  : isCompleted
                    ? 'bg-terracotta text-pearl'
                    : 'border border-mist text-espresso'
              }`}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span>{s.number}</span>
              )}
              <span className="hidden sm:inline">· {s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className="h-0.5 w-8 bg-sand mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}
