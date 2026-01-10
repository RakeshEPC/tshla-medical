import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pumpDriveFeatureBasedService } from '../services/pumpDriveFeatureBased.service';
import { pumpDrivePureAI } from '../services/pumpDrivePureAI.service';
import { pumpDriveAIService } from '../services/pumpDriveAI.service';
import { pumpAssessmentService, type AssessmentData } from '../services/pumpAssessment.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { assessmentHistoryService } from '../services/assessmentHistory.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
import { importantDisclaimers } from '../data/pumpEducation';
import { getManufacturerByPumpName } from '../data/pumpManufacturers';
import { supabase } from '../lib/supabase';
import { stripeService } from '../services/stripe.service';
import { useAuth } from '../contexts/AuthContext';

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
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [recommendation, setRecommendation] = useState<PumpRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [providerEmail, setProviderEmail] = useState('');
  const [patientMessage, setPatientMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/patient-login');
  };

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

  // Check if user has access to view results (clinic or paid)
  const checkAccess = async () => {
    try {
      const userResult = await supabaseAuthService.getCurrentUser();
      if (!userResult.success || !userResult.user) {
        // Not logged in - redirect to login
        navigate('/patient-login');
        return;
      }

      // Get user's most recent assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('pump_assessments')
        .select('id, access_type, payment_status')
        .eq('patient_id', userResult.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (assessmentError || !assessment) {
        // No assessment found - redirect to questionnaire
        logWarn('PumpDriveResults', 'No assessment found, redirecting to questionnaire', {});
        navigate('/pumpdrive/assessment');
        return;
      }

      // Check if coming back from Stripe payment
      const paidParam = searchParams.get('paid');
      const sessionId = searchParams.get('session_id');

      if (paidParam === 'true' && sessionId) {
        // Verify payment with backend
        try {
          await stripeService.verifyPayment(sessionId);
          logInfo('PumpDriveResults', 'Payment verified successfully', { sessionId });
        } catch (err) {
          logError('PumpDriveResults', 'Payment verification failed', { error: err });
        }
        // Continue - payment status will be updated by webhook
      }

      // Check access: clinic (free) or paid
      const hasAccess =
        assessment.access_type === 'clinic' ||
        (assessment.access_type === 'independent' && assessment.payment_status === 'paid');

      if (!hasAccess) {
        // No access yet - redirect to access gate
        logInfo('PumpDriveResults', 'Access not granted, redirecting to access gate', {
          accessType: assessment.access_type,
          paymentStatus: assessment.payment_status
        });
        navigate('/pumpdrive/access');
        return;
      }

      // Access granted!
      setAccessGranted(true);
      setAssessmentId(assessment.id);
      logInfo('PumpDriveResults', 'Access granted - showing results', {
        accessType: assessment.access_type
      });
    } catch (err) {
      logError('PumpDriveResults', 'Error checking access', { error: err });
      setError('Unable to verify access. Please try again.');
    } finally {
      setCheckingAccess(false);
    }
  };

  // Check access first before loading results
  useEffect(() => {
    checkAccess();
  }, []);

  // Only generate recommendations after access is granted
  useEffect(() => {
    if (accessGranted && !hasAttempted) {
      generateRecommendations();
    }
  }, [accessGranted]);

  // Fetch stored assessment from database when assessment ID becomes available
  useEffect(() => {
    const fetchStoredAssessment = async () => {
      const savedAssessmentId = sessionStorage.getItem('pumpdrive_assessment_id');

      if (savedAssessmentId) {
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

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Verifying Access</h2>
          <p className="text-gray-600">Please wait while we check your access...</p>
        </div>
      </div>
    );
  }

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
    alternatives = []
  } = recommendation || {};

  // Prepare all 3 pumps for display
  const allPumps = [
    {
      rank: 1,
      icon: '🏆',
      name: topRecommendation.name,
      score: topRecommendation.score,
      explanation: topRecommendation.explanation,
      pros: topRecommendation.pros.slice(0, 3),
      cons: topRecommendation.cons.slice(0, 2),
    },
    ...(alternatives.slice(0, 2).map((alt, index) => ({
      rank: index + 2,
      icon: index === 0 ? '🥈' : '🥉',
      name: alt.name,
      score: alt.score,
      explanation: alt.explanation,
      pros: alt.keyFeatures?.slice(0, 3) || [],
      cons: [`${topRecommendation.score - alt.score}% lower match than top choice`],
    })))
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Logout Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Your Pump Recommendations
          </h1>
          <p className="text-gray-600 text-lg">
            Top 3 matches based on your preferences
          </p>
        </div>

        {/* Side-by-Side Pump Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allPumps.map((pump) => {
            const manufacturer = getManufacturerByPumpName(pump.name);

            return (
              <div
                key={pump.rank}
                className={`bg-white rounded-2xl shadow-lg p-6 border-2 ${
                  pump.rank === 1
                    ? 'border-green-500 ring-2 ring-green-200'
                    : 'border-gray-200'
                } transition-all hover:shadow-xl`}
              >
                {/* Rank Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl">{pump.icon}</span>
                  <div className={`px-3 py-1 rounded-full font-semibold text-sm ${
                    pump.rank === 1
                      ? 'bg-green-100 text-green-800'
                      : pump.rank === 2
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {pump.score}% Match
                  </div>
                </div>

                {/* Pump Name */}
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {pump.name}
                </h3>

                {/* Why This Pump */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    {pump.rank === 1 ? 'Why it\'s your #1 match:' : 'Why consider this:'}
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {pump.explanation.substring(0, 150)}
                    {pump.explanation.length > 150 ? '...' : ''}
                  </p>
                </div>

                {/* Pros */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    ✅ Best for you:
                  </p>
                  <ul className="space-y-1.5">
                    {pump.pros.map((pro, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start">
                        <span className="text-green-500 mr-2 mt-0.5">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cons */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    💭 Consider:
                  </p>
                  <ul className="space-y-1.5">
                    {pump.cons.map((con, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start">
                        <span className="text-amber-500 mr-2 mt-0.5">•</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contact Info */}
                {manufacturer && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Contact Manufacturer:
                    </p>
                    <div className="space-y-1">
                      <a
                        href={`tel:${manufacturer.phone}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium block"
                      >
                        📞 {manufacturer.phone}
                      </a>
                      <a
                        href={manufacturer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm block truncate"
                      >
                        🌐 {manufacturer.website.replace('https://', '')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Questions for Your Doctor */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-3">💬</span>
            Questions for Your Doctor
          </h2>
          <p className="text-gray-600 mb-6">
            Bring these to your appointment for an informed discussion:
          </p>
          <ol className="space-y-3">
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-700 font-bold rounded-full w-7 h-7 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-0.5">
                1
              </span>
              <span className="text-gray-700">
                Is <strong>{topRecommendation.name}</strong> right for my specific diabetes needs?
              </span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-700 font-bold rounded-full w-7 h-7 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-0.5">
                2
              </span>
              <span className="text-gray-700">
                Will my insurance cover this pump, and are there any out-of-pocket costs?
              </span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-700 font-bold rounded-full w-7 h-7 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-0.5">
                3
              </span>
              <span className="text-gray-700">
                When can I start, and what training will I receive?
              </span>
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <button
            onClick={handlePrint}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            🖨️ Print / Save PDF
          </button>

          {assessmentId && (
            <button
              onClick={() => setEmailModalOpen(true)}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              📧 Email to Doctor
            </button>
          )}

          <button
            onClick={resetAndStartOver}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            🔄 Retake Assessment
          </button>
        </div>

        {/* Footer Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-800">
            <strong>⚠️ Important:</strong> {importantDisclaimers.medical}
          </p>
        </div>

        {/* Email Modal */}
        {emailModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  📧 Email Results to Doctor
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
                    Doctor's Email *
                  </label>
                  <input
                    type="email"
                    value={providerEmail}
                    onChange={(e) => setProviderEmail(e.target.value)}
                    placeholder="doctor@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={patientMessage}
                    onChange={(e) => setPatientMessage(e.target.value)}
                    placeholder="Any notes for your doctor..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleEmailToProvider}
                    disabled={emailSending || !providerEmail}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
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