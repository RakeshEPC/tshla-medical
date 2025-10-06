import React, { useState } from 'react';
import { ConflictDetection } from '../types/context7.types';
import { getConflictSeverityColor, getConflictSeverityIcon } from '../utils/pumpConflicts.config';
import { pumpContext7Service } from '../services/pumpDriveContext7.service';

interface ConflictResolverProps {
  conflicts: ConflictDetection;
  onResolve: (conflictName: string, resolution: string) => void;
  onDismiss: () => void;
}

export function ConflictResolver({ conflicts, onResolve, onDismiss }: ConflictResolverProps) {
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  if (!conflicts.hasConflict || conflicts.conflicts.length === 0) {
    return null;
  }

  const currentConflict = conflicts.conflicts[currentConflictIndex];
  const isLastConflict = currentConflictIndex === conflicts.conflicts.length - 1;
  const hasResolution = resolutions[currentConflict.rule.name];

  const handleResolve = (resolution: string) => {
    const newResolutions = { ...resolutions, [currentConflict.rule.name]: resolution };
    setResolutions(newResolutions);

    // Save resolution to service
    pumpContext7Service.saveConflictResolution(
      currentConflict.rule.name,
      resolution,
      currentConflict.detectedFeatures[0],
      currentConflict.detectedFeatures[1] || ''
    );

    // Notify parent component
    onResolve(currentConflict.rule.name, resolution);

    // Move to next conflict or finish
    if (isLastConflict) {
      // All conflicts resolved
      setTimeout(() => onDismiss(), 1500);
    } else {
      setCurrentConflictIndex(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    if (isLastConflict) {
      onDismiss();
    } else {
      setCurrentConflictIndex(prev => prev + 1);
    }
  };

  const progressPercent = ((currentConflictIndex + 1) / conflicts.conflicts.length) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Conflicting Preferences Detected</h2>
              <p className="text-sm text-gray-600">
                We found {conflicts.conflicts.length} potential conflict{conflicts.conflicts.length > 1 ? 's' : ''} in your selections.
                Let's resolve them to get the best recommendation.
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {currentConflictIndex + 1} of {conflicts.conflicts.length}
            </span>
          </div>
        </div>

        {/* Conflict Content */}
        <div className="p-6">
          <div
            className={`p-5 rounded-xl border-2 mb-6 ${getConflictSeverityColor(currentConflict.rule.severity)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{getConflictSeverityIcon(currentConflict.rule.severity)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {currentConflict.rule.severity} Priority
                  </span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-xs capitalize">{currentConflict.rule.conflictType.replace(/_/g, ' ')}</span>
                </div>
                <h3 className="font-bold text-lg mb-2">{currentConflict.rule.message}</h3>
                <p className="text-sm mb-3">{currentConflict.rule.resolution}</p>

                {/* Detected Features */}
                <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                  <div className="text-xs font-semibold mb-1">Conflicting selections:</div>
                  <ul className="text-sm space-y-1">
                    {currentConflict.detectedFeatures.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-gray-600">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggestion */}
                {currentConflict.suggestion && (
                  <div className="flex items-start gap-2 bg-white bg-opacity-70 rounded-lg p-3">
                    <span className="text-lg">💡</span>
                    <div>
                      <div className="text-xs font-semibold mb-1">Recommendation:</div>
                      <p className="text-sm">{currentConflict.suggestion}</p>
                    </div>
                  </div>
                )}

                {/* Affected Pumps */}
                {currentConflict.rule.affectedPumps && currentConflict.rule.affectedPumps.length > 0 && (
                  <div className="mt-3 text-xs">
                    <span className="font-semibold">Affected pumps:</span>{' '}
                    {currentConflict.rule.affectedPumps.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 mb-3">How would you like to proceed?</h4>

            <button
              onClick={() => handleResolve('prioritize_first')}
              disabled={hasResolution}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                  ✅
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Prioritize: {currentConflict.detectedFeatures[0]}</div>
                  <div className="text-sm text-gray-600">This takes higher priority in recommendations</div>
                </div>
              </div>
            </button>

            {currentConflict.detectedFeatures[1] && (
              <button
                onClick={() => handleResolve('prioritize_second')}
                disabled={hasResolution}
                className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                    ✅
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Prioritize: {currentConflict.detectedFeatures[1]}</div>
                    <div className="text-sm text-gray-600">This takes higher priority in recommendations</div>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => handleResolve('balanced')}
              disabled={hasResolution}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">
                  ⚖️
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Find a Balance</div>
                  <div className="text-sm text-gray-600">Try to accommodate both preferences equally</div>
                </div>
              </div>
            </button>

            <button
              onClick={handleSkip}
              className="w-full p-3 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all text-center text-sm font-medium"
            >
              Skip This Conflict
            </button>
          </div>

          {/* Resolution Confirmation */}
          {hasResolution && (
            <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <span className="text-xl">✅</span>
                <span className="font-semibold">Resolution saved</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
