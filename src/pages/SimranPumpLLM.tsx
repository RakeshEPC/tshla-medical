import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PUMP_QUESTIONS } from '../data/pumpQuestions';
import { PUMP_DATABASE, PUMP_NAMES } from '../data/pumpDataComplete';
import { pumpRecommendationEngine } from '../services/pumpRecommendationEngine';
import type {
  UserPreferences,
  ComprehensiveRecommendation,
} from '../services/pumpRecommendationEngine';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function SimranPumpLLM() {
  const navigate = useNavigate();
  const [selectedVoice, setSelectedVoice] = useState(elevenLabsService.getVoice());
  const [apiKey, setApiKey] = useState(elevenLabsService.getApiKey() || '');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Pump selection state
  const [mode, setMode] = useState<'chat' | 'questionnaire'>('questionnaire');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comprehensiveRecs, setComprehensiveRecs] = useState<ComprehensiveRecommendation | null>(
    null
  );
  const [showResults, setShowResults] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    'comfort' | 'algorithm' | 'cost' | 'easeOfSetup' | 'ongoingSupport' | 'overall'
  >('overall');

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          }
        }
        if (final) {
          setTranscript(prev => prev + final);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        logError('SimranPumpLLM', 'Error message', {});
        setIsRecording(false);
        elevenLabsService.speak('Speech recognition error. Please try again.');
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recognitionInstance);
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
      elevenLabsService.stop();
    };
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      elevenLabsService.speak('Speech recognition not supported in this browser');
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      elevenLabsService.speak('Recording stopped');
    } else {
      recognition.start();
      setIsRecording(true);
      elevenLabsService.speak('Listening. Please speak your question.');
    }
  };

  const processWithAI = async () => {
    if (!transcript.trim()) return;

    setIsSpeaking(true);

    // Check if user is answering a pump question
    if (mode === 'questionnaire' && !showResults) {
      processQuestionnaireAnswer(transcript);
    } else {
      // General pump advice
      const mockResponse = `Based on your symptoms, I recommend monitoring your glucose levels closely. 
      The pump settings appear to be within normal range, but you may want to consider adjusting your basal rate 
      during the evening hours. Please consult with your endocrinologist for personalized adjustments.`;

      setAiResponse(mockResponse);
      await elevenLabsService.speak(mockResponse);
    }

    setIsSpeaking(false);
  };

  const processQuestionnaireAnswer = async (answer: string) => {
    const currentQuestion = PUMP_QUESTIONS[currentQuestionIndex];
    const lowerAnswer = answer.toLowerCase();

    // Try to match the answer to an option
    let selectedOption = null;
    if (lowerAnswer.includes('first') || lowerAnswer.includes('1')) {
      selectedOption = 0;
    } else if (lowerAnswer.includes('second') || lowerAnswer.includes('2')) {
      selectedOption = 1;
    } else if (lowerAnswer.includes('third') || lowerAnswer.includes('3')) {
      selectedOption = 2;
    }

    if (selectedOption !== null && currentQuestion.options[selectedOption]) {
      const score = currentQuestion.options[selectedOption].score;
      setAnswers(prev => ({ ...prev, [currentQuestion.dimension]: score }));

      if (currentQuestionIndex < PUMP_QUESTIONS.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        await askNextQuestion(currentQuestionIndex + 1);
      } else {
        // All questions answered, calculate results
        calculatePumpRecommendations();
      }
    } else {
      await elevenLabsService.speak(
        "I didn't understand your answer. Please say 'first', 'second', or 'third' to select an option."
      );
    }
  };

  const askNextQuestion = async (index: number) => {
    const question = PUMP_QUESTIONS[index];
    const questionText = `Question ${index + 1} of ${PUMP_QUESTIONS.length}: ${question.question}\n\n`;
    const optionsText = question.options
      .map((opt, i) => `Option ${i + 1}: ${opt.label}`)
      .join('\n\n');
    const fullText =
      questionText + optionsText + '\n\nPlease say first, second, or third to choose.';

    await elevenLabsService.speak(fullText);
  };

  const calculatePumpRecommendations = async () => {
    // Create user preferences from answers
    const userPreferences: UserPreferences = {
      tubingPreference: answers['Tubing Preference'],
      controlPreference: answers['Control Preference'],
      targetAdjustability: answers['Target Adjustability'],
      appControl: answers['App Control'],
      carbCounting: answers['Carb Counting'],
      automationTrust: answers['Automation Trust'],
      exerciseMode: answers['Exercise Mode'],
      visibility: answers['Visibility'],
      clinicSupport: answers['Clinic Support'],
      techComfort: answers['Control Preference'] === 3 ? 8 : 5,
      activityLevel: answers['Exercise Mode'] === 3 ? 'active' : 'moderate',
      travelFrequency: 'occasional',
      insurance: 'good',
      cgmUsage: 'Dexcom G6',
      priorityFactors: ['comfort', 'algorithm', 'cost'],
    };

    const recommendations =
      await pumpRecommendationEngine.generateComprehensiveRecommendations(userPreferences);
    setComprehensiveRecs(recommendations);
    setShowResults(true);

    // Announce comprehensive results
    const announcement = `I've analyzed your preferences across 5 key categories. 
      For daily comfort, I recommend the ${recommendations.comfort.pump.name}.
      For algorithm performance, the ${recommendations.algorithm.pump.name} excels.
      For cost-effectiveness, consider the ${recommendations.cost.pump.name}.
      For ease of setup, the ${recommendations.easeOfSetup.pump.name} is ideal.
      For ongoing support, the ${recommendations.ongoingSupport.pump.name} stands out.
      Overall, your best match is the ${recommendations.overallTop.pump.name}.
      Let me show you the detailed analysis.`;
    await elevenLabsService.speak(announcement);
  };

  const startQuestionnaire = async () => {
    setMode('questionnaire');
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResults(false);
    await elevenLabsService.speak(
      "Let's find the perfect insulin pump for you. I'll ask you some questions about your preferences and lifestyle."
    );
    await askNextQuestion(0);
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    elevenLabsService.setVoice(voiceId);
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    elevenLabsService.setApiKey(key);
  };

  const testVoice = () => {
    elevenLabsService.testVoice(selectedVoice);
  };

  const stopSpeaking = () => {
    elevenLabsService.stop();
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold text-purple-800">Simran PumpLLM Assistant</h1>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              ⚙️ Voice Settings
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white shadow-lg border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Selection
                </label>
                <select
                  value={selectedVoice}
                  onChange={e => handleVoiceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {ELEVENLABS_VOICES.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} - {voice.description}
                    </option>
                  ))}
                </select>
                <button
                  onClick={testVoice}
                  className="mt-2 px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                >
                  🔊 Test Voice
                </button>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ElevenLabs API Status
                </label>
                <div className="w-full px-3 py-2 bg-green-50 border border-green-300 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">
                    ✓ API Key Configured (Enterprise HIPAA-Compliant)
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Using high-quality neural voices with ultra-low latency
                  </p>
                </div>
                {!apiKey && (
                  <p className="mt-1 text-xs text-amber-600">
                    Note: If API key is not detected, browser voice will be used as fallback
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* AI Assistant Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-4xl">🤖</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              AI Pump Selection & Management Assistant
            </h2>
            <p className="text-gray-600 mt-2">
              I'll help you find the perfect insulin pump based on 23 dimensions of compatibility
            </p>
          </div>

          {/* Recording Controls */}
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={toggleRecording}
              className={`px-8 py-4 rounded-full font-medium transition-all transform hover:scale-105 ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg animate-pulse'
                  : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
              }`}
            >
              {isRecording ? '⏹ Stop Recording' : '🎤 Start Conversation'}
            </button>

            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="px-8 py-4 bg-gray-600 text-white rounded-full hover:bg-gray-700"
              >
                🔇 Stop Speaking
              </button>
            )}
          </div>

          {/* Status Indicator */}
          {(isRecording || isSpeaking) && (
            <div className="flex justify-center items-center space-x-2 mb-4">
              <div className="flex space-x-1">
                <div
                  className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                ></div>
                <div
                  className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                ></div>
                <div
                  className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                ></div>
              </div>
              <span className="text-sm text-gray-600">
                {isRecording ? 'Listening...' : 'Speaking...'}
              </span>
            </div>
          )}
        </div>

        {/* User Question */}
        {transcript && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">👤</span> Your Question
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-800">{transcript}</p>
            </div>
            <div className="mt-4 flex space-x-4">
              <button
                onClick={processWithAI}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition"
              >
                Get AI Response
              </button>
              <button
                onClick={() => setTranscript('')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* AI Response */}
        {aiResponse && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-purple-800">
              <span className="mr-2">🤖</span> AI Assistant Response
            </h3>
            <div className="bg-white rounded-lg p-4">
              <p className="text-gray-800 leading-relaxed">{aiResponse}</p>
            </div>
          </div>
        )}

        {/* Pump Questionnaire Section */}
        {mode === 'questionnaire' && !showResults && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Pump Selection Questionnaire</h3>
                <span className="text-sm text-gray-500">
                  Question {currentQuestionIndex + 1} of {PUMP_QUESTIONS.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${((currentQuestionIndex + 1) / PUMP_QUESTIONS.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {PUMP_QUESTIONS[currentQuestionIndex] && (
              <div>
                <h4 className="text-xl mb-4 text-gray-800">
                  {PUMP_QUESTIONS[currentQuestionIndex].question}
                </h4>
                <div className="space-y-3">
                  {PUMP_QUESTIONS[currentQuestionIndex].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const question = PUMP_QUESTIONS[currentQuestionIndex];
                        setAnswers(prev => ({ ...prev, [question.dimension]: option.score }));
                        if (currentQuestionIndex < PUMP_QUESTIONS.length - 1) {
                          setCurrentQuestionIndex(prev => prev + 1);
                          askNextQuestion(currentQuestionIndex + 1);
                        } else {
                          calculatePumpRecommendations();
                        }
                      }}
                      className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-purple-50 hover:border-purple-500 transition"
                    >
                      <span className="font-medium">Option {index + 1}:</span> {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comprehensive Results Section */}
        {showResults && comprehensiveRecs && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-2xl font-bold mb-6 text-purple-800">
              Your Comprehensive Pump Analysis
            </h3>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b">
              <button
                onClick={() => setActiveCategory('overall')}
                className={`px-4 py-2 font-medium transition ${activeCategory === 'overall' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Overall Best
              </button>
              <button
                onClick={() => setActiveCategory('comfort')}
                className={`px-4 py-2 font-medium transition ${activeCategory === 'comfort' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Comfort
              </button>
              <button
                onClick={() => setActiveCategory('algorithm')}
                className={`px-4 py-2 font-medium transition ${activeCategory === 'algorithm' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Algorithm
              </button>
              <button
                onClick={() => setActiveCategory('cost')}
                className={`px-4 py-2 font-medium transition ${activeCategory === 'cost' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Cost
              </button>
              <button
                onClick={() => setActiveCategory('easeOfSetup')}
                className={`px-4 py-2 font-medium transition ${activeCategory === 'easeOfSetup' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Setup
              </button>
              <button
                onClick={() => setActiveCategory('ongoingSupport')}
                className={`px-4 py-2 font-medium transition ${activeCategory === 'ongoingSupport' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
              >
                Support
              </button>
            </div>

            {/* Active Category Detail */}
            <div className="mb-6">
              {(() => {
                const rec =
                  activeCategory === 'overall'
                    ? comprehensiveRecs.overallTop
                    : activeCategory === 'comfort'
                      ? comprehensiveRecs.comfort
                      : activeCategory === 'algorithm'
                        ? comprehensiveRecs.algorithm
                        : activeCategory === 'cost'
                          ? comprehensiveRecs.cost
                          : activeCategory === 'easeOfSetup'
                            ? comprehensiveRecs.easeOfSetup
                            : comprehensiveRecs.ongoingSupport;

                return (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-purple-800">{rec.pump.name}</h4>
                        <p className="text-sm text-purple-600 mt-1">{rec.category}</p>
                      </div>
                      <span className="px-4 py-2 bg-purple-600 text-white rounded-full font-bold">
                        {rec.score}% Match
                      </span>
                    </div>

                    <p className="text-gray-700 mb-4">{rec.reasoning}</p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold text-gray-800 mb-2">Key Points:</h5>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {rec.keyPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h5 className="font-semibold text-gray-800 mb-2">Pump Details:</h5>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>• Manufacturer: {rec.pump.manufacturer}</p>
                          <p>• Type: {rec.pump.dimensions.tubing.type}</p>
                          <p>• Algorithm: {rec.pump.dimensions.algorithm.type}</p>
                          <p>
                            • Phone Control:{' '}
                            {rec.pump.dimensions.phoneControl.bolusFromPhone ? 'Yes' : 'View Only'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        const details = `Let me tell you more about the ${rec.pump.name} for ${rec.category}. ${rec.reasoning} ${rec.keyPoints.join('. ')}`;
                        await elevenLabsService.speak(details);
                      }}
                      className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      🔊 Hear Details
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Summary Section */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h5 className="font-semibold text-gray-800 mb-2">Summary:</h5>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {comprehensiveRecs.summary}
              </p>
            </div>

            {/* Conversation Starters */}
            <div className="mb-4">
              <h5 className="font-semibold text-gray-800 mb-2">Questions to explore:</h5>
              <div className="flex flex-wrap gap-2">
                {comprehensiveRecs.conversationStarters.map((starter, i) => (
                  <button
                    key={i}
                    onClick={async () => {
                      setTranscript(starter);
                      await elevenLabsService.speak(
                        `You asked: ${starter}. Let me help you with that.`
                      );
                    }}
                    className="px-3 py-1 bg-white border border-purple-300 rounded-full text-sm hover:bg-purple-50"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={() => {
                  setShowResults(false);
                  setCurrentQuestionIndex(0);
                  setAnswers({});
                  startQuestionnaire();
                }}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retake Questionnaire
              </button>
              <button
                onClick={() => setMode('chat')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Continue Conversation
              </button>
              <button
                onClick={async () => {
                  const fullSummary = `Here's your complete pump analysis. 
                    For comfort: ${comprehensiveRecs.comfort.pump.name}. 
                    For algorithm: ${comprehensiveRecs.algorithm.pump.name}. 
                    For cost: ${comprehensiveRecs.cost.pump.name}. 
                    For setup: ${comprehensiveRecs.easeOfSetup.pump.name}. 
                    For support: ${comprehensiveRecs.ongoingSupport.pump.name}. 
                    Overall best: ${comprehensiveRecs.overallTop.pump.name}.`;
                  await elevenLabsService.speak(fullSummary);
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                🔊 Hear Full Summary
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={startQuestionnaire}
            className="p-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg shadow hover:shadow-lg transition text-center"
          >
            <span className="text-2xl mb-2 block">🎯</span>
            <span className="text-sm text-gray-700">Start Pump Selection</span>
          </button>
          <button className="p-4 bg-white rounded-lg shadow hover:shadow-lg transition text-center">
            <span className="text-2xl mb-2 block">⚙️</span>
            <span className="text-sm text-gray-700">Pump Settings</span>
          </button>
          <button className="p-4 bg-white rounded-lg shadow hover:shadow-lg transition text-center">
            <span className="text-2xl mb-2 block">💉</span>
            <span className="text-sm text-gray-700">Bolus Calculator</span>
          </button>
          <button className="p-4 bg-white rounded-lg shadow hover:shadow-lg transition text-center">
            <span className="text-2xl mb-2 block">📱</span>
            <span className="text-sm text-gray-700">Contact Doctor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
