import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
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
  { id: 'automation', name: 'Automation Level', emoji: '🤖' },
  { id: 'innovation', name: 'Latest Innovation', emoji: '🚀' }
];

type AssessmentStep = 'sliders' | 'features' | 'story' | 'clarify' | 'results';

const PumpDriveUnified: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
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

  const saveAssessmentToDatabase = async () => {
    try {
      if (!user?.id) {
        console.error('❌ No user ID found, cannot save assessment');
        return null;
      }

      console.log('💾 Saving assessment to database for user:', user.id);

      // Get patient name
      const { data: patientData } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      const patientName = patientData
        ? `${patientData.first_name} ${patientData.last_name}`
        : 'Unknown Patient';

      // Create assessment record
      const { data: assessment, error } = await supabase
        .from('pump_assessments')
        .insert({
          patient_id: user.id,
          patient_name: patientName,
          slider_values: sliderValues,
          selected_features: selectedFeatures,
          lifestyle_text: freeText.trim() || null,
          assessment_data: {
            sliders: sliderValues,
            features: selectedFeatures,
            freeText: freeText.trim(),
            timestamp: new Date().toISOString()
          },
          final_recommendation: { pending: true }, // Placeholder, will be updated after payment
          access_type: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving assessment:', error);
        return null;
      }

      console.log('✅ Assessment saved successfully:', assessment.id);
      return assessment.id;

    } catch (error) {
      console.error('❌ Error in saveAssessmentToDatabase:', error);
      return null;
    }
  };

  const checkForClarifyingQuestions = async () => {
    try {
      setIsProcessing(true);
      console.log('🤔 Checking if clarifying questions are needed...');

      // Save assessment to database first
      await saveAssessmentToDatabase();

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
        console.log('✅ No clarifying questions needed, going to access gate');
        // Go directly to access gate
        navigate('/pumpdrive/access');
      }

    } catch (error) {
      console.error('❌ Error checking for clarifying questions:', error);
      // Fall back to going to access gate
      navigate('/pumpdrive/access');
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

      // Navigate to access gate
      navigate('/pumpdrive/access');
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
    <div className="mb-2">
      <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
        <span>Progress: {getStepProgress()}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${getStepProgress()}%` }}
        ></div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header - Compact */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Pump Assessment
          </h1>
          <p className="text-base text-gray-600">
            Find your perfect insulin pump match
          </p>
        </div>

        {/* Step 1: Sliders */}
        {currentStep === 'sliders' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-blue-600 mb-2">
                Step 1: Your Preferences
              </h2>
              <p className="text-base text-gray-600">Tell us about your lifestyle</p>
            </div>

            <div className="space-y-4 mb-8">
              {SLIDERS.map((slider) => (
                <div key={slider.id} className="bg-white rounded-2xl p-6 border-2 border-blue-200 shadow-md">
                  {/* Question Header - Bold and prominent */}
                  <div className="mb-3">
                    <h3 className="text-xl font-bold text-blue-700">{slider.title}</h3>
                  </div>

                  {/* Examples - Compact 3-column layout */}
                  <div className="grid md:grid-cols-3 gap-2 mb-3">
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="text-xs font-bold text-gray-700 mb-0.5">Low (1-3)</div>
                      <div className="text-xs text-gray-600 leading-tight">{slider.examples.low}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="text-xs font-bold text-gray-700 mb-0.5">Medium (4-7)</div>
                      <div className="text-xs text-gray-600 leading-tight">{slider.examples.medium}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="text-xs font-bold text-gray-700 mb-0.5">High (8-10)</div>
                      <div className="text-xs text-gray-600 leading-tight">{slider.examples.high}</div>
                    </div>
                  </div>

                  {/* Slider Control - Professional Blue */}
                  <div className="relative">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-gray-600">Low</span>
                      <span className="text-3xl font-bold text-blue-600">
                        {sliderValues[slider.id]}
                      </span>
                      <span className="text-xs font-bold text-gray-600">High</span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={sliderValues[slider.id]}
                      onChange={(e) => handleSliderChange(slider.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer transition-all"
                      style={{
                        background: `linear-gradient(to right, #0066CC 0%, #0066CC ${((sliderValues[slider.id] - 1) / 9) * 100}%, #e5e7eb ${((sliderValues[slider.id] - 1) / 9) * 100}%, #e5e7eb 100%)`
                      }}
                    />

                    {/* Tick marks */}
                    <div className="flex justify-between mt-1 px-0.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <div key={num} className="text-xs text-gray-400 font-medium">{num}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={completeSliders}
                className="px-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
              >
                Continue to Features →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Features */}
        {currentStep === 'features' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-blue-600 mb-2">
                Step 2: Appealing Features
              </h2>
              <p className="text-sm text-gray-600">Select features that appeal to you</p>
              <p className="text-sm font-bold text-blue-700 mt-1">Choose only 1 per section</p>
            </div>

            <div className="space-y-3 mb-6">
              {FEATURE_CATEGORIES.map(category => {
                const categoryFeatures = PUMP_FEATURES.filter(f => f.category === category.id);
                if (categoryFeatures.length === 0) return null;

                return (
                  <div key={category.id} className="bg-white rounded p-4 border border-gray-300">
                    <div className="text-center mb-3">
                      <h3 className="text-lg font-bold text-blue-700">
                        {category.name} <span className="text-sm font-bold text-red-600">- Pick only 1</span>
                      </h3>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {categoryFeatures.map(feature => {
                        const isSelected = selectedFeatures.find(f => f.id === feature.id);

                        return (
                          <div
                            key={feature.id}
                            onClick={() => toggleFeature(feature)}
                            className={`p-2 rounded border-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-bold text-gray-900 text-xs flex-1 pr-1">{feature.title}</h4>
                              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                              }`}>
                                {isSelected && <div className="text-white text-xs text-center leading-4">✓</div>}
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 leading-tight">{feature.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              <p className="text-xs font-bold text-gray-700 mb-2">
                Selected {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={completeFeatures}
                className="px-10 py-3 rounded text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Continue to Your Story →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Free Text Story */}
        {currentStep === 'story' && (
          <div>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 mb-1">
                Step 3: Your Story
              </h2>
              <p className="text-sm text-gray-600">
                Tell us about your current situation
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-white rounded p-4 border border-gray-300">
                <div className="mb-3">
                  <h3 className="text-xl font-bold text-blue-700">Help us understand your needs</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-600">
                    <div className="text-sm font-bold text-blue-700 mb-1">Current Experience</div>
                    <div className="text-sm text-gray-700 font-semibold">What do you like or dislike now?</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-600">
                    <div className="text-sm font-bold text-blue-700 mb-1">Concerns</div>
                    <div className="text-sm text-gray-700 font-semibold">What worries do you have?</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-600">
                    <div className="text-sm font-bold text-blue-700 mb-1">Excitement</div>
                    <div className="text-sm text-gray-700 font-semibold">What excites you about a new pump?</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-600">
                    <div className="text-sm font-bold text-blue-700 mb-1">Goals</div>
                    <div className="text-sm text-gray-700 font-semibold">Any challenges or goals?</div>
                  </div>
                </div>

                <div className="mb-3">
                  <textarea
                    value={freeText}
                    onChange={handleTextChange}
                    placeholder="Share your thoughts here..."
                    className="w-full h-40 p-3 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none text-sm text-gray-700"
                    maxLength={2000}
                  />

                  <div className="flex justify-end mt-1 text-xs">
                    <span className={`font-bold ${charCount > 1800 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {charCount}/2000
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="text-xs font-bold text-gray-700 mb-1">Why this helps</div>
                  <div className="text-xs text-gray-600 space-y-0">
                    <p>• More personalized recommendations</p>
                    <p>• Better understanding of your needs</p>
                    <p>• Tailored transition advice</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={completeStory}
                disabled={isProcessing}
                className={`px-10 py-3 rounded text-sm font-bold transition-colors ${
                  isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Get Recommendations →'
                )}
              </button>

              <button
                onClick={skipStory}
                className="block mx-auto mt-2 px-4 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Clarifying Questions */}
        {currentStep === 'clarify' && (
          <div>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 mb-1">
                Step 4: A Few Quick Questions
              </h2>
              <p className="text-sm text-gray-600">
                Based on your responses, we need a bit more detail
              </p>
            </div>

            <div className="bg-white rounded p-4 border border-gray-300 mb-6">
              <div className="mb-3">
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  AI-Generated Follow-up Questions
                </h3>
                <div className="bg-blue-50 p-2 rounded border-l-2 border-blue-600">
                  <p className="text-xs text-gray-700">
                    <strong className="font-bold text-gray-900">Our AI has analyzed your responses</strong> and identified these key areas where more detail would help.
                  </p>
                </div>
              </div>

              {clarifyingQuestions.length > 0 ? (
                <div className="space-y-3 mb-3">
                  {clarifyingQuestions.map((question, index) => (
                    <div key={index} className="border border-gray-200 rounded p-3">
                      <div className="mb-2">
                        <h4 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                          <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                            Q{index + 1}
                          </span>
                        </h4>
                        <p className="text-xs text-gray-700 font-bold">{question}</p>
                      </div>
                      <textarea
                        value={clarifyingAnswers[index] || ''}
                        onChange={(e) => {
                          const newAnswers = [...clarifyingAnswers];
                          newAnswers[index] = e.target.value;
                          setClarifyingAnswers(newAnswers);
                        }}
                        placeholder="Share your thoughts..."
                        className="w-full h-16 p-2 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none text-xs text-gray-700"
                        maxLength={500}
                      />
                      <div className="text-right mt-1">
                        <span className="text-xs font-bold text-gray-500">
                          {(clarifyingAnswers[index] || '').length}/500
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-500 font-bold">No clarifying questions needed</div>
                </div>
              )}

              <div className="bg-green-50 p-2 rounded border border-green-300 mb-3">
                <h4 className="text-xs font-bold text-green-900 mb-1">Why these questions matter:</h4>
                <div className="text-xs text-green-800 space-y-0">
                  <p>• Understand nuances in your responses</p>
                  <p>• Match recommendations to your situation</p>
                  <p>• Provide accurate personalized advice</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => {
                    // Skip clarifying questions and go to access gate
                    navigate('/pumpdrive/access');
                  }}
                  className="px-8 py-2.5 rounded text-sm font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                >
                  Skip Questions
                </button>

                <button
                  onClick={completeClarifyingQuestions}
                  disabled={isProcessing}
                  className={`px-8 py-2.5 rounded text-sm font-bold transition-colors ${
                    isProcessing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Get Final Recommendations →'
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