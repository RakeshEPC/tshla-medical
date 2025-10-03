import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pumpDriveFeatureBasedService } from '../services/pumpDriveFeatureBased.service';
import { pumpDrivePureAI } from '../services/pumpDrivePureAI.service';
import { pumpDriveAIService } from '../services/pumpDriveAI.service';
import { pumpAssessmentService, type AssessmentData } from '../services/pumpAssessment.service';
import { pumpAuthService } from '../services/pumpAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface PumpRecommendation {
  topRecommendation: {
    name: string;
    score: number;
    explanation: string;
    keyFeatures: string[];
    pros: string[];
    cons: string[];
  };
  alternatives: Array<{
    name: string;
    score: number;
    explanation: string;
    keyFeatures: string[];
  }>;
  decisionSummary: {
    userPriorities: string[];
    keyFactors: string[];
    confidence: number;
  };
  detailedAnalysis: string;
}

// Legacy interface for backward compatibility
interface LegacyPumpRecommendation {
  topChoice: {
    name: string;
    score: number;
    reasons: string[];
  };
  alternatives: Array<{
    name: string;
    score: number;
    reasons: string[];
  }>;
  keyFactors: string[];
  personalizedInsights: string;
}

// Helper function to extract pump name from explanation text
const extractPumpNameFromText = (text: string): string => {
  if (!text) return 'Insulin Pump';

  // Known pump names to search for (in order of specificity)
  const pumpNames = [
    'Beta Bionics iLet',
    'Omnipod 5 (Insulet)',
    'Omnipod 5',
    'Tandem t:slim X2',
    'Tandem Mobi',
    'Medtronic MiniMed 780G',
    'Medtronic 780G',
    'Twiist (Zealand Pharma)',
    'Twiist',
    'Sigi Patch Pump',
    'Sigi'
  ];

  // Find the first pump name mentioned in the text
  for (const pump of pumpNames) {
    if (text.includes(pump)) {
      return pump;
    }
  }

  // Fallback: extract pattern "The [Pump Name] is/offers/pump"
  const patterns = [
    /The ([A-Za-z0-9\s:]+?) (?:is|offers|provides|pump)/,
    /([A-Za-z0-9\s:]+?) (?:is particularly|offers|provides)/,
    /([A-Za-z0-9\s:]+?) pump is/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Basic validation - should contain letters and be reasonable length
      if (extracted.length > 3 && extracted.length < 50 && /[A-Za-z]/.test(extracted)) {
        return extracted;
      }
    }
  }

  return 'Insulin Pump'; // Final fallback
};

