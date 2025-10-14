/**
 * Quality Testing Page
 * Compare and optimize dictation/AI quality
 */

import React, { useState } from 'react';
import { HighQualityDictationService } from '../services/_deprecated/highQualityDictation.service';
import { HighQualityAIService } from '../services/highQualityAI.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

const TEST_CASES = [
  {
    name: "Hypertension Follow-up",
    script: "Patient is here for blood pressure follow up. Blood pressure today is 142 over 88. Has been taking lisinopril 10 milligrams daily. No side effects. No chest pain or shortness of breath. Will increase lisinopril to 20 milligrams daily. Follow up in 3 months.",
    expected: {
      medications: ['lisinopril'],
      vitals: ['142/88'],
      diagnosis: ['hypertension'],
      plan: ['increase', '20mg', '3 months']
    }
  },
  {
    name: "Diabetes Management",
    script: "55 year old with type 2 diabetes. A1C is 8.2. Currently on metformin 1000 milligrams twice daily. Blood sugar logs show fasting glucose 150 to 180. Will add glipizide 5 milligrams daily. Discussed diet and exercise. Follow up in 3 months with repeat A1C.",
    expected: {
      medications: ['metformin', 'glipizide'],
      labs: ['A1C', '8.2'],
      diagnosis: ['diabetes'],
      plan: ['glipizide', '5mg', 'diet', 'exercise']
    }
  }
];

