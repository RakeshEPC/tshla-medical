import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sliderMCPService } from '../services/sliderMCP.service';
import { freeTextMCPService } from '../services/freeTextMCP.service';
import { dtsqsService } from '../services/dtsqs.service';
import { logInfo, logWarn } from '../services/logger.service';
import { PUMP_FEATURES } from '../data/pumpFeatures';
import type { PumpFeature } from '../data/pumpFeatures';

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
  }
];

const FEATURE_CATEGORIES = [
  { id: 'power', name: 'Power & Charging', emoji: '🔋' },
  { id: 'design', name: 'Design & Size', emoji: '🎨' },
  { id: 'interface', name: 'Controls & Interface', emoji: '📱' },
  { id: 'convenience', name: 'Convenience Features', emoji: '✨' },
  { id: 'automation', name: 'Automation Level', emoji: '🤖' }
];

type AssessmentStep = 'sliders' | 'features' | 'story' | 'clarify' | 'results';

const PumpDriveUnified: React.FC = () => {
  const navigate = useNavigate();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<AssessmentStep>('sliders');
  const [completedSteps, setCompletedSteps] = useState<AssessmentStep[]>([]);
  
  // Slider data
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    activity: 5,
    techComfort: 5,
    simplicity: 5,
    discreteness: 5,
    timeDedication: 5
  });
  
  // Feature selection data
  const [selectedFeatures, setSelectedFeatures] = useState<PumpFeature[]>([]);
  
  // Free text data
  const [freeText, setFreeText] = useState('');
  const [charCount, setCharCount] = useState(0);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);

  // Clarifying questions state
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [clarifyingAnswers, setClarifyingAnswers] = useState<string[]>([]);
  
  // CHECK: DTSQs must be completed before accessing assessment
  useEffect(() => {
    const checkDTSQsCompletion = async () => {
      try {
        const completion = await dtsqsService.getDTSQsCompletion();
        if (!completion.completed) {
          logWarn('PumpDriveUnified', 'DTSQs not completed - redirecting', {});
          navigate('/pumpdrive/dtsqs');
        } else {
          logInfo('PumpDriveUnified', 'DTSQs completed - proceeding with assessment', {
            completedAt: completion.completedAt
          });
        }
      } catch (error) {
        logWarn('PumpDriveUnified', 'Error checking DTSQs completion', { error });
        // Don't block on error - they might be returning user
      }
    };

    checkDTSQsCompletion();
  }, [navigate]);

  // Load saved data on mount
  useEffect(() => {
    const completedStepsToAdd: AssessmentStep[] = [];

    // Load slider data
    const savedSliders = sessionStorage.getItem('pumpDriveSliders');
    if (savedSliders) {
      setSliderValues(JSON.parse(savedSliders));
      completedStepsToAdd.push('sliders');
    }

    // Load feature data
    const savedFeatures = sessionStorage.getItem('selectedPumpFeatures');
    if (savedFeatures) {
      setSelectedFeatures(JSON.parse(savedFeatures));
      completedStepsToAdd.push('features');
    }

    // Load free text data
    const savedText = sessionStorage.getItem('pumpDriveFreeText');
    if (savedText) {
      const textData = JSON.parse(savedText);
      setFreeText(textData.currentSituation || '');
      setCharCount(textData.currentSituation?.length || 0);
      completedStepsToAdd.push('story');
    }

    // Set all completed steps at once to avoid multiple state updates
    if (completedStepsToAdd.length > 0) {
      setCompletedSteps(completedStepsToAdd);
    }
  }, []);

  const handleSliderChange = (sliderId: string, value: number) => {
    setSliderValues(prev => ({
      ...prev,
      [sliderId]: value
    }));
  };

  const completeSliders = () => {
    sessionStorage.setItem('pumpDriveSliders', JSON.stringify(sliderValues));
    if (!completedSteps.includes('sliders')) {
      setCompletedSteps(prev => [...prev, 'sliders']);
    }
    setCurrentStep('features');
  };

  const toggleFeature = (feature: PumpFeature) => {
    setSelectedFeatures(prev => {
      const isSelected = prev.find(f => f.id === feature.id);
      if (isSelected) {
        return prev.filter(f => f.id !== feature.id);
      } else {
        return [...prev, feature];
      }
    });
  };

  const completeFeatures = () => {
    sessionStorage.setItem('selectedPumpFeatures', JSON.stringify(selectedFeatures));
    if (!completedSteps.includes('features')) {
      setCompletedSteps(prev => [...prev, 'features']);
    }
    setCurrentStep('story');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setFreeText(text);
    setCharCount(text.length);
  };

  const completeStory = async () => {
    try {
      // Save complete assessment data to MCP server
      const sessionId = freeTextMCPService.generateSessionId();
      
      const completeAssessmentData = {
        sessionId,
        sliderValues,
        selectedFeatures,
        freeText: freeText.trim()
      };
      
      console.log('🎯 Saving assessment data to local storage...');

      // MCP server temporarily disabled - using local storage only
      // try {
      //   const response = await fetch('http://localhost:3001/mcp', {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json'
      //     },
      //     body: JSON.stringify({
      //       tool: 'save_complete_assessment',
      //       args: completeAssessmentData
      //     })
      //   });
      //
      //   const result = await response.json();
      //   console.log('✅ MCP server response:', result);
      // } catch (mcpError) {
      //   console.warn('⚠️ MCP server not available, continuing with local storage:', mcpError);
      // }
      
      // Save free text data locally as backup
      if (freeText.trim()) {
        const analysis = freeTextMCPService.analyzeText(freeText);
        await freeTextMCPService.saveFreeTextResponse(sessionId, freeText.trim(), analysis);
        sessionStorage.setItem('freeTextSessionId', sessionId);
      }
      
      const freeTextData = {
        currentSituation: freeText.trim(),
        timestamp: new Date().toISOString()
      };
      sessionStorage.setItem('pumpDriveFreeText', JSON.stringify(freeTextData));
      
      if (!completedSteps.includes('story')) {
        setCompletedSteps(prev => [...prev, 'story']);
      }
      
      // Check if we need clarifying questions before going to results
      await checkForClarifyingQuestions();
      
    } catch (error) {
      console.error('❌ Error saving story:', error);
      alert('Error saving your story. Please try again.');
    }
  };

  const skipStory = async () => {
    const freeTextData = {
      currentSituation: '',
      timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('pumpDriveFreeText', JSON.stringify(freeTextData));
    
    if (!completedSteps.includes('story')) {
      setCompletedSteps(prev => [...prev, 'story']);
    }
    
    await checkForClarifyingQuestions();
  };

  const checkForClarifyingQuestions = async () => {
    try {
      setIsProcessing(true);
      console.log('🤔 Checking if clarifying questions are needed...');

      // Prepare input data for AI analysis
      const inputData = {
        sliders: sliderValues,
        selectedFeatures: selectedFeatures,
        userText: freeText.trim()
      };

      console.log('📊 Input data for AI:', inputData);

      // Import the AI service
      const { pumpDrivePureAI } = await import('../services/pumpDrivePureAI.service');

      // Call AI to determine if clarifying questions are needed
      const result = await pumpDrivePureAI.generateRecommendation(inputData);

      if (result.needsClarification && result.clarifyingQuestions && result.clarifyingQuestions.length > 0) {
        console.log('❓ Clarifying questions needed:', result.clarifyingQuestions);

        // Save clarifying questions and show them
        setClarifyingQuestions(result.clarifyingQuestions);
        sessionStorage.setItem('pumpDriveClarifyingQuestions', JSON.stringify(result.clarifyingQuestions));
        setCurrentStep('clarify');
      } else {
        console.log('✅ No clarifying questions needed, going to results');
        // Go directly to results
        navigate('/pumpdrive/results');
      }

    } catch (error) {
      console.error('❌ Error checking for clarifying questions:', error);
      // Fall back to going to results
      navigate('/pumpdrive/results');
    } finally {
      setIsProcessing(false);
    }
  };

  const completeClarifyingQuestions = async () => {
    try {
      setIsProcessing(true);
      console.log('💾 Saving clarifying answers:', clarifyingAnswers);
      console.log('💾 Clarifying questions:', clarifyingQuestions);

      // Convert array of answers to object keyed by question
      const responsesObject: Record<string, string> = {};

      if (clarifyingQuestions.length > 0) {
        clarifyingQuestions.forEach((question, index) => {
          responsesObject[question] = clarifyingAnswers[index] || '';
        });
      } else {
        // Fallback: try to get questions from sessionStorage
        const savedQuestions = sessionStorage.getItem('pumpDriveClarifyingQuestions');
        if (savedQuestions) {
          const questions = JSON.parse(savedQuestions);
          questions.forEach((question: string, index: number) => {
            responsesObject[question] = clarifyingAnswers[index] || '';
          });
        }
      }

      console.log('💾 Responses object:', responsesObject);

      // Save clarifying responses to sessionStorage as object
      sessionStorage.setItem('pumpDriveClarifyingResponses', JSON.stringify(responsesObject));

      // Mark clarify step as complete
      if (!completedSteps.includes('clarify')) {
        setCompletedSteps(prev => [...prev, 'clarify']);
      }

      // Navigate to results
      navigate('/pumpdrive/results');
    } catch (error) {
      console.error('❌ Error saving clarifying answers:', error);
      alert('Error saving your answers. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateRecommendation = async () => {
    setIsProcessing(true);
    setCurrentStep('results');
    
    try {
      console.log('🎯 Generating comprehensive recommendation...');
      console.log('📊 Sliders:', sliderValues);
      console.log('⭐ Features:', selectedFeatures.length);
      console.log('💭 Story length:', freeText.length);
      
      // Use the enhanced slider MCP service which now considers all three inputs
      const analysis = await sliderMCPService.generateRecommendation(sliderValues);
      
      setRecommendation(analysis);
      console.log('✅ Comprehensive recommendation generated!');
      
    } catch (error) {
      console.error('❌ Error generating recommendation:', error);
      alert('Error generating recommendation. Please try again.');
      setCurrentStep('story');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepProgress = () => {
    const steps = ['sliders', 'features', 'story', 'clarify'];
    const completed = steps.filter(step => completedSteps.includes(step as AssessmentStep)).length;
    return Math.round((completed / steps.length) * 100);
  };

  const renderProgressBar = () => (
    <div className="mb-12">
      <div className="flex justify-between text-sm font-light text-tesla-light-gray mb-3">
        <span>Assessment Progress</span>
        <span>{getStepProgress()}%</span>
      </div>
      <div className="w-full bg-tesla-silver rounded h-1">
        <div
          className="bg-tesla-dark-gray h-1 transition-all duration-500"
          style={{ width: `${getStepProgress()}%` }}
        ></div>
      </div>

      {/* Step indicators - Tesla Minimal */}
      <div className="flex justify-between mt-6">
        <div className={`flex items-center ${currentStep === 'sliders' ? 'text-tesla-dark-gray font-medium' : completedSteps.includes('sliders') ? 'text-tesla-dark-gray' : 'text-tesla-light-gray'}`}>
          <span className="text-xs font-light">Preferences</span>
        </div>
        <div className={`flex items-center ${currentStep === 'features' ? 'text-tesla-dark-gray font-medium' : completedSteps.includes('features') ? 'text-tesla-dark-gray' : 'text-tesla-light-gray'}`}>
          <span className="text-xs font-light">Features</span>
        </div>
        <div className={`flex items-center ${currentStep === 'story' ? 'text-tesla-dark-gray font-medium' : completedSteps.includes('story') ? 'text-tesla-dark-gray' : 'text-tesla-light-gray'}`}>
          <span className="text-xs font-light">Your Story</span>
        </div>
        <div className={`flex items-center ${currentStep === 'clarify' ? 'text-tesla-dark-gray font-medium' : completedSteps.includes('clarify') ? 'text-tesla-dark-gray' : 'text-tesla-light-gray'}`}>
          <span className="text-xs font-light">Questions</span>
        </div>
        <div className={`flex items-center ${currentStep === 'results' ? 'text-tesla-dark-gray font-medium' : 'text-tesla-light-gray'}`}>
          <span className="text-xs font-light">Results</span>
        </div>
      </div>
    </div>
  );

  if (currentStep === 'results') {
    if (isProcessing) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-8"></div>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                🤖 Analyzing Your Perfect Match...
              </h1>
              <div className="space-y-3 text-gray-600">
                <p>📊 Processing your preference sliders...</p>
                <p>⭐ Evaluating your feature selections...</p>
                <p>💭 Understanding your personal story...</p>
                <p>🎯 Finding your ideal insulin pump...</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (recommendation) {
      console.log('🔍 DEBUG - Results page data:');
      console.log('📊 sliderValues:', sliderValues);
      console.log('⭐ selectedFeatures:', selectedFeatures);
      console.log('💭 freeText:', freeText);
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
          <div className="max-w-4xl mx-auto">
            {/* Results Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                🎯 Your Perfect Pump Match
              </h1>
              <p className="text-xl text-gray-600 mb-4">
                Based on your comprehensive assessment
              </p>
              <div className="flex justify-center space-x-6 text-sm text-gray-500">
                <span>📊 {Object.keys(sliderValues).length} preferences</span>
                <span>⭐ {selectedFeatures.length} features</span>
                <span>💭 {freeText.length > 0 ? 'Personal story included' : 'No story shared'}</span>
              </div>
              <div className="w-24 h-1 bg-green-500 mx-auto mt-4 rounded"></div>
            </div>

            {/* Your Assessment Summary */}
            <div className="bg-blue-50 rounded-2xl p-8 shadow-lg border border-blue-100 mb-8">
              <h2 className="text-3xl font-bold text-blue-800 mb-6 text-center">
                📊 Your Complete Assessment
              </h2>
              <p className="text-center text-blue-600 mb-8">
                Here's exactly what you told us about your preferences and needs:
              </p>

              {/* Slider Preferences */}
              <div className="bg-white rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">🎛️</span>
                  Your Lifestyle Preferences (1-10 scale)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="flex items-center">
                        <span className="text-xl mr-2">🏃</span>
                        <span className="font-medium">Activity Level:</span>
                      </span>
                      <span className="text-xl font-bold text-blue-600">{sliderValues.activity}/10</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="flex items-center">
                        <span className="text-xl mr-2">📱</span>
                        <span className="font-medium">Technology Love:</span>
                      </span>
                      <span className="text-xl font-bold text-blue-600">{sliderValues.techComfort}/10</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="flex items-center">
                        <span className="text-xl mr-2">🎛️</span>
                        <span className="font-medium">Advanced Features:</span>
                      </span>
                      <span className="text-xl font-bold text-blue-600">{sliderValues.simplicity}/10</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="flex items-center">
                        <span className="text-xl mr-2">🤫</span>
                        <span className="font-medium">Privacy Needs:</span>
                      </span>
                      <span className="text-xl font-bold text-blue-600">{sliderValues.discreteness}/10</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="flex items-center">
                        <span className="text-xl mr-2">⏰</span>
                        <span className="font-medium">Time for Care:</span>
                      </span>
                      <span className="text-xl font-bold text-blue-600">{sliderValues.timeDedication}/10</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Features */}
              {selectedFeatures.length > 0 && (
                <div className="bg-white rounded-xl p-6 mb-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="text-2xl mr-3">⭐</span>
                    Features You Selected ({selectedFeatures.length})
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {selectedFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                        <span className="text-2xl mr-3">{feature.emoji}</span>
                        <div>
                          <div className="font-semibold text-gray-800">{feature.title}</div>
                          <div className="text-sm text-gray-600">{feature.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal Story */}
              {freeText.trim() && (
                <div className="bg-white rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="text-2xl mr-3">💭</span>
                    Your Personal Story
                  </h3>
                  <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
                    <p className="text-gray-700 leading-relaxed italic text-lg">
                      "{freeText.trim()}"
                    </p>
                  </div>
                </div>
              )}

              {!selectedFeatures.length && !freeText.trim() && (
                <div className="bg-white rounded-xl p-6">
                  <div className="text-center text-gray-500">
                    <p>Your recommendations are based solely on your lifestyle preferences.</p>
                    <p className="text-sm mt-2">You chose not to select specific features or share your personal story.</p>
                  </div>
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">
                🤖 AI Analysis & Recommendations
              </h2>
              <p className="text-gray-600 mt-2">
                Based on your complete assessment above, here are your personalized pump recommendations:
              </p>
            </div>

            {/* Top Pumps */}
            <div className="space-y-6 mb-8">
              {recommendation.recommendation.topPumps.map((pump: any, index: number) => (
                <div key={pump.pumpId} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">{pump.pumpName}</h2>
                      <div className="text-lg text-gray-600">Match Score: {pump.score}%</div>
                    </div>
                    <div className="text-4xl">
                      {index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-3">Why This Pump Matches You:</h3>
                      <ul className="space-y-2">
                        {pump.matchFactors.map((factor: string, i: number) => (
                          <li key={i} className="flex items-start">
                            <span className="text-green-500 mr-2">✓</span>
                            <span className="text-gray-600">{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-700 mb-3">Your Preferences Influence:</h3>
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
                {recommendation.recommendation.personalizedInsights.map((insight: string, index: number) => (
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
                {recommendation.recommendation.nextSteps.map((step: string, index: number) => (
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
                onClick={() => {
                  setCurrentStep('sliders');
                  setRecommendation(null);
                }}
                className="px-8 py-3 rounded-xl text-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
              >
                ↩️ Start Over
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
    }
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header - Tesla Style */}
        <div className="text-center mb-12 pt-8">
          <h1 className="text-4xl font-bold text-tesla-dark-gray mb-4 tracking-tight">
            Pump Assessment
          </h1>
          <p className="text-lg font-light text-tesla-light-gray">
            Find your perfect insulin pump match
          </p>
        </div>

        {renderProgressBar()}

        {/* Step 1: Sliders */}
        {currentStep === 'sliders' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                🎚️ Step 1: Your Preferences
              </h2>
              <p className="text-gray-600">Tell us about your lifestyle and preferences</p>
            </div>

            <div className="space-y-8 mb-8">
              {SLIDERS.map((slider) => (
                <div key={slider.id} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                  <div className="flex items-center mb-6">
                    <span className="text-3xl mr-4">{slider.emoji}</span>
                    <h3 className="text-2xl font-semibold text-gray-800">{slider.title}</h3>
                  </div>

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
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={completeSliders}
                className="px-12 py-4 rounded-2xl text-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 transition-all transform shadow-lg"
              >
                ⭐ Continue to Features
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Features */}
        {currentStep === 'features' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                ⭐ Step 2: Appealing Features
              </h2>
              <p className="text-gray-600">Select features that appeal to you (without knowing which pump they're from)</p>
            </div>

            <div className="space-y-8 mb-8">
              {FEATURE_CATEGORIES.map(category => {
                const categoryFeatures = PUMP_FEATURES.filter(f => f.category === category.id);
                if (categoryFeatures.length === 0) return null;

                return (
                  <div key={category.id} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                    <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                      <span className="text-3xl mr-3">{category.emoji}</span>
                      {category.name}
                    </h3>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryFeatures.map(feature => {
                        const isSelected = selectedFeatures.find(f => f.id === feature.id);
                        
                        return (
                          <div
                            key={feature.id}
                            onClick={() => toggleFeature(feature)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all transform hover:scale-105 ${
                              isSelected 
                                ? 'border-green-500 bg-green-50 shadow-lg' 
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-2xl">{feature.emoji}</span>
                              <div className={`w-5 h-5 rounded-full border-2 ${
                                isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <div className="text-white text-xs text-center">✓</div>}
                              </div>
                            </div>
                            <h4 className="font-semibold text-gray-800 mb-2">{feature.title}</h4>
                            <p className="text-sm text-gray-600">{feature.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                Selected {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={completeFeatures}
                className="px-12 py-4 rounded-2xl text-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 transition-all transform shadow-lg"
              >
                💭 Share Your Story
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Free Text Story */}
        {currentStep === 'story' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                💭 Step 3: Your Story
              </h2>
              <p className="text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Tell us about your current situation, concerns, and excitement about getting a new pump
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">🗣️</span>
                  Share Your Experience
                </h3>
                <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-400">
                  <p className="text-gray-700 leading-relaxed mb-4">
                    <strong>Help us understand:</strong>
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• What do you like or dislike about your current diabetes management?</li>
                    <li>• What concerns or fears do you have about switching to a new pump?</li>
                    <li>• What are you most excited about with a potential new pump?</li>
                    <li>• Any specific challenges or goals you'd like to address?</li>
                  </ul>
                </div>
              </div>

              <div className="mb-6">
                <textarea
                  value={freeText}
                  onChange={handleTextChange}
                  placeholder="Take your time and share whatever feels important to you. There are no right or wrong answers - we just want to understand your unique situation better..."
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-700 leading-relaxed"
                  maxLength={2000}
                />
                
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-gray-500">
                    {charCount === 0 ? 'Feel free to write as much or as little as you\'d like' : 'Thank you for sharing your thoughts'}
                  </span>
                  <span className={`${charCount > 1800 ? 'text-orange-500' : 'text-gray-400'}`}>
                    {charCount}/2000 characters
                  </span>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
                <h4 className="text-sm font-semibold text-green-800 mb-2">💡 Why this helps:</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>• More personalized pump recommendations</p>
                  <p>• Better understanding of your specific needs and concerns</p>
                  <p>• Tailored advice for your transition process</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={skipStory}
                  className="px-8 py-3 rounded-xl text-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                >
                  ⏭️ Skip Story
                </button>
                
                <button
                  onClick={completeStory}
                  disabled={isProcessing}
                  className={`px-8 py-3 rounded-xl text-lg font-semibold transition-all transform ${
                    isProcessing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105 shadow-lg'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    '🎯 Get My Recommendations'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Clarifying Questions */}
        {currentStep === 'clarify' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                ❓ Step 4: A Few Quick Questions
              </h2>
              <p className="text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Based on your responses, we have a few clarifying questions to give you the best recommendations
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="text-2xl mr-3">🤔</span>
                  AI-Generated Follow-up Questions
                </h3>
                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-400">
                  <p className="text-gray-700 leading-relaxed">
                    <strong>Our AI has analyzed your responses</strong> and identified these key areas where a bit more detail would help us provide the most accurate recommendations for you.
                  </p>
                </div>
              </div>

              {clarifyingQuestions.length > 0 ? (
                <div className="space-y-6 mb-8">
                  {clarifyingQuestions.map((question, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full mr-3">
                            Question {index + 1}
                          </span>
                        </h4>
                        <p className="text-gray-700 leading-relaxed">{question}</p>
                      </div>
                      <textarea
                        value={clarifyingAnswers[index] || ''}
                        onChange={(e) => {
                          const newAnswers = [...clarifyingAnswers];
                          newAnswers[index] = e.target.value;
                          setClarifyingAnswers(newAnswers);
                        }}
                        placeholder="Please share your thoughts on this question..."
                        className="w-full h-24 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-700"
                        maxLength={500}
                      />
                      <div className="text-right mt-2">
                        <span className="text-xs text-gray-400">
                          {(clarifyingAnswers[index] || '').length}/500 characters
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500">No clarifying questions needed. Proceeding to results...</div>
                </div>
              )}

              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
                <h4 className="text-sm font-semibold text-green-800 mb-2">💡 Why these questions matter:</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>• Help us understand nuances in your responses</p>
                  <p>• Ensure recommendations match your specific situation</p>
                  <p>• Provide more accurate and personalized advice</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    // Skip clarifying questions and go to results
                    navigate('/pumpdrive/results');
                  }}
                  className="px-8 py-3 rounded-xl text-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                >
                  ⏭️ Skip Questions
                </button>

                <button
                  onClick={completeClarifyingQuestions}
                  disabled={isProcessing}
                  className={`px-8 py-3 rounded-xl text-lg font-semibold transition-all transform ${
                    isProcessing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    '🎯 Get My Final Recommendations'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
};

export default PumpDriveUnified;