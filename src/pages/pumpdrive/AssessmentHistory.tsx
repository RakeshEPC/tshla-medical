/**
 * Assessment History Page
 * Shows all past assessments for the logged-in user
 * Allows comparison between assessments
 * Created: October 5, 2025
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessmentHistoryService, type AssessmentSummary } from '../../services/assessmentHistory.service';
import { pumpAuthService } from '../../services/pumpAuth.service';
import { logError, logInfo } from '../../services/logger.service';

export default function AssessmentHistory() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'timeline' | 'comparison'>('timeline');

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is logged in
      const currentUser = pumpAuthService.getUser();
      if (!currentUser) {
        setError('Please log in to view your assessment history');
        setLoading(false);
        return;
      }

      // Fetch assessments
      const data = await assessmentHistoryService.getCurrentUserAssessments();
      setAssessments(data);

      logInfo('AssessmentHistory', 'Loaded assessment history', {
        count: data.length
      });
    } catch (err) {
      logError('AssessmentHistory', 'Failed to load assessments', { error: err });
      setError('Failed to load assessment history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        // Limit to 3 assessments for comparison
        if (prev.length >= 3) {
          return [...prev.slice(1), id];
        }
        return [...prev, id];
      }
    });
  };

  const handleStartComparison = () => {
    if (selectedForComparison.length < 2) {
      alert('Please select at least 2 assessments to compare');
      return;
    }
    setViewMode('comparison');
  };

  const handleViewAssessment = (id: number) => {
    // Store the assessment ID and navigate to results page
    sessionStorage.setItem('pumpdrive_assessment_id', id.toString());
    navigate('/pumpdrive/results');
  };

  const handlePrintHistory = () => {
    window.print();
  };

  const handleNewAssessment = () => {
    navigate('/pumpdrive/unified');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Your History</h2>
            <p className="text-gray-600">
              Fetching your assessment history from the database...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate('/pumpdrive/login')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/pumpdrive')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">No Assessments Yet</h2>
            <p className="text-gray-600 mb-6">
              You haven't completed any pump assessments yet. Start your first one now!
            </p>
            <button
              onClick={handleNewAssessment}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              🚀 Start Your First Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📚 Your Assessment History
          </h1>
          <p className="text-gray-600">
            View and compare your past insulin pump assessments
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Assessments</p>
                <p className="text-3xl font-bold text-blue-600">{assessments.length}</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Most Recent</p>
                <p className="text-lg font-semibold text-gray-800">
                  {new Date(assessments[0]?.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-4xl">📅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Latest Recommendation</p>
                <p className="text-sm font-semibold text-green-600 truncate">
                  {assessments[0]?.recommendedPump || 'N/A'}
                </p>
              </div>
              <div className="text-4xl">💊</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-6 justify-between items-center">
          <div className="flex gap-3">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📅 Timeline View
            </button>
            <button
              onClick={handleStartComparison}
              disabled={selectedForComparison.length < 2}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedForComparison.length >= 2
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              🔄 Compare ({selectedForComparison.length})
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrintHistory}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              🖨️ Print History
            </button>
            <button
              onClick={handleNewAssessment}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              ➕ New Assessment
            </button>
          </div>
        </div>

        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Select 2-3 assessments using the checkboxes, then click "Compare" to see how your recommendations changed over time.
              </p>
            </div>

            {assessments.map((assessment, index) => (
              <div
                key={assessment.id}
                className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border-2 ${
                  selectedForComparison.includes(assessment.id)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-transparent'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Left: Checkbox and Assessment Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedForComparison.includes(assessment.id)}
                        onChange={() => toggleSelection(assessment.id)}
                        className="mt-1 h-5 w-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">
                            {index === 0 ? '🆕' : index === 1 ? '📌' : '📋'}
                          </span>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">
                              Assessment #{assessments.length - index}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {new Date(assessment.createdAt).toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="ml-11 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                              Recommended Pump:
                            </span>
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                              {assessment.recommendedPump}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                              Match Score:
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${assessment.score}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold text-blue-600">
                                {assessment.score}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                              Assessment Type:
                            </span>
                            <span className="text-sm text-gray-600 capitalize">
                              {assessment.assessmentFlow || 'Unified'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <div>
                      <button
                        onClick={() => handleViewAssessment(assessment.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        👁️ View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comparison View */}
        {viewMode === 'comparison' && selectedForComparison.length >= 2 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                📊 Comparing {selectedForComparison.length} Assessments
              </h2>
              <button
                onClick={() => setViewMode('timeline')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                ← Back to Timeline
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedForComparison.map(id => {
                const assessment = assessments.find(a => a.id === id);
                if (!assessment) return null;

                return (
                  <div key={id} className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Recommended Pump</p>
                          <p className="text-sm font-bold text-green-700">
                            {assessment.recommendedPump}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-600 mb-1">Match Score</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${assessment.score}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-blue-600">
                              {assessment.score}%
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-600 mb-1">Flow Type</p>
                          <p className="text-sm capitalize">{assessment.assessmentFlow}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewAssessment(assessment.id)}
                      className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Full Details
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">📈 Comparison Insights</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                {(() => {
                  const selected = assessments.filter(a => selectedForComparison.includes(a.id));
                  const pumps = selected.map(a => a.recommendedPump);
                  const allSame = pumps.every(p => p === pumps[0]);
                  const avgScore = Math.round(
                    selected.reduce((sum, a) => sum + a.score, 0) / selected.length
                  );

                  return (
                    <>
                      {allSame ? (
                        <li>✓ All assessments recommended the same pump: <strong>{pumps[0]}</strong></li>
                      ) : (
                        <li>⚠️ Different pumps were recommended across these assessments</li>
                      )}
                      <li>📊 Average match score: <strong>{avgScore}%</strong></li>
                      <li>📅 Time span: <strong>
                        {Math.round(
                          (new Date(selected[0].createdAt).getTime() -
                            new Date(selected[selected.length - 1].createdAt).getTime()) /
                          (1000 * 60 * 60 * 24)
                        )} days
                      </strong></li>
                    </>
                  );
                })()}
              </ul>
            </div>
          </div>
        )}

        {/* Back to Results Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/pumpdrive')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