export default function QualityTest() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentSOAP, setCurrentSOAP] = useState<any>(null);
  
  const dictationService = new HighQualityDictationService();
  const aiService = new HighQualityAIService();

  const runQualityTest = async () => {
    setIsTesting(true);
    const results = [];

    // Test transcription quality
    logDebug('QualityTest', 'Debug message', {});
    
    // Test with manual input first
    const manualTest = await testManualTranscript();
    results.push(manualTest);

    // Test AI processing
    logDebug('QualityTest', 'Debug message', {});
    for (const testCase of TEST_CASES) {
      const result = await testAIProcessing(testCase);
      results.push(result);
    }

    setTestResults(results);
    setIsTesting(false);

    // Generate quality report
    generateQualityReport(results);
  };

  const testManualTranscript = async () => {
    const testPhrase = "Patient has hypertension, diabetes mellitus type 2, and hyperlipidemia. Takes metformin 1000 milligrams twice daily, lisinopril 20 milligrams daily, and atorvastatin 40 milligrams at bedtime.";
    
    // Process through dictation corrections
    const corrected = applyMedicalCorrections(testPhrase);
    
    // Check accuracy
    const expectedTerms = ['hypertension', 'diabetes mellitus', 'metformin', 'lisinopril', 'atorvastatin'];
    const foundTerms = expectedTerms.filter(term => 
      corrected.toLowerCase().includes(term.toLowerCase())
    );

    return {
      test: 'Manual Transcription',
      input: testPhrase,
      output: corrected,
      accuracy: foundTerms.length / expectedTerms.length,
      missing: expectedTerms.filter(term => !foundTerms.includes(term))
    };
  };

  const testAIProcessing = async (testCase: any) => {
    const patientContext = {
      name: "Test Patient",
      age: 50,
      mrn: "TEST123",
      visitDate: new Date().toLocaleDateString()
    };

    const soap = await aiService.processTranscriptToSOAP(testCase.script, patientContext);
    
    // Check if expected elements are in SOAP note
    let score = 0;
    let total = 0;
    const found: string[] = [];
    const missing: string[] = [];

    // Check medications
    if (testCase.expected.medications) {
      testCase.expected.medications.forEach((med: string) => {
        total++;
        if (JSON.stringify(soap).toLowerCase().includes(med.toLowerCase())) {
          score++;
          found.push(med);
        } else {
          missing.push(med);
        }
      });
    }

    // Check other elements
    ['vitals', 'diagnosis', 'plan', 'labs'].forEach(category => {
      if (testCase.expected[category]) {
        testCase.expected[category].forEach((item: string) => {
          total++;
          if (JSON.stringify(soap).toLowerCase().includes(item.toLowerCase())) {
            score++;
            found.push(item);
          } else {
            missing.push(`${category}: ${item}`);
          }
        });
      }
    });

    return {
      test: testCase.name,
      input: testCase.script,
      output: soap,
      accuracy: total > 0 ? score / total : 0,
      found,
      missing
    };
  };

  const applyMedicalCorrections = (text: string): string => {
    // Apply the same corrections as the service
    return text
      .replace(/(\d+)\s+over\s+(\d+)/gi, '$1/$2')
      .replace(/(\d+)\s+milligrams?/gi, '$1mg')
      .replace(/times\s+(\d+)/gi, 'x$1');
  };

  const generateQualityReport = (results: any[]) => {
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    
    logDebug('QualityTest', 'Debug message', {});
    logDebug('QualityTest', 'Debug message', {});
    logDebug('QualityTest', 'Debug message', {});
    
    results.forEach(result => {
      logDebug('QualityTest', 'Debug message', {});
      if (result.missing?.length > 0) {
        logDebug('QualityTest', 'Debug message', {});
      }
    });

    // Save configuration if quality is good
    if (avgAccuracy > 0.8) {
      logDebug('QualityTest', 'Debug message', {});
      localStorage.setItem('quality_config', JSON.stringify({
        timestamp: new Date().toISOString(),
        accuracy: avgAccuracy,
        config: 'highQuality'
      }));
    } else {
      logDebug('QualityTest', 'Debug message', {});
    }
  };

  const testLiveDictation = async () => {
    logDebug('QualityTest', 'Debug message', {});
    
    await dictationService.initialize();
    await dictationService.startHighQualityDictation(
      (text, isFinal) => {
        setCurrentTranscript(text);
        if (isFinal) {
          logDebug('QualityTest', 'Debug message', {});
        }
      },
      (error) => {
        logError('QualityTest', 'Error message', {});
      }
    );
  };

  const processCurrentTranscript = async () => {
    if (!currentTranscript) return;

    const patientContext = {
      name: "John Doe",
      age: 45,
      mrn: "12345",
      visitDate: new Date().toLocaleDateString(),
      chiefComplaint: "Follow-up visit",
      medications: ['lisinopril 10mg daily', 'metformin 1000mg BID'],
      conditions: ['Hypertension', 'Type 2 Diabetes']
    };

    const soap = await aiService.processTranscriptToSOAP(currentTranscript, patientContext);
    setCurrentSOAP(soap);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Quality Testing & Optimization</h1>
      
      {/* Quick Test Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Quick Quality Test</h2>
        
        <button
          onClick={runQualityTest}
          disabled={isTesting}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isTesting ? 'Testing...' : 'Run Quality Tests'}
        </button>

        {testResults.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Test Results:</h3>
            {testResults.map((result, idx) => (
              <div key={idx} className="border rounded p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{result.test}</span>
                  <span className={
                    'px-2 py-1 rounded text-sm ' + (
                      result.accuracy > 0.8 ? 'bg-green-100 text-green-800' :
                      result.accuracy > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    )
                  }>
                    {(result.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
                {result.missing?.length > 0 && (
                  <div className="text-sm text-red-600 mt-1">
                    Missing: {result.missing.join(', ')}
                  </div>
                )}
              </div>
            ))}
            
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <strong>Average Accuracy: </strong>
              {(testResults.reduce((sum, r) => sum + r.accuracy, 0) / testResults.length * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Live Testing Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Live Dictation Test</h2>
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={testLiveDictation}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Start Dictation
          </button>
          
          <button
            onClick={() => dictationService.stopDictation()}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Stop Dictation
          </button>
          
          <button
            onClick={processCurrentTranscript}
            disabled={!currentTranscript}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Process with AI
          </button>
        </div>

        {/* Transcript Display */}
        {currentTranscript && (
          <div className="border rounded p-4 mb-4">
            <h3 className="font-semibold mb-2">Transcript:</h3>
            <p className="whitespace-pre-wrap">{currentTranscript}</p>
          </div>
        )}

        {/* SOAP Display */}
        {currentSOAP && (
          <div className="border rounded p-4">
            <h3 className="font-semibold mb-2">SOAP Note:</h3>
            <div className="space-y-3">
              <div>
                <strong>Subjective:</strong>
                <p className="ml-4">{currentSOAP.subjective}</p>
              </div>
              <div>
                <strong>Objective:</strong>
                <p className="ml-4">{currentSOAP.objective}</p>
              </div>
              <div>
                <strong>Assessment:</strong>
                <p className="ml-4">{currentSOAP.assessment}</p>
              </div>
              <div>
                <strong>Plan:</strong>
                <p className="ml-4">{currentSOAP.plan}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">💡 Quality Optimization Tips</h2>
        
        <div className="space-y-2 text-sm">
          <p>✅ <strong>Azure Speech:</strong> Enable dictation mode, increase timeouts, add medical phrases</p>
          <p>✅ <strong>Azure OpenAI:</strong> Use GPT-4 with temperature 0.3 for consistency</p>
          <p>✅ <strong>Audio:</strong> Use high-quality microphone, quiet environment, clear speech</p>
          <p>✅ <strong>Prompts:</strong> Include patient context, clear instructions, examples</p>
          <p>✅ <strong>Post-Processing:</strong> Apply medical corrections, format standardization</p>
        </div>
        
        <div className="mt-4 p-3 bg-white rounded">
          <strong>Current Configuration:</strong>
          <ul className="text-sm mt-2">
            <li>Speech: Azure Cognitive Services (en-US, dictation mode)</li>
            <li>AI: Azure OpenAI GPT-4 (temperature: 0.3)</li>
            <li>Session Timeout: 10s initial, 2s end silence</li>
            <li>Medical Terms: {Object.keys(TEST_CASES).length} test cases configured</li>
          </ul>
        </div>
      </div>
    </div>
  );
}