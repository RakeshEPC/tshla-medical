import React, { useState } from 'react';

interface ExpandableEducationProps {
  title: string;
  icon?: string;
  summary: string;
  details: string;
  isDefaultOpen?: boolean;
  variant?: 'default' | 'info' | 'tip' | 'warning';
}

/**
 * Expandable educational panel with summary and detailed information
 * Users can click to expand/collapse for more details
 */
export default function ExpandableEducation({
  title,
  icon = '📚',
  summary,
  details,
  isDefaultOpen = false,
  variant = 'default'
}: ExpandableEducationProps) {
  const [isExpanded, setIsExpanded] = useState(isDefaultOpen);

  const variantStyles = {
    default: {
      container: 'bg-white border-gray-200',
      header: 'bg-gray-50',
      icon: 'text-gray-600',
      text: 'text-gray-800'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      header: 'bg-blue-100',
      icon: 'text-blue-600',
      text: 'text-blue-900'
    },
    tip: {
      container: 'bg-green-50 border-green-200',
      header: 'bg-green-100',
      icon: 'text-green-600',
      text: 'text-green-900'
    },
    warning: {
      container: 'bg-amber-50 border-amber-200',
      header: 'bg-amber-100',
      icon: 'text-amber-600',
      text: 'text-amber-900'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`border rounded-lg overflow-hidden ${styles.container}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${styles.header} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center space-x-3">
          <span className={`text-2xl ${styles.icon}`}>{icon}</span>
          <div className="text-left">
            <h4 className={`font-semibold ${styles.text}`}>{title}</h4>
            {!isExpanded && (
              <p className="text-sm text-gray-600 mt-1">{summary}</p>
            )}
          </div>
        </div>
        <div className={`flex items-center space-x-2 ${styles.text}`}>
          <span className="text-xs font-medium">
            {isExpanded ? 'Hide' : 'Learn More'}
          </span>
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{summary}</p>
          <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {details}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline expandable variant for smaller spaces
 */
interface InlineExpandableProps {
  trigger: string;
  content: string;
}

export function InlineExpandable({ trigger, content }: InlineExpandableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <span className="inline">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
      >
        {trigger}
      </button>
      {isExpanded && (
        <span className="block mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-700 leading-relaxed">
          {content}
        </span>
      )}
    </span>
  );
}

/**
 * Educational card with expandable sections
 */
interface EducationalCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function EducationalCard({
  title,
  icon = '💡',
  children,
  defaultExpanded = false
}: EducationalCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{icon}</span>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <svg
          className={`w-6 h-6 text-blue-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 py-4 bg-white border-t-2 border-blue-100">
          {children}
        </div>
      )}
    </div>
  );
}
