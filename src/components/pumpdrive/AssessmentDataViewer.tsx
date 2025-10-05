/**
 * Assessment Data Viewer Component
 * Displays full assessment details from database
 * Created: October 5, 2025
 */

import React from 'react';
import type { StoredAssessment } from '../../services/assessmentHistory.service';

interface AssessmentDataViewerProps {
  assessment: Partial<StoredAssessment>;
  showFullDetails?: boolean;
}

export const AssessmentDataViewer: React.FC<AssessmentDataViewerProps> = ({
  assessment,
  showFullDetails = true
}) => {
  if (!assessment) {
    return (
      <div className="text-gray-500 text-center py-8">
        No assessment data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Slider Values */}
      {assessment.sliderValues && Object.keys(assessment.sliderValues).length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🎚️</span> Your Lifestyle Preferences
          </h3>
          <div className="space-y-3">
            {Object.entries(assessment.sliderValues).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <div className="flex items-center">
                  <span className="text-sm font-bold text-blue-600 mr-2">
                    {value}/10
                  </span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(value as number / 10) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Features */}
      {assessment.selectedFeatures && assessment.selectedFeatures.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">⭐</span> Selected Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {assessment.selectedFeatures.map((feature: any, index: number) => (
              <div key={index} className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span className="text-sm text-gray-700">
                  {feature.name || feature.title || feature.id || feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personal Story */}
      {assessment.personalStory && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">💭</span> Your Story
          </h3>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 italic leading-relaxed">
              "{assessment.personalStory}"
            </p>
          </div>
        </div>
      )}

      {/* Challenges */}
      {assessment.challenges && showFullDetails && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">⚠️</span> Challenges
          </h3>
          <p className="text-gray-700">{assessment.challenges}</p>
        </div>
      )}

      {/* Priorities */}
      {assessment.priorities && showFullDetails && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🎯</span> Your Priorities
          </h3>
          <p className="text-gray-700">{assessment.priorities}</p>
        </div>
      )}

      {/* Clarifying Responses */}
      {assessment.clarifyingResponses && Object.keys(assessment.clarifyingResponses).length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">❓</span> Clarifying Questions & Answers
          </h3>
          <div className="space-y-4">
            {Object.entries(assessment.clarifyingResponses).map(([question, answer], index) => (
              <div key={index} className="border-l-4 border-purple-400 pl-4 py-2">
                <p className="text-sm font-medium text-gray-800 mb-1">
                  Q: {question}
                </p>
                <p className="text-sm text-gray-600 italic">
                  A: {answer as string}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendation Summary */}
      {assessment.aiRecommendation && showFullDetails && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 shadow-md border-2 border-green-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🤖</span> AI Recommendation
          </h3>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-bold text-gray-900">
                {assessment.aiRecommendation.topChoice?.name || 'Unknown'}
              </span>
              <span className="text-lg font-semibold text-green-600">
                {assessment.aiRecommendation.topChoice?.score || 0}% Match
              </span>
            </div>

            {assessment.aiRecommendation.topChoice?.reasons && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Why this pump:</p>
                <ul className="space-y-1">
                  {assessment.aiRecommendation.topChoice.reasons.map((reason, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {assessment.aiRecommendation.personalizedInsights && (
            <div className="mt-4 p-4 bg-white rounded border border-gray-200">
              <p className="text-sm text-gray-700 leading-relaxed">
                {assessment.aiRecommendation.personalizedInsights}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Assessment Metadata */}
      {showFullDetails && assessment.createdAt && (
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="font-medium">Assessment ID:</span> {assessment.id || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Created:</span>{' '}
              {new Date(assessment.createdAt).toLocaleString()}
            </div>
            {assessment.assessmentFlow && (
              <div>
                <span className="font-medium">Flow:</span>{' '}
                <span className="capitalize">{assessment.assessmentFlow}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentDataViewer;
