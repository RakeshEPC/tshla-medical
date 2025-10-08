import React, { useState } from 'react';

interface EducationalTooltipProps {
  term: string;
  definition: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Educational tooltip component for explaining terms and concepts
 * Shows on hover with detailed explanation
 */
export default function EducationalTooltip({
  term,
  definition,
  children,
  position = 'top'
}: EducationalTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800'
  };

  return (
    <span className="relative inline-block">
      <span
        className="border-b-2 border-dotted border-blue-400 cursor-help text-blue-600 font-medium"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        {children}
      </span>

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} w-72 pointer-events-none`}
        >
          <div className="bg-gray-800 text-white rounded-lg shadow-xl p-4">
            <div className="font-bold text-sm mb-1 text-blue-300">{term}</div>
            <div className="text-xs leading-relaxed">{definition}</div>
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
          />
        </div>
      )}
    </span>
  );
}

/**
 * Simpler inline help icon variant
 */
interface HelpIconProps {
  tooltip: string;
}

export function HelpIcon({ tooltip }: HelpIconProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      <button
        className="text-blue-500 hover:text-blue-700 cursor-help w-4 h-4 inline-flex items-center justify-center rounded-full bg-blue-100 text-xs font-bold"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        type="button"
      >
        ?
      </button>

      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 pointer-events-none">
          <div className="bg-gray-800 text-white rounded-lg shadow-xl p-3 text-xs leading-relaxed">
            {tooltip}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800" />
        </div>
      )}
    </span>
  );
}