export default function PumpDriveResults() {
  const navigate = useNavigate();
  const [recommendation, setRecommendation] = useState<PumpRecommendation | null>(null);
  // Voice functionality removed
  // const [isSpeaking, setIsSpeaking] = useState(false);
  // const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [patientName] = useState(() => {
    return sessionStorage.getItem('pumpDrivePatientName') || '';
  });

  // Function to save assessment to database
  const saveAssessmentToDatabase = async (recommendationData: PumpRecommendation) => {
    try {
      logDebug('PumpDriveResults', 'Saving assessment to database', {});

      // Get current user
      const currentUser = pumpAuthService.getUser();
      if (!currentUser) {
        logWarn('PumpDriveResults', 'No authenticated user found, skipping database save', {});
        return;
      }

      // Collect conversation history
      const existingConversation = JSON.parse(sessionStorage.getItem('pumpDriveConversation') || '[]');

      // Create assessment data with user information
      const assessmentData: AssessmentData = {
        patientName: patientName || currentUser.username || `User_${currentUser.id}`,
        userId: currentUser.id,
        sliderValues: JSON.parse(sessionStorage.getItem('pumpDriveSliders') || '{}'),
        selectedFeatures: JSON.parse(sessionStorage.getItem('selectedPumpFeatures') || '[]'),
        personalStory: JSON.parse(sessionStorage.getItem('pumpDriveFreeText') || '{}').currentSituation || '',
        challenges: JSON.parse(sessionStorage.getItem('pumpDriveFreeText') || '{}').challenges || '',
        priorities: JSON.parse(sessionStorage.getItem('pumpDriveFreeText') || '{}').priorities || '',
        clarifyingResponses: JSON.parse(sessionStorage.getItem('pumpDriveClarifyingResponses') || '{}'),
        aiRecommendation: {
          topChoice: {
            name: recommendationData.topRecommendation.name,
            score: recommendationData.topRecommendation.score,
            reasons: recommendationData.topRecommendation.pros || []
          },
          alternatives: recommendationData.alternatives.map(alt => ({
            name: alt.name,
            score: alt.score,
            reasons: [alt.explanation]
          })),
          keyFactors: recommendationData.decisionSummary.userPriorities,
          personalizedInsights: recommendationData.detailedAnalysis
        },
        conversationHistory: existingConversation,
        assessmentFlow: 'unified',
        timestamp: new Date().toISOString()
      };

      const result = await pumpAssessmentService.saveAssessment(assessmentData);

      if (result.success) {
        setAssessmentSaved(true);
        setAssessmentId(result.assessmentId);
        logInfo('PumpDriveResults', 'Assessment saved successfully', {
          assessmentId: result.assessmentId
        });

        // Update session storage to include assessment ID for future reference
        sessionStorage.setItem('pumpdrive_assessment_id', result.assessmentId.toString());
      }
    } catch (error) {
      logError('PumpDriveResults', 'Failed to save assessment to database', { error });
      // Don't block the UI if database save fails
    }
  };

  useEffect(() => {
    generateRecommendations();
  }, []);

  const generateRecommendations = async () => {
    try {
      if (hasAttempted) {
        console.log('PumpDriveResults: Already attempted, skipping to prevent infinite loop');
        return;
      }

      setHasAttempted(true);
      setLoading(true);
      setError(null);

      // Check if we have data from simplified flow
      const sliderData = sessionStorage.getItem('pumpDriveSliders');
      const featureData = sessionStorage.getItem('selectedPumpFeatures');
      const freeTextData = sessionStorage.getItem('pumpDriveFreeText');
      const clarifyingData = sessionStorage.getItem('pumpDriveClarifyingResponses');

      if (sliderData || featureData || freeTextData) {
        // Clarifying responses are optional in the unified flow
        if (!clarifyingData) {
          logInfo('PumpDriveResults', 'No clarifying responses - continuing with available data', {});
        }

        logDebug('PumpDriveResults', 'Using simplified AI service for final recommendation', {});

        try {
          // Call our new API endpoint with all user data
          console.log('PumpDriveResults: Calling new API endpoint...');

          const userData = {
            sliders: JSON.parse(sliderData || '{}'),
            features: JSON.parse(featureData || '[]'),
            freeText: JSON.parse(freeTextData || '{}'),
            clarifying: JSON.parse(clarifyingData || '{}')
          };

          const apiUrl = import.meta.env.VITE_PUMP_API_URL || 'http://localhost:3001';

          // Get auth token for authenticated request
          const token = localStorage.getItem('token');
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(`${apiUrl}/api/pumpdrive/recommend`, {
            method: 'POST',
            headers,
            body: JSON.stringify(userData),
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          const apiResult = await response.json();
          console.log('PumpDriveResults: Received API result:', apiResult);
          console.log('PumpDriveResults: API result overallTop:', apiResult.overallTop);
          console.log('PumpDriveResults: API result structure:', {
            hasOverallTop: !!apiResult.overallTop,
            overallTopLength: apiResult.overallTop?.length,
            firstItem: apiResult.overallTop?.[0]
          });

          // Convert API format to display format
          const simplifiedResult = {
            topChoice: apiResult.overallTop[0],
            alternatives: apiResult.alternatives || [],
            keyFactors: apiResult.keyFactors || [],
            personalizedInsights: apiResult.personalizedInsights || ''
          };

          console.log('PumpDriveResults: Converted simplifiedResult:', simplifiedResult);
          console.log('PumpDriveResults: API alternatives:', apiResult.alternatives);
          console.log('PumpDriveResults: Top choice from API:', apiResult.overallTop[0]);
          console.log('PumpDriveResults: TopChoice structure:', {
            pumpName: simplifiedResult.topChoice.pumpName,
            name: simplifiedResult.topChoice.name,
            score: simplifiedResult.topChoice.score,
            fullObject: simplifiedResult.topChoice
          });

          // Convert simplified AI format to display format
          const extractedPumpName = extractPumpNameFromText(simplifiedResult.personalizedInsights);
          console.log('PumpDriveResults: Extracted pump name:', extractedPumpName, 'from text:', simplifiedResult.personalizedInsights.substring(0, 100));

          const converted: PumpRecommendation = {
            topRecommendation: {
              name: simplifiedResult.topChoice.pumpName || simplifiedResult.topChoice.name || extractedPumpName,
              score: simplifiedResult.topChoice.score || 85,
              explanation: simplifiedResult.personalizedInsights,
              keyFeatures: simplifiedResult.topChoice.reasons?.slice(0, 3) || ['Advanced features', 'User-friendly', 'Reliable'],
              pros: simplifiedResult.topChoice.reasons || ['Great choice for your needs'],
              cons: ['Discuss with your healthcare provider for personalized guidance'],
            },
            alternatives: simplifiedResult.alternatives?.map((alt, index) => {
              const altText = alt.reasons?.join(' ') || '';
              const extractedAltName = extractPumpNameFromText(altText);

              console.log(`PumpDriveResults: Alt ${index}:`, {
                originalPumpName: alt.pumpName,
                originalName: alt.name,
                extractedName: extractedAltName,
                reasonsText: altText.substring(0, 100)
              });

              return {
                name: alt.pumpName || alt.name || extractedAltName || `Alternative ${index + 1}`,
                score: alt.score || (80 - index * 5),
                explanation: alt.reasons?.join('. ') || 'Alternative insulin pump option',
                keyFeatures: alt.reasons?.slice(0, 2) || ['Advanced features', 'Reliable performance'],
              };
            }) || [],
            decisionSummary: {
              userPriorities: simplifiedResult.keyFactors,
              keyFactors: simplifiedResult.keyFactors,
              confidence: 90,
            },
            detailedAnalysis: simplifiedResult.personalizedInsights,
          };

          console.log('PumpDriveResults: About to set recommendation:', converted);
          console.log('PumpDriveResults: Top recommendation details:', {
            name: converted.topRecommendation.name,
            explanation: converted.topRecommendation.explanation,
            personalizedInsights: simplifiedResult.personalizedInsights
          });
          setRecommendation(converted);
          console.log('PumpDriveResults: Recommendation set successfully');

          // Explicitly stop loading state
          setLoading(false);
          console.log('PumpDriveResults: Loading set to false');

          // Save assessment to database in background (don't wait)
          saveAssessmentToDatabase(converted).catch(error => {
            console.error('PumpDriveResults: Database save failed (non-blocking):', error);
          });

          console.log('PumpDriveResults: Function completed successfully');
          return;
        } catch (simplifiedAIError) {
          console.error('PumpDriveResults: API call failed:', simplifiedAIError);
          logError('PumpDriveResults', 'API service failed, trying Azure AI directly', { error: simplifiedAIError });

          // Try using Azure AI directly via pumpDriveAIService
          try {
            console.log('PumpDriveResults: Attempting Azure AI fallback via pumpDriveAIService');
            const azureResult = await pumpDriveAIService.processSimplifiedFlow();
            console.log('PumpDriveResults: Azure AI fallback successful:', azureResult);
            setRecommendation(azureResult);
            setLoading(false);

            // Save assessment to database
            saveAssessmentToDatabase(azureResult).catch(error => {
              console.error('PumpDriveResults: Database save failed (non-blocking):', error);
            });

            return;
          } catch (azureError) {
            console.error('PumpDriveResults: Azure AI fallback also failed:', azureError);
            logError('PumpDriveResults', 'Both API and Azure AI failed, using static fallback', { apiError: simplifiedAIError, azureError });
          }

          // Final fallback recommendation if everything fails
          const fallbackRecommendation: PumpRecommendation = {
            topRecommendation: {
              name: 'Omnipod 5',
              score: 85,
              explanation: 'Recommended based on general best practices. API service temporarily unavailable.',
              keyFeatures: ['Tubeless design', 'Automated insulin delivery', 'Waterproof'],
              pros: ['Freedom from tubing', 'Automated adjustments', 'Active lifestyle friendly'],
              cons: ['Pod changes every 3 days', 'Higher supply costs'],
            },
            alternatives: [
              {
                name: 'Tandem t:slim X2',
                score: 80,
                explanation: 'Advanced hybrid closed-loop system with Control-IQ technology.',
                keyFeatures: ['Control-IQ', 'Touchscreen', 'Rechargeable'],
              }
            ],
            decisionSummary: {
              userPriorities: ['Active lifestyle', 'Convenience'],
              keyFactors: ['API service unavailable - using fallback'],
              confidence: 70,
            },
            detailedAnalysis: 'Recommendations generated from fallback system due to API unavailability. Please try again later for personalized AI recommendations.',
          };

          setRecommendation(fallbackRecommendation);
          setLoading(false);
          console.log('PumpDriveResults: Fallback recommendation set, loading stopped');
          return;
        }
      }

      // Fallback: Use legacy system
      if (sliderData || featureData || freeTextData) {
        logDebug('PumpDriveResults', 'Using legacy feature-based service', {});

        // Combine all three inputs into a format the legacy service expects
        const combinedAnswers: Record<string, string | string[]> = {};

        // Add slider data
        if (sliderData) {
          const sliders = JSON.parse(sliderData);
          Object.entries(sliders).forEach(([key, value]) => {
            combinedAnswers[key] = String(value);
          });
        }

        // Add feature selections
        if (featureData) {
          const features = JSON.parse(featureData);
          combinedAnswers.selectedFeatures = features.map((f: any) => f.name || f.id);
        }

        // Add free text insights
        if (freeTextData) {
          const textData = JSON.parse(freeTextData);
          if (textData.currentSituation) {
            combinedAnswers.userStory = textData.currentSituation;
          }
        }

        const result = await pumpDriveFeatureBasedService.generateRecommendations(combinedAnswers);
        setRecommendation(result);

        // Save assessment to database
        await saveAssessmentToDatabase(result);
        return;
      }

      // Try legacy stored answers
      const storedAnswers =
        sessionStorage.getItem('pumpDriveAnswers') || sessionStorage.getItem('pumpdrive_responses');
      if (storedAnswers) {
        const answers = JSON.parse(storedAnswers);
        logDebug('PumpDriveResults', 'Using stored answers with legacy service', {});

        const result = await pumpDriveFeatureBasedService.generateRecommendations(answers);
        setRecommendation(result);

        // Save assessment to database
        await saveAssessmentToDatabase(result);
        return;
      }

      // Last resort: Check for saved recommendation
      const savedRec = sessionStorage.getItem('pumpdrive_recommendation');
      if (savedRec) {
        const legacyRec: LegacyPumpRecommendation = JSON.parse(savedRec);
        logDebug('PumpDriveResults', 'Using saved legacy recommendation', {});

        // Convert legacy format to new format
        const converted: PumpRecommendation = {
          topRecommendation: {
            name: legacyRec.topChoice.name || 'Omnipod 5',
            score: legacyRec.topChoice.score || 85,
            explanation:
              legacyRec.personalizedInsights ||
              `${legacyRec.topChoice.name || 'This pump'} is recommended for you.`,
            keyFeatures: legacyRec.topChoice.reasons?.slice(0, 3) || ['Advanced features', 'User-friendly', 'Reliable'],
            pros: legacyRec.topChoice.reasons || ['Great choice for your needs'],
            cons: ['Consider discussing with your healthcare provider'],
          },
          alternatives: legacyRec.alternatives?.map((alt, index) => ({
            name: alt.name || ['Tandem t:slim X2', 'Medtronic 780G'][index] || 'Insulin Pump',
            score: alt.score || (75 - index * 5),
            explanation: alt.reasons?.join('. ') || 'Alternative option to consider',
            keyFeatures: alt.reasons?.slice(0, 2) || ['Quality features', 'Proven technology'],
          })) || [],
          decisionSummary: {
            userPriorities: legacyRec.keyFactors,
            keyFactors: legacyRec.keyFactors,
            confidence: 85,
          },
          detailedAnalysis: legacyRec.personalizedInsights || 'Analysis not available',
        };
        setRecommendation(converted);

        // Save assessment to database for legacy recommendation
        await saveAssessmentToDatabase(converted);
      } else {
        setError('No questionnaire data found. Please start the questionnaire.');
        // Optionally redirect to assessment after a delay
        setTimeout(() => {
          navigate('/pumpdrive/assessment');
        }, 3000);
      }
    } catch (error) {
      logError('PumpDriveResults', 'All recommendation services failed', { error });
      setError('Failed to generate recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Voice functionality removed
  // useEffect(() => {
  //   if (recommendation && !hasPlayedIntro) {
  //     setHasPlayedIntro(true);
  //     playResultsIntro();
  //   }
  // }, [recommendation]);

  // const playResultsIntro = async () => {
  //   if (!recommendation) return;
  //
  //   setIsSpeaking(true);
  //   const message = `Based on your responses, I recommend the ${recommendation.topRecommendation.name} as your best match. It scored ${recommendation.topRecommendation.score} out of 100 for your specific needs, with ${recommendation.decisionSummary.confidence}% confidence.`;
  //   // Use Rachel voice (most popular female voice on ElevenLabs)
  //   await elevenLabsService.speak(message, '21m00Tcm4TlvDq8ikWAM');
  //   setIsSpeaking(false);
  // };

  const resetAndStartOver = () => {
    // Clear ALL pump drive data
    sessionStorage.removeItem('pumpdrive_responses');
    sessionStorage.removeItem('pumpdrive_recommendation');
    sessionStorage.removeItem('pumpDriveSliders');
    sessionStorage.removeItem('pumpDriveSelectedFeatures');
    sessionStorage.removeItem('pumpDriveFreeText');
    sessionStorage.removeItem('pumpDriveAnswers');
    sessionStorage.removeItem('pumpDriveClarifyingResponses');
    sessionStorage.removeItem('pumpDriveConversation');
    navigate('/pumpdrive/unified');
  };

  const handlePrint = () => {
    window.print();
  };

  const clearDataAndRefresh = () => {
    // Clear all data and refresh current page
    sessionStorage.removeItem('pumpdrive_responses');
    sessionStorage.removeItem('pumpdrive_recommendation');
    sessionStorage.removeItem('pumpDriveSliders');
    sessionStorage.removeItem('pumpDriveSelectedFeatures');
    sessionStorage.removeItem('pumpDriveFreeText');
    sessionStorage.removeItem('pumpDriveAnswers');
    window.location.reload();
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Analyzing Your Needs</h2>
            <p className="text-gray-600">
              Using advanced feature matching to find your perfect pump...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/pumpdrive')}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800">No recommendations available</h2>
          </div>
        </div>
      </div>
    );
  }

  // Safety check: ensure recommendation exists before destructuring
  if (!recommendation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Recommendation Available</h2>
          <p className="text-gray-600 mb-6">
            We couldn't load your pump recommendation. This usually happens if you haven't completed the assessment yet.
          </p>
          <button
            onClick={() => navigate('/pumpdrive/assessment')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  const {
    topRecommendation = {
      name: 'Unknown',
      score: 0,
      explanation: '',
      keyFeatures: [],
      pros: [],
      cons: []
    },
    alternatives = [],
    decisionSummary = {
      userPriorities: [],
      keyFactors: [],
      confidence: 0
    },
    detailedAnalysis = ''
  } = recommendation || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Your Personalized Pump Recommendation
          </h1>
          <p className="text-gray-600">
            Based on your specific preferences and AI analysis
          </p>
          {assessmentSaved && (
            <div className="mt-3 p-2 bg-green-100 border border-green-400 rounded-lg text-green-700 text-sm">
              ✅ Assessment saved to database (ID: {assessmentId})
            </div>
          )}
        </div>

        {/* User Input Summary - PROMINENT DISPLAY */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-3">📋</span> Your Input Summary
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Slider Values */}
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🎚️</span> Your Lifestyle Preferences
              </h3>
              {(() => {
                const sliderData = sessionStorage.getItem('pumpDriveSliders');
                if (sliderData) {
                  const sliders = JSON.parse(sliderData);
                  return (
                    <div className="space-y-3">
                      {Object.entries(sliders).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <div className="flex items-center">
                            <span className="text-sm font-bold text-blue-600 mr-2">{value as number}/10</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${((value as number) / 10) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return <p className="text-gray-500 text-sm">No slider data available</p>;
              })()}
            </div>

            {/* Selected Features */}
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">⭐</span> Selected Features
              </h3>
              {(() => {
                const featureData = sessionStorage.getItem('selectedPumpFeatures');
                if (featureData) {
                  const features = JSON.parse(featureData);
                  return (
                    <div className="space-y-2">
                      {features.map((feature: any, index: number) => (
                        <div key={index} className="flex items-center">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          <span className="text-sm text-gray-700">
                            {feature.name || feature.title || feature.id || feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return <p className="text-gray-500 text-sm">No features selected</p>;
              })()}
            </div>

            {/* User Story/Text */}
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">💭</span> Your Story & Priorities
              </h3>
              {(() => {
                const textData = sessionStorage.getItem('pumpDriveFreeText');
                if (textData) {
                  const parsed = JSON.parse(textData);
                  const userText = parsed.currentSituation || parsed.userStory || '';
                  if (userText) {
                    return (
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <p className="italic">"{userText}"</p>
                      </div>
                    );
                  }
                }
                return <p className="text-gray-500 text-sm">No personal story provided</p>;
              })()}
            </div>
          </div>

          {/* Clarifying Responses if any */}
          {(() => {
            const clarifyingData = sessionStorage.getItem('pumpDriveClarifyingResponses');
            if (clarifyingData) {
              const responses = JSON.parse(clarifyingData);
              return (
                <div className="mt-6 bg-white rounded-lg p-6 shadow-md">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">❓</span> Your Clarifying Responses
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(responses).map(([question, answer], index) => (
                      <div key={index} className="border-l-4 border-purple-400 pl-4">
                        <p className="text-sm font-medium text-gray-800 mb-1">Q: {question}</p>
                        <p className="text-sm text-gray-600 italic">A: {answer as string}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ✅ All of this information was considered by our AI in making your recommendation below
            </p>
          </div>
        </div>

        {/* Top Recommendation Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                🏆 Best Match: {topRecommendation.name}
              </h2>
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 px-3 py-1 rounded-full">
                  <span className="text-green-800 font-semibold">
                    {topRecommendation.score}% Match
                  </span>
                </div>
                <div className="bg-blue-100 px-3 py-1 rounded-full">
                  <span className="text-blue-800 font-semibold">
                    {decisionSummary.confidence}% Confidence
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-gray-700 mb-6 text-lg leading-relaxed">
            {topRecommendation.explanation}
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Key Features */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">⭐</span> Key Features
              </h3>
              <ul className="space-y-2">
                {topRecommendation.keyFeatures.map((feature, index) => (
                  <li key={index} className="text-gray-600 text-sm flex items-center">
                    <span className="mr-2">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pros */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">✅</span> Perfect For You
              </h3>
              <ul className="space-y-2">
                {topRecommendation.pros.map((pro, index) => (
                  <li key={index} className="text-green-600 text-sm flex items-center">
                    <span className="mr-2">•</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>

            {/* Considerations */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">💭</span> Consider
              </h3>
              <ul className="space-y-2">
                {topRecommendation.cons.map((con, index) => (
                  <li key={index} className="text-amber-600 text-sm flex items-center">
                    <span className="mr-2">•</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Detailed Analysis */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🔍</span> Expert Analysis
          </h3>
          <div className="prose text-gray-700 leading-relaxed">{detailedAnalysis}</div>
        </div>

        {/* Decision Summary */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">📋</span> Your Decision Factors
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Your Priorities:</h4>
              <ul className="space-y-2">
                {decisionSummary.userPriorities.map((priority, index) => (
                  <li key={index} className="text-gray-600 text-sm flex items-center">
                    <span className="mr-2">🎯</span>
                    {priority}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Key Matching Factors:</h4>
              <ul className="space-y-2">
                {decisionSummary.keyFactors.map((factor, index) => (
                  <li key={index} className="text-gray-600 text-sm flex items-center">
                    <span className="mr-2">🔗</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Alternative Options */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center mb-6">
            <span className="mr-2">🔄</span> Other Strong Options
          </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alternatives.map((alt, index) => {
                // Ensure alt has all required properties with defaults
                const safeAlt = {
                  name: alt?.name || 'Unknown Pump',
                  score: alt?.score || 0,
                  explanation: alt?.explanation || 'No explanation available',
                  keyFeatures: alt?.keyFeatures || []
                };

                return (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-gray-800">{safeAlt.name}</h4>
                      <span className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-600">
                        {safeAlt.score}% Match
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{safeAlt.explanation}</p>
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Key Features:</h5>
                      <ul className="space-y-1">
                        {safeAlt.keyFeatures.slice(0, 3).map((feature, i) => (
                          <li key={i} className="text-xs text-gray-600">
                            • {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>






        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <button
            onClick={handlePrint}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            🖨️ Print Results
          </button>
          <button
            onClick={resetAndStartOver}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            🚀 Start New Assessment
          </button>
        </div>

      </div>
    </div>
  );
}
