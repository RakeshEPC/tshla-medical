import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pumpDriveFeatureBasedService } from '../services/pumpDriveFeatureBased.service';
import { pumpDrivePureAI } from '../services/pumpDrivePureAI.service';
import { pumpDriveAIService } from '../services/pumpDriveAI.service';
import { pumpAssessmentService, type AssessmentData } from '../services/pumpAssessment.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { assessmentHistoryService, type StoredAssessment } from '../services/assessmentHistory.service';
import AssessmentDataViewer from '../components/pumpdrive/AssessmentDataViewer';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
import ExpandableEducation, { EducationalCard } from '../components/pumpdrive/ExpandableEducation';
import { HelpIcon } from '../components/pumpdrive/EducationalTooltip';
import {
  resultInterpretation,
  pumpFeatureEducation,
  nextSteps,
  decisionFactorsEducation,
  comparisonEducation,
  importantDisclaimers
} from '../data/pumpEducation';
import { getManufacturerByPumpName } from '../data/pumpManufacturers';

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

  // New state for database assessment data
  const [storedAssessment, setStoredAssessment] = useState<StoredAssessment | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [loadingStoredData, setLoadingStoredData] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [providerEmail, setProviderEmail] = useState('');
  const [patientMessage, setPatientMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // Function to save assessment to database
  const saveAssessmentToDatabase = async (recommendationData: PumpRecommendation) => {
    try {
      logDebug('PumpDriveResults', 'Saving assessment to database', {});

      // Validate recommendation data
      if (!recommendationData?.topRecommendation?.name) {
        console.log('⚠️ Cannot save - recommendation data incomplete');
        logWarn('PumpDriveResults', 'Incomplete recommendation data, skipping save', {});
        return;
      }

      // Get authenticated user with full details from database
      const userResult = await supabaseAuthService.getCurrentUser();
      if (!userResult.success || !userResult.user) {
        logWarn('PumpDriveResults', 'No authenticated user found, skipping database save', {});
        // Store in sessionStorage as fallback
        sessionStorage.setItem('pumpdrive_unsaved_recommendation', JSON.stringify(recommendationData));
        return;
      }

      const currentUser = userResult.user;

      // Use authenticated user's name from database (NOT stale sessionStorage)
      const authenticatedPatientName = currentUser.name || `${currentUser.email}` || `User_${currentUser.id}`;

      console.log('✅ Using authenticated patient name from database:', authenticatedPatientName);
      logInfo('PumpDriveResults', 'Using authenticated patient name', { name: authenticatedPatientName });

      // Collect conversation history
      const existingConversation = JSON.parse(sessionStorage.getItem('pumpDriveConversation') || '[]');

      // Create assessment data with user information
      const assessmentData: AssessmentData = {
        patientName: authenticatedPatientName,
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
        timestamp: new Date().toISOString(),
        // Track top 3 pump recommendations for analytics
        firstChoicePump: recommendationData.topRecommendation.name,
        secondChoicePump: recommendationData.alternatives[0]?.name || null,
        thirdChoicePump: recommendationData.alternatives[1]?.name || null,
        recommendationDate: new Date().toISOString(),
        assessmentVersion: 1 // Will be updated by backend to track retakes
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
        // Clear unsaved fallback
        sessionStorage.removeItem('pumpdrive_unsaved_recommendation');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('⚠️ Assessment save failed (non-blocking):', errorMessage);
      logError('PumpDriveResults', 'Failed to save assessment to database', { error: errorMessage });

      // Check if it's an auth error (401/403)
      if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
        console.log('   Reason: Auth error - storing in sessionStorage as fallback');
        logWarn('PumpDriveResults', 'Authentication error during save - storing locally', {});
        // Store in sessionStorage as fallback so we don't lose the data
        sessionStorage.setItem('pumpdrive_unsaved_recommendation', JSON.stringify(recommendationData));
        // Don't redirect or throw - just continue showing results
        console.log('   ✅ Results will still be shown to user');
      } else {
        console.log('   Reason: Non-auth error - still showing results');
        // Non-auth error - still don't block UI, just log it
        logWarn('PumpDriveResults', 'Non-auth error during save - results still shown', { error: errorMessage });
      }
    }
  };

  useEffect(() => {
    generateRecommendations();
  }, []);

  // Fetch stored assessment from database when assessment ID becomes available
  useEffect(() => {
    const fetchStoredAssessment = async () => {
      const savedAssessmentId = sessionStorage.getItem('pumpdrive_assessment_id');

      if (savedAssessmentId && !storedAssessment) {
        setLoadingStoredData(true);
        try {
          const data = await assessmentHistoryService.getAssessmentById(parseInt(savedAssessmentId));
          if (data) {
            setStoredAssessment(data);
            logInfo('PumpDriveResults', 'Loaded stored assessment from database', {
              assessmentId: savedAssessmentId
            });
          }
        } catch (error) {
          logError('PumpDriveResults', 'Failed to load stored assessment', { error });
          // Fallback to session storage
          const sessionData = assessmentHistoryService.getSessionAssessment();
          if (sessionData) {
            setStoredAssessment(sessionData as StoredAssessment);
          }
        } finally {
          setLoadingStoredData(false);
        }
      }
    };

    // Only fetch if we have an assessment saved
    if (assessmentSaved || sessionStorage.getItem('pumpdrive_assessment_id')) {
      fetchStoredAssessment();
    }
  }, [assessmentSaved, assessmentId]);

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
          console.error('PumpDriveResults: Error details:', {
            message: simplifiedAIError instanceof Error ? simplifiedAIError.message : 'Unknown error',
            type: simplifiedAIError instanceof Error ? simplifiedAIError.constructor.name : typeof simplifiedAIError,
            stack: simplifiedAIError instanceof Error ? simplifiedAIError.stack : 'No stack trace'
          });
          logError('PumpDriveResults', 'API service failed, trying Azure AI directly', { error: simplifiedAIError });

          // Try using Azure AI directly via pumpDriveAIService
          try {
            console.log('PumpDriveResults: Attempting Azure AI fallback via pumpDriveAIService');
            const azureResult = await pumpDriveAIService.processSimplifiedFlow();
            console.log('PumpDriveResults: Azure AI fallback successful:', azureResult);
            console.log('PumpDriveResults: Azure result type:', typeof azureResult);
            console.log('PumpDriveResults: Azure result keys:', Object.keys(azureResult));
            console.log('PumpDriveResults: Azure topRecommendation:', azureResult.topRecommendation);

            // Check if Azure result is already in the correct format
            if (azureResult.topRecommendation && azureResult.topRecommendation.name) {
              console.log('✅ Azure result is in correct format, using directly');
              setRecommendation(azureResult);
            } else {
              console.log('⚠️ Azure result needs conversion');
              // Azure result might be in legacy format, try to convert it
              const convertedResult: PumpRecommendation = {
                topRecommendation: {
                  name: azureResult.topChoice?.name || azureResult.topChoice?.pumpName || 'Omnipod 5',
                  score: azureResult.topChoice?.score || 85,
                  explanation: azureResult.personalizedInsights || 'A great insulin pump option for your needs.',
                  keyFeatures: azureResult.topChoice?.reasons?.slice(0, 3) || ['User-friendly', 'Advanced automation', 'Reliable'],
                  pros: azureResult.topChoice?.reasons || ['Excellent choice for your lifestyle'],
                  cons: ['Consult with your healthcare provider'],
                },
                alternatives: (azureResult.alternatives || []).map((alt: any, index: number) => ({
                  name: alt.name || alt.pumpName || `Alternative ${index + 1}`,
                  score: alt.score || 80,
                  explanation: alt.reasons?.join('. ') || 'Strong alternative option',
                  keyFeatures: alt.reasons?.slice(0, 2) || ['Advanced features'],
                })),
                decisionSummary: {
                  userPriorities: azureResult.keyFactors || ['Your key preferences'],
                  keyFactors: azureResult.keyFactors || [],
                  confidence: 90,
                },
                detailedAnalysis: azureResult.personalizedInsights || '',
              };
              console.log('✅ Converted Azure result:', convertedResult);
              setRecommendation(convertedResult);
            }

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

  const handleEmailToProvider = async () => {
    if (!providerEmail || !assessmentId) {
      alert('Please enter a provider email address');
      return;
    }

    setEmailSending(true);
    try {
      await assessmentHistoryService.emailAssessmentToProvider(
        assessmentId,
        providerEmail,
        patientMessage
      );
      alert('Assessment sent successfully to your healthcare provider!');
      setEmailModalOpen(false);
      setProviderEmail('');
      setPatientMessage('');
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email. Please try again or contact support.');
    } finally {
      setEmailSending(false);
    }
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

        {/* Understanding Your Results Section */}
        <div className="mb-8 space-y-4">
          <EducationalCard title="Understanding Your Results" icon="📖" defaultExpanded={true}>
            <div className="space-y-6">
              {/* Match Score Explanation */}
              <div>
                <div className="flex items-center mb-2">
                  <h4 className="font-bold text-gray-800">{resultInterpretation.matchScore.icon} {resultInterpretation.matchScore.title}</h4>
                  <HelpIcon tooltip="Your match score shows how well this specific pump aligns with YOUR stated priorities and lifestyle." />
                </div>
                <p className="text-gray-700 mb-2">{resultInterpretation.matchScore.description}</p>
                <div className="bg-blue-50 rounded-lg p-4 text-sm">
                  <pre className="whitespace-pre-line font-sans text-gray-600">{resultInterpretation.matchScore.details}</pre>
                </div>
              </div>

              {/* Confidence Score Explanation */}
              <div>
                <div className="flex items-center mb-2">
                  <h4 className="font-bold text-gray-800">{resultInterpretation.confidenceScore.icon} {resultInterpretation.confidenceScore.title}</h4>
                  <HelpIcon tooltip="Confidence reflects how clearly your preferences point to this specific recommendation." />
                </div>
                <p className="text-gray-700 mb-2">{resultInterpretation.confidenceScore.description}</p>
                <div className="bg-purple-50 rounded-lg p-4 text-sm">
                  <pre className="whitespace-pre-line font-sans text-gray-600">{resultInterpretation.confidenceScore.details}</pre>
                </div>
              </div>

              {/* How to Use This Information */}
              <div>
                <div className="flex items-center mb-2">
                  <h4 className="font-bold text-gray-800">{resultInterpretation.howToUse.icon} {resultInterpretation.howToUse.title}</h4>
                </div>
                <p className="text-gray-700 mb-2">{resultInterpretation.howToUse.description}</p>
                <div className="bg-green-50 rounded-lg p-4 text-sm">
                  <pre className="whitespace-pre-line font-sans text-gray-600">{resultInterpretation.howToUse.details}</pre>
                </div>
              </div>

              {/* Important Disclaimer */}
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 mb-1">Important Medical Disclaimer</p>
                    <p className="text-amber-700">{importantDisclaimers.medical}</p>
                  </div>
                </div>
              </div>
            </div>
          </EducationalCard>
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

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
            <p className="text-sm text-blue-800 font-medium mb-1">Why This Pump?</p>
            <p className="text-gray-700 text-lg leading-relaxed">
              {topRecommendation.explanation}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
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

          {/* Educational Feature Explanations */}
          <div className="border-t pt-6 space-y-3">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">📚</span> Learn More About Key Features
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <ExpandableEducation
                title={pumpFeatureEducation.automation.title}
                icon={pumpFeatureEducation.automation.icon}
                summary={pumpFeatureEducation.automation.description}
                details={pumpFeatureEducation.automation.details || ''}
                variant="info"
              />
              <ExpandableEducation
                title={pumpFeatureEducation.cgmCompatibility.title}
                icon={pumpFeatureEducation.cgmCompatibility.icon}
                summary={pumpFeatureEducation.cgmCompatibility.description}
                details={pumpFeatureEducation.cgmCompatibility.details || ''}
                variant="info"
              />
              <ExpandableEducation
                title={pumpFeatureEducation.tubing.title}
                icon={pumpFeatureEducation.tubing.icon}
                summary={pumpFeatureEducation.tubing.description}
                details={pumpFeatureEducation.tubing.details || ''}
                variant="info"
              />
              <ExpandableEducation
                title={pumpFeatureEducation.phoneControl.title}
                icon={pumpFeatureEducation.phoneControl.icon}
                summary={pumpFeatureEducation.phoneControl.description}
                details={pumpFeatureEducation.phoneControl.details || ''}
                variant="info"
              />
            </div>
          </div>
        </div>

        {/* Next Steps Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-8 mb-8 border-2 border-indigo-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-3">🎯</span> Your Next Steps
          </h3>

          {/* Contact Sales Rep Section */}
          {(() => {
            const manufacturerInfo = getManufacturerByPumpName(topRecommendation.name);
            if (manufacturerInfo) {
              return (
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">📞</span> {nextSteps.contactSalesRep.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">{nextSteps.contactSalesRep.description}</p>

                  <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h5 className="text-xl font-bold text-gray-800">{manufacturerInfo.manufacturer}</h5>
                        <p className="text-sm text-gray-600 mt-1">{manufacturerInfo.pumpModels.join(', ')}</p>
                      </div>
                      {manufacturerInfo.demoProgram && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                          Demo Available
                        </span>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Website</p>
                        <a
                          href={manufacturerInfo.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          {manufacturerInfo.website}
                        </a>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Phone</p>
                        <a href={`tel:${manufacturerInfo.phone}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          {manufacturerInfo.phone}
                        </a>
                      </div>
                      {manufacturerInfo.salesEmail && (
                        <div className="md:col-span-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email</p>
                          <a href={`mailto:${manufacturerInfo.salesEmail}`} className="text-blue-600 hover:text-blue-800 underline text-sm">
                            {manufacturerInfo.salesEmail}
                          </a>
                        </div>
                      )}
                    </div>

                    {manufacturerInfo.demoProgram && manufacturerInfo.demoDetails && (
                      <div className="bg-green-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">Demo Program:</span> {manufacturerInfo.demoDetails}
                        </p>
                      </div>
                    )}

                    {manufacturerInfo.specialNotes && manufacturerInfo.specialNotes.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">💡 Helpful Tips:</p>
                        <ul className="space-y-1">
                          {manufacturerInfo.specialNotes.map((note, idx) => (
                            <li key={idx} className="text-xs text-gray-600 flex items-start">
                              <span className="mr-2">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                    <p className="text-xs text-blue-800">
                      <span className="font-semibold">Note:</span> {nextSteps.contactSalesRep.note}
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Questions for Provider */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">❓</span> {nextSteps.questionsForProvider.title}
            </h4>
            <div className="bg-white rounded-lg p-6 shadow">
              <p className="text-sm text-gray-600 mb-4">
                Bring these questions to your appointment to have an informed discussion:
              </p>
              <ol className="space-y-3">
                {nextSteps.questionsForProvider.questions.map((question, index) => (
                  <li key={index} className="flex items-start">
                    <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 text-sm">{question}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* What to Expect */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">📅</span> {nextSteps.whatToExpect.title}
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              {nextSteps.whatToExpect.steps.map((step, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">{step.icon}</span>
                    <h5 className="font-semibold text-gray-800">{step.title}</h5>
                  </div>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Resources */}
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">📚</span> {nextSteps.learningResources.title}
            </h4>
            <p className="text-sm text-gray-600 mb-4">{nextSteps.learningResources.description}</p>
            <div className="space-y-3">
              {nextSteps.learningResources.resources.map((resource, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-indigo-400">
                  <h5 className="font-semibold text-gray-800 mb-1 text-sm">{resource.type}</h5>
                  <p className="text-sm text-gray-600">{resource.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alternative Options */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <span className="mr-2">🔄</span> Other Strong Options
            </h3>
            <HelpIcon tooltip={comparisonEducation.description} />
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-800 mb-2">{comparisonEducation.title}</h4>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {comparisonEducation.guidance}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alternatives.map((alt, index) => {
              // Ensure alt has all required properties with defaults
              const safeAlt = {
                name: alt?.name || 'Unknown Pump',
                score: alt?.score || 0,
                explanation: alt?.explanation || 'No explanation available',
                keyFeatures: alt?.keyFeatures || []
              };

              const scoreDiff = topRecommendation.score - safeAlt.score;

              return (
                <div
                  key={index}
                  className="border-2 border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-800 text-lg">{safeAlt.name}</h4>
                    <div className="flex flex-col items-end">
                      <span className="bg-blue-100 px-2 py-1 rounded text-sm font-semibold text-blue-700">
                        {safeAlt.score}% Match
                      </span>
                      {scoreDiff > 0 && (
                        <span className="text-xs text-gray-500 mt-1">
                          -{scoreDiff}% vs top
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-gray-700 text-sm leading-relaxed">{safeAlt.explanation}</p>
                  </div>

                  <div>
                    <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Key Features:
                    </h5>
                    <ul className="space-y-1.5">
                      {safeAlt.keyFeatures.slice(0, 3).map((feature, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <span className="text-blue-500 mr-2 flex-shrink-0">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 italic">
                      Worth considering if: Your priorities shift, insurance coverage differs, or your healthcare provider has specific experience with this pump.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional disclaimers */}
          <div className="mt-6 space-y-3">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex items-start">
                <span className="text-xl mr-3">💰</span>
                <div className="text-sm">
                  <p className="font-semibold text-yellow-800 mb-1">Insurance Coverage Matters</p>
                  <p className="text-yellow-700">{importantDisclaimers.insurance}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <div className="flex items-start">
                <span className="text-xl mr-3">👤</span>
                <div className="text-sm">
                  <p className="font-semibold text-blue-800 mb-1">Individual Results Vary</p>
                  <p className="text-blue-700">{importantDisclaimers.individual}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Educational Features Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">📚</span> Understanding Insulin Pump Features
          </h3>

          <p className="text-gray-600 mb-6">
            Learn more about important pump features to help you understand your recommendation and prepare for discussions with your healthcare team.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <ExpandableEducation
              title={pumpFeatureEducation.exerciseMode.title}
              icon={pumpFeatureEducation.exerciseMode.icon}
              summary={pumpFeatureEducation.exerciseMode.description}
              details={pumpFeatureEducation.exerciseMode.details || ''}
            />
            <ExpandableEducation
              title={pumpFeatureEducation.batteryType.title}
              icon={pumpFeatureEducation.batteryType.icon}
              summary={pumpFeatureEducation.batteryType.description}
              details={pumpFeatureEducation.batteryType.details || ''}
            />
            <ExpandableEducation
              title={pumpFeatureEducation.reservoirSize.title}
              icon={pumpFeatureEducation.reservoirSize.icon}
              summary={pumpFeatureEducation.reservoirSize.description}
              details={pumpFeatureEducation.reservoirSize.details || ''}
            />
            <ExpandableEducation
              title={pumpFeatureEducation.waterResistance.title}
              icon={pumpFeatureEducation.waterResistance.icon}
              summary={pumpFeatureEducation.waterResistance.description}
              details={pumpFeatureEducation.waterResistance.details || ''}
            />
            <ExpandableEducation
              title={pumpFeatureEducation.bolusSpeed.title}
              icon={pumpFeatureEducation.bolusSpeed.icon}
              summary={pumpFeatureEducation.bolusSpeed.description}
              details={pumpFeatureEducation.bolusSpeed.details || ''}
              variant="tip"
            />
          </div>
        </div>



        {/* View Full Details Section */}
        {(storedAssessment || assessmentSaved) && (
          <div className="mb-8">
            <button
              onClick={() => setShowFullDetails(!showFullDetails)}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:scale-102 transition-all flex items-center justify-center gap-2"
            >
              {showFullDetails ? '📖 Hide' : '📋 View'} Full Assessment Details from Database
              <span className="text-sm">
                {showFullDetails ? '▲' : '▼'}
              </span>
            </button>

            {showFullDetails && (
              <div className="mt-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    📊 Your Complete Assessment Data
                  </h2>
                  {loadingStoredData && (
                    <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                  )}
                </div>

                {storedAssessment ? (
                  <AssessmentDataViewer
                    assessment={storedAssessment}
                    showFullDetails={true}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p>Loading assessment data from database...</p>
                    {!loadingStoredData && (
                      <p className="text-sm mt-2">
                        If data doesn't load, it will use information from your current session.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>✓ Stored in Database:</strong> Your assessment data has been securely saved.
                    You can access this information anytime by logging into your account.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <button
            onClick={handlePrint}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            🖨️ Print / Save as PDF
          </button>

          {assessmentId && (
            <button
              onClick={() => setEmailModalOpen(true)}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              📧 Email to Provider
            </button>
          )}

          <button
            onClick={() => navigate('/pumpdrive/history')}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            📚 View Assessment History
          </button>

          <button
            onClick={resetAndStartOver}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            🚀 Start New Assessment
          </button>
        </div>

        {/* Email Modal */}
        {emailModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  📧 Email Results to Provider
                </h3>
                <button
                  onClick={() => setEmailModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provider's Email Address *
                  </label>
                  <input
                    type="email"
                    value={providerEmail}
                    onChange={(e) => setProviderEmail(e.target.value)}
                    placeholder="doctor@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message to Provider (Optional)
                  </label>
                  <textarea
                    value={patientMessage}
                    onChange={(e) => setPatientMessage(e.target.value)}
                    placeholder="Any additional notes for your healthcare provider..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    This will send a comprehensive email containing your assessment results and AI recommendation to your healthcare provider.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleEmailToProvider}
                    disabled={emailSending || !providerEmail}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {emailSending ? 'Sending...' : 'Send Email'}
                  </button>
                  <button
                    onClick={() => setEmailModalOpen(false)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
