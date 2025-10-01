import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sliderMCPService } from '../services/sliderMCP.service';

interface AssessmentData {
  sliderValues: Record<string, number>;
  selectedFeatures: any[];
  freeText: string;
  recommendation?: any;
}

const PumpDriveAssessmentResults: React.FC = () => {
  const navigate = useNavigate();
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const handleRetakeAssessment = () => {
    console.log('🔄 User clicked retake assessment - clearing all cache...');
    
    // Clear all cached recommendations and session data for fresh assessment
    sliderMCPService.clearAllCache();
    
    // Navigate back to fresh assessment
    navigate('/pumpdrive/unified');
  };

  useEffect(() => {
    loadAssessmentData();
  }, []);

  const loadAssessmentData = async () => {
    try {
      console.log('📋 Loading assessment data...');

      // Load slider data
      const savedSliders = sessionStorage.getItem('pumpDriveSliders');
      const sliderValues = savedSliders ? JSON.parse(savedSliders) : {};

      // Load feature data
      const savedFeatures = sessionStorage.getItem('pumpDriveSelectedFeatures');
      const selectedFeatures = savedFeatures ? JSON.parse(savedFeatures) : [];

      // Load free text data
      const savedText = sessionStorage.getItem('pumpDriveFreeText');
      const freeTextData = savedText ? JSON.parse(savedText) : {};
      const freeText = freeTextData.currentSituation || '';

      console.log('🔍 Loaded data:', {
        sliderValues,
        selectedFeatures,
        freeText
      });

      const data: AssessmentData = {
        sliderValues,
        selectedFeatures,
        freeText
      };

      setAssessmentData(data);

      // Generate AI recommendation if we have data
      if (Object.keys(sliderValues).length > 0) {
        console.log('🤖 Generating AI recommendation...');
        const recommendation = await sliderMCPService.generateRecommendation(sliderValues, selectedFeatures);
        data.recommendation = recommendation;
        setAssessmentData({ ...data });
      }

    } catch (error) {
      console.error('❌ Error loading assessment data:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSliderLabel = (key: string, value: number) => {
    const labels: Record<string, { name: string; emoji: string }> = {
      activity: { name: 'Activity Level', emoji: '🏃' },
      techComfort: { name: 'Technology Love', emoji: '📱' },
      simplicity: { name: 'Advanced Features', emoji: '🎛️' },
      discreteness: { name: 'Privacy Needs', emoji: '🤫' },
      timeDedication: { name: 'Time for Care', emoji: '⏰' }
    };

    const info = labels[key] || { name: key, emoji: '⚙️' };
    return { ...info, interpretation: getSliderInterpretation(key, value) };
  };

  const getSliderInterpretation = (key: string, value: number): string => {
    const interpretations: Record<string, Record<string, string>> = {
      activity: {
        low: 'Mostly sedentary, prefers comfort',
        medium: 'Moderately active lifestyle',
        high: 'Very active, always moving'
      },
      techComfort: {
        low: 'Prefers simple, basic technology',
        medium: 'Comfortable with everyday tech',
        high: 'Loves technology, early adopter'
      },
      simplicity: {
        low: 'Wants simple, straightforward devices',
        medium: 'Likes some features, not overwhelming',
        high: 'Enjoys advanced features and control'
      },
      discreteness: {
        low: 'Device must be completely hidden',
        medium: 'Prefers discreet but flexible',
        high: 'Function over appearance'
      },
      timeDedication: {
        low: 'Wants set-and-forget simplicity',
        medium: 'Willing to do basic maintenance',
        high: 'Happy to optimize for best results'
      }
    };

    const range = value <= 3 ? 'low' : value >= 7 ? 'high' : 'medium';
    return interpretations[key]?.[range] || `Score: ${value}/10`;
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Loading Your Assessment Results...
            </h1>
            <p className="text-gray-600">Gathering your preferences and generating recommendations</p>
          </div>
        </div>
      </div>
    );
  }

  if (!assessmentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold text-red-800 mb-4">
              ❌ No Assessment Data Found
            </h1>
            <p className="text-red-600 mb-8">
              Please complete the assessment first to see your results.
            </p>
            <button
              onClick={() => navigate('/pumpdrive/unified')}
              className="px-8 py-3 rounded-xl text-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            📊 Your Assessment Results
          </h1>
          <p className="text-xl text-gray-600">
            Here's exactly what you told us and how it influenced your recommendations
          </p>
          <div className="w-24 h-1 bg-blue-500 mx-auto mt-4 rounded"></div>
        </div>

        {/* Assessment Summary Stats */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{Object.keys(assessmentData.sliderValues).length}</div>
              <div className="text-blue-800 font-semibold">Lifestyle Preferences</div>
              <div className="text-sm text-blue-600">Slider responses</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{assessmentData.selectedFeatures.length}</div>
              <div className="text-green-800 font-semibold">Selected Features</div>
              <div className="text-sm text-green-600">Appealing pump features</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{assessmentData.freeText.length}</div>
              <div className="text-purple-800 font-semibold">Story Characters</div>
              <div className="text-sm text-purple-600">Personal context shared</div>
            </div>
          </div>
        </div>

        {/* Slider Preferences */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="text-3xl mr-3">🎚️</span>
            Your Lifestyle Preferences
          </h2>
          <div className="space-y-4">
            {Object.entries(assessmentData.sliderValues).map(([key, value]) => {
              const slider = getSliderLabel(key, value);
              return (
                <div key={key} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{slider.emoji}</span>
                      <span className="font-semibold text-gray-800">{slider.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{value}/10</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 ml-11">
                    {slider.interpretation}
                  </div>
                  <div className="mt-2 ml-11">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 h-2 rounded-full transition-all"
                        style={{ width: `${value * 10}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Features */}
        {assessmentData.selectedFeatures.length > 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="text-3xl mr-3">⭐</span>
              Features You Selected
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {assessmentData.selectedFeatures.map((feature, index) => (
                <div key={index} className="p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{feature.emoji}</span>
                    <div>
                      <div className="font-semibold text-gray-800">{feature.title}</div>
                      <div className="text-sm text-gray-600">{feature.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Story */}
        {assessmentData.freeText && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="text-3xl mr-3">💭</span>
              Your Personal Story
            </h2>
            <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-400">
              <blockquote className="text-lg text-gray-700 leading-relaxed italic">
                "{assessmentData.freeText}"
              </blockquote>
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {assessmentData.recommendation && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="text-3xl mr-3">🤖</span>
              AI Recommendations Based on Your Assessment
            </h2>
            <div className="space-y-6">
              {assessmentData.recommendation.recommendation.topPumps.map((pump: any, index: number) => (
                <div key={pump.pumpId} className="p-6 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{pump.pumpName}</h3>
                      <div className="text-lg text-gray-600">Match Score: {pump.score}%</div>
                    </div>
                    <div className="text-4xl">
                      {index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pump.matchFactors.map((factor: string, i: number) => (
                      <div key={i} className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-gray-700">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="text-center space-x-4">
          <button
            onClick={handleRetakeAssessment}
            className="px-8 py-3 rounded-xl text-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            ↩️ Retake Assessment
          </button>
          <button
            onClick={() => window.print()}
            className="px-8 py-3 rounded-xl text-lg font-semibold bg-green-600 text-white hover:bg-green-700 transition-all"
          >
            🖨️ Print Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default PumpDriveAssessmentResults;