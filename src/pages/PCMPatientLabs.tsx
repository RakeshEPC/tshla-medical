/**
 * PCM Patient Labs - Patient Lab Results View
 * View lab results, trends, and upcoming tests
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  Beaker,
  Download,
  CheckCircle2,
  Info,
  Activity
} from 'lucide-react';
import { pcmService } from '../services/pcm.service';

export default function PCMPatientLabs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || 'demo-patient-001';

  const [results, setResults] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLabData();
  }, [patientId]);

  useEffect(() => {
    if (selectedTest) {
      loadTrends(selectedTest);
    }
  }, [selectedTest]);

  const loadLabData = async () => {
    setIsLoading(true);
    try {
      const [resultsData, scheduleData] = await Promise.all([
        pcmService.getLabResults(patientId),
        pcmService.getLabSchedule(patientId)
      ]);
      setResults(resultsData);
      setSchedule(scheduleData);
    } catch (error) {
      console.error('Error loading lab data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrends = async (testName: string) => {
    try {
      const trendData = await pcmService.getLabTrends(patientId, testName, 12);
      setTrends(trendData);
    } catch (error) {
      console.error('Error loading trends:', error);
    }
  };

  const getResultColor = (abnormal?: boolean) => {
    return abnormal ? 'text-red-600' : 'text-green-600';
  };

  const getResultBgColor = (abnormal?: boolean) => {
    return abnormal ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200';
  };

  const groupResultsByTest = () => {
    const grouped = new Map<string, any[]>();
    results.forEach(result => {
      const existing = grouped.get(result.testName) || [];
      grouped.set(result.testName, [...existing, result]);
    });
    return Array.from(grouped.entries()).map(([testName, results]) => ({
      testName,
      latest: results[0],
      history: results
    }));
  };

  const getTestExplanation = (testName: string) => {
    const explanations: Record<string, string> = {
      'Hemoglobin A1C': 'Average blood sugar over the past 2-3 months. Goal: <7% for most diabetics.',
      'LDL Cholesterol': 'Bad cholesterol. Lower is better. Goal: <100 mg/dL.',
      'HDL Cholesterol': 'Good cholesterol. Higher is better. Goal: >40 mg/dL for men, >50 for women.',
      'Triglycerides': 'Type of fat in blood. Goal: <150 mg/dL.',
      'eGFR': 'Kidney function test. Higher is better. >60 is normal.',
      'Comprehensive Metabolic Panel': 'Checks kidney function, electrolytes, and blood sugar.',
      'Lipid Panel': 'Measures cholesterol and triglycerides.',
      'TSH': 'Thyroid function. Normal range: 0.5-5.0 mIU/L.'
    };
    return explanations[testName] || 'Important lab test for monitoring your health.';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your lab results...</p>
        </div>
      </div>
    );
  }

  const groupedResults = groupResultsByTest();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/pcm/patient')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Lab Results</h1>
                <p className="text-sm text-gray-600">View your test results and trends</p>
              </div>
            </div>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Upcoming Labs */}
        {schedule.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Upcoming Labs
            </h2>
            <p className="text-blue-100 mb-4">Don't forget these scheduled tests</p>
            <div className="space-y-2">
              {schedule.slice(0, 3).map((item) => (
                <div key={item.id} className="bg-white bg-opacity-20 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{item.testName}</div>
                    <div className="text-xs text-blue-100">Every {item.frequency}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">Due: {new Date(item.nextDueDate).toLocaleDateString()}</div>
                    <div className="text-xs text-blue-100">
                      {Math.ceil((new Date(item.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lab Results */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Beaker className="w-5 h-5 text-purple-600" />
            Your Recent Results
          </h3>

          {groupedResults.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No lab results yet</h3>
              <p className="text-gray-600">Your lab results will appear here once they're available</p>
            </div>
          ) : (
            groupedResults.map(({ testName, latest, history }) => (
              <div
                key={testName}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer hover:shadow-md transition ${
                  selectedTest === testName ? 'border-purple-500' : 'border-transparent'
                }`}
                onClick={() => setSelectedTest(selectedTest === testName ? null : testName)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-lg">{testName}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <Info className="w-4 h-4" />
                      <span>{getTestExplanation(testName)}</span>
                    </div>
                  </div>
                  {latest.abnormalFlag && (
                    <div className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-full">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-semibold">Abnormal</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className={`rounded-lg p-4 border-2 ${getResultBgColor(latest.abnormalFlag)}`}>
                    <div className="text-xs text-gray-600 mb-1">Latest Result</div>
                    <div className={`text-2xl font-bold ${getResultColor(latest.abnormalFlag)}`}>
                      {latest.resultValue}
                    </div>
                    <div className="text-xs text-gray-600">{latest.unit}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Reference Range</div>
                    <div className="text-sm font-semibold text-gray-900">{latest.referenceRange}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Date</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {new Date(latest.resultDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Status</div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-gray-900">Final</span>
                    </div>
                  </div>
                </div>

                {/* Trend History */}
                {selectedTest === testName && history.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-600" />
                        Result History
                      </h5>
                      {history.length >= 2 && (
                        <div className="flex items-center gap-1">
                          {parseFloat(history[0].resultValue) < parseFloat(history[1].resultValue) ? (
                            <>
                              <TrendingDown className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-semibold text-green-600">Improving</span>
                            </>
                          ) : parseFloat(history[0].resultValue) > parseFloat(history[1].resultValue) ? (
                            <>
                              <TrendingUp className="w-5 h-5 text-red-600" />
                              <span className="text-sm font-semibold text-red-600">Worsening</span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-gray-600">Stable</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {history.slice(0, 5).map((result, idx) => (
                        <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${result.abnormalFlag ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            <div>
                              <div className="font-semibold text-gray-900">{result.resultValue} {result.unit}</div>
                              <div className="text-xs text-gray-600">{new Date(result.resultDate).toLocaleDateString()}</div>
                            </div>
                          </div>
                          {result.abnormalFlag && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">Abnormal</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Educational Info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Understanding Your Labs
          </h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
              <div>
                <span className="font-semibold">Normal results</span> mean your values are within the healthy range
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
              <div>
                <span className="font-semibold">Abnormal results</span> are outside the normal range and may need attention
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
              <div>
                If you have questions about your results, please <button onClick={() => navigate('/pcm/messages')} className="text-purple-600 font-semibold hover:underline">message your care team</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
