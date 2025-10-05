/**
 * @deprecated This component is DEPRECATED
 * Use PumpDriveUnified instead (src/pages/PumpDriveUnified.tsx)
 *
 * This slider-based assessment flow has been superseded by PumpDriveUnified,
 * which includes slider functionality plus additional features.
 *
 * Migration: Replace all references to PumpDriveSliders with PumpDriveUnified
 * See DEPRECATED.md for full migration guide
 *
 * This file will be moved to src/legacy/ in Phase 2 and removed in Phase 3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sliderMCPService } from '../services/sliderMCP.service';
import { type SliderAnalysis } from '../types/slider.types';
import { logWarn } from '../services/logger.service';

interface SliderData {
  id: string;
  title: string;
  emoji: string;
  examples: {
    low: string;
    medium: string;
    high: string;
  };
}

const SLIDERS: SliderData[] = [
  {
    id: 'activity',
    title: 'How Active Are You?',
    emoji: '🏃',
    examples: {
      low: '1: Mostly at desk, light walking, prefer comfort',
      medium: '5: Regular walks, some gym, weekend activities',
      high: '10: Daily workouts, sports, always on the move'
    }
  },
  {
    id: 'techComfort',
    title: 'How Much Do You Love Technology?',
    emoji: '📱',
    examples: {
      low: '1: Keep it simple, basic phone features only',
      medium: '5: Use apps daily, learn gradually, pretty comfortable',
      high: '10: Love new gadgets, early adopter, tech is exciting!'
    }
  },
  {
    id: 'simplicity',
    title: 'Do You Prefer Simple or Advanced?',
    emoji: '🎛️',
    examples: {
      low: '1: Keep it super simple, fewer buttons and options',
      medium: '5: Some features are nice, but not overwhelming',
      high: '10: Give me all the features, data, and control options'
    }
  },
  {
    id: 'discreteness',
    title: 'How Important is Hiding Your Device?',
    emoji: '🤫',
    examples: {
      low: '1: Must be completely hidden, nobody should notice',
      medium: '5: Prefer discreet but okay if sometimes visible',
      high: '10: Don\'t care who sees it, function over appearance'
    }
  },
  {
    id: 'timeDedication',
    title: 'How Much Time Can You Spend on Device Care?',
    emoji: '⏰',
    examples: {
      low: '1: Minimal time, want set-and-forget simplicity',
      medium: '5: A few minutes daily for basic maintenance',
      high: '10: Happy to spend time for optimal performance'
    }
  },
];

const PumpDriveSliders: React.FC = () => {
  const navigate = useNavigate();
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    activity: 5,
    techComfort: 5,
    simplicity: 5,
    discreteness: 5,
    timeDedication: 5
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [recommendation, setRecommendation] = useState<SliderAnalysis | null>(null);
  const [showResults, setShowResults] = useState(false);

  // ⚠️ DEPRECATION WARNING
  useEffect(() => {
    logWarn('⚠️ DEPRECATION WARNING: PumpDriveSliders is DEPRECATED');
    logWarn('Please use PumpDriveUnified instead (src/pages/PumpDriveUnified.tsx)');
    logWarn('This component will be moved to src/legacy/ and eventually removed');
    logWarn('See DEPRECATED.md for migration guide');
    console.warn('%c⚠️ DEPRECATED COMPONENT', 'color: orange; font-size: 16px; font-weight: bold');
    console.warn('%cPumpDriveSliders is deprecated. Use PumpDriveUnified instead.', 'color: orange');
    console.warn('See DEPRECATED.md for migration guide');
  }, []);

  const handleSliderChange = (sliderId: string, value: number) => {
    setSliderValues(prev => ({
      ...prev,
      [sliderId]: value
    }));
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    
    try {
      console.log('🎚️ Processing sliders with MCP service...');
      
      // Save profile and generate recommendation using MCP service
      const analysis = await sliderMCPService.generateRecommendation(sliderValues);
      
      console.log('✅ Recommendation generated:', analysis);
      
      setRecommendation(analysis);
      setShowResults(true);
      
      // Also save to session storage for backward compatibility
      sessionStorage.setItem('pumpDriveSliders', JSON.stringify(sliderValues));
      sessionStorage.setItem('sliderRecommendation', JSON.stringify(analysis));
      
    } catch (error) {
      console.error('❌ Error processing sliders:', error);
      alert('Error generating recommendation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = Object.keys(sliderValues).length === SLIDERS.length;

  if (showResults && recommendation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Results Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              🎯 Your Pump Recommendations
            </h1>
            <p className="text-xl text-gray-600">
              Based on your slider responses • {recommendation.source === 'cache' ? '⚡ Cached' : '🤖 AI Generated'} • {recommendation.processingTime}ms
            </p>
            <div className="w-24 h-1 bg-green-500 mx-auto mt-4 rounded"></div>
          </div>

          {/* Top Pumps */}
          <div className="space-y-6 mb-8">
            {recommendation.recommendation.topPumps.map((pump, index) => (
              <div key={pump.pumpId} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{pump.pumpName}</h2>
                    <div className="text-lg text-gray-600">Match Score: {pump.score}%</div>
                  </div>
                  <div className="text-4xl">
                    {index === 0 ? '🏆' : '🥈'}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">Why This Pump Matches You:</h3>
                    <ul className="space-y-2">
                      {pump.matchFactors.map((factor, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-green-500 mr-2">✓</span>
                          <span className="text-gray-600">{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">Slider Influence:</h3>
                    <div className="space-y-1 text-sm">
                      {Object.entries(pump.sliderInfluence).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize text-gray-600">{key}:</span>
                          <span className="font-semibold">{value}/10</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">💡 Personalized Insights</h2>
            <div className="space-y-3">
              {recommendation.recommendation.personalizedInsights.map((insight, index) => (
                <div key={index} className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">🔹</span>
                  <p className="text-gray-700">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🚀 Next Steps</h2>
            <div className="space-y-3">
              {recommendation.recommendation.nextSteps.map((step, index) => (
                <div key={index} className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-gray-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="text-center space-x-4">
            <button
              onClick={() => {setShowResults(false); setRecommendation(null);}}
              className="px-8 py-3 rounded-xl text-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
            >
              ↩️ Back to Sliders
            </button>
            <button
              onClick={() => navigate('/pumpdrive/free-text')}
              className="px-8 py-3 rounded-xl text-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
            >
              💭 Share Your Story
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🎚️ Personal Preference Assessment
          </h1>
          <p className="text-xl text-gray-600">
            Help us understand you better with these 5 essential questions
          </p>
          <div className="w-24 h-1 bg-blue-500 mx-auto mt-4 rounded"></div>
        </div>

        {/* Sliders */}
        <div className="space-y-8 mb-8">
          {SLIDERS.map((slider) => (
            <div key={slider.id} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              {/* Slider Title */}
              <div className="flex items-center mb-6">
                <span className="text-3xl mr-4">{slider.emoji}</span>
                <h2 className="text-2xl font-semibold text-gray-800">
                  {slider.title}
                </h2>
              </div>

              {/* Examples */}
              <div className="grid md:grid-cols-3 gap-4 mb-8 text-sm">
                <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
                  <div className="font-semibold text-red-700 mb-2">Low (1-3)</div>
                  <div className="text-red-600">{slider.examples.low}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                  <div className="font-semibold text-yellow-700 mb-2">Medium (4-7)</div>
                  <div className="text-yellow-600">{slider.examples.medium}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                  <div className="font-semibold text-green-700 mb-2">High (8-10)</div>
                  <div className="text-green-600">{slider.examples.high}</div>
                </div>
              </div>

              {/* Slider */}
              <div className="relative">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>1</span>
                  <span className="font-semibold text-lg text-gray-800">
                    Your Rating: {sliderValues[slider.id]}
                  </span>
                  <span>10</span>
                </div>
                
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={sliderValues[slider.id]}
                  onChange={(e) => handleSliderChange(slider.id, parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)`
                  }}
                />
                
                {/* Slider tick marks */}
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(num => (
                    <span key={num} className="w-1">{num}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="text-center">
          <button
            onClick={handleSubmit}
            disabled={!isComplete || isProcessing}
            className={`px-12 py-4 rounded-2xl text-xl font-semibold transition-all transform ${
              isComplete && !isProcessing
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                🤖 Generating Recommendations...
              </span>
            ) : isComplete ? (
              '🎯 Get My Pump Recommendations'
            ) : (
              '⏳ Complete All Sliders'
            )}
          </button>
          
          {isProcessing && (
            <div className="text-sm text-gray-500 mt-4">
              Using MCP cache and AI to find your perfect pump matches...
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="text-center mt-6">
          <div className="text-sm text-gray-500">
            Step 1 of 3: Personal Assessment  
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2 max-w-md mx-auto">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '33%' }}></div>
          </div>
          
          {/* Completion Stats */}
          <div className="text-xs text-gray-400 mt-2">
            {Object.keys(sliderValues).length}/5 questions answered
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 25px;
          width: 25px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          height: 25px;
          width: 25px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default PumpDriveSliders;