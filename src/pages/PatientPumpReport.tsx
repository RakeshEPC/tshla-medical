import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patient.service';
import type { Patient, PersonalizedReport, PumpRecommendation } from '../types/patient.types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function PatientPumpReport() {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [report, setReport] = useState<PersonalizedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    const currentPatient = patientService.getCurrentPatient();

    if (!currentPatient) {
      navigate('/patient-login');
      return;
    }

    setPatient(currentPatient);

    // Check if report already exists
    if (currentPatient.programs.pumpdrive?.personalReport) {
      setReport(currentPatient.programs.pumpdrive.personalReport);
    } else if (currentPatient.programs.pumpdrive?.finalRecommendations) {
      // Generate report if we have recommendations but no report yet
      generatePersonalizedReport(currentPatient);
    } else {
      // No recommendations yet, redirect to pump journey
      navigate('/pumpdrive');
    }
  };

  const generatePersonalizedReport = async (patient: Patient) => {
    setIsGenerating(true);

    try {
      const recommendations = patient.programs.pumpdrive?.finalRecommendations;
      if (!recommendations || recommendations.length === 0) return;

      // Generate personalized insights using AI
      const prompt = `
        Generate a warm, encouraging, and highly personalized pump report for ${patient.firstName}.
        
        Their top pump choice is: ${recommendations[0].pumpName}
        Match score: ${recommendations[0].matchScore}%
        
        Key reasons for this choice:
        ${recommendations[0].keyReasons.join('\n')}
        
        Create:
        1. A personal message (2-3 sentences) that acknowledges their journey and celebrates their decision
        2. 3-4 specific strengths you noticed about them during the selection process
        3. 3-4 success predictors - why they'll do great with this pump
        4. 5 practical tips for getting started with their new pump
        
        Make it extremely positive, personal, and confidence-building. Use their name and refer to specific things they shared.
        Format as JSON with fields: personalMessage, strengthsIdentified[], successPredictors[], gettingStartedGuide[]
      `;

      const aiResponse = await azureAIService.generateSoapNote(prompt, '');
      const encouragement = JSON.parse(aiResponse);

      const newReport: PersonalizedReport = {
        reportId: `report_${Date.now()}`,
        generatedAt: new Date().toISOString(),
        patientName: `${patient.firstName} ${patient.lastName}`,

        journeySummary: {
          categoriesCompleted: patient.programs.pumpdrive?.completedCategories || [],
          totalTimeSpent: 45, // Estimate
          inputMethods: {
            'Budget & Insurance': 'voice',
            Lifestyle: 'voice',
            'Control Preferences': 'voice',
            'Getting Started': 'voice',
            'Daily Use': 'voice',
            'Support System': 'voice',
          },
          completionDate: new Date().toISOString(),
        },

        personalProfile: {
          topPriorities: [
            'Simplicity in daily management',
            'Reliable insulin delivery',
            'Strong support system',
            'Insurance coverage',
          ],
          lifestyleFactors: [
            'Active lifestyle with regular exercise',
            'Frequent travel for work',
            'Family involvement in care',
          ],
          medicalConsiderations: [
            'Type 1 diabetes for 10+ years',
            'Good glucose awareness',
            'No significant complications',
          ],
          uniqueNeeds: [
            'Prefers minimal daily interruptions',
            'Values discretion in public settings',
            'Needs reliable customer support',
          ],
        },

        recommendations: {
          topChoice: {
            pump: recommendations[0],
            whyPerfectForYou: [
              `This pump aligns perfectly with your active lifestyle, ${patient.firstName}`,
              'Its simplicity matches your preference for straightforward management',
              'The support system is exactly what you said you needed',
              'Insurance coverage makes this an affordable choice for your family',
            ],
            successTips: encouragement.gettingStartedGuide || [
              'Start with the basics - master one feature at a time',
              'Set up your support team early - include family members',
              'Use the first month to establish your routine',
              'Take advantage of all training resources',
              'Celebrate small wins as you learn',
            ],
            gettingStartedGuide: [
              'Contact your insurance for final approval',
              'Schedule training with a certified pump trainer',
              'Download the mobile app and explore features',
              'Join the online community for your pump model',
              'Set realistic goals for your first 30 days',
            ],
          },
          alternativeChoice: recommendations[1]
            ? {
                pump: recommendations[1],
                whenToConsider: [
                  'If insurance coverage changes',
                  'If you want more advanced features later',
                  'If your lifestyle becomes more variable',
                ],
                tradeoffs: [
                  'Slightly more complex but more features',
                  'Higher upfront cost but better long-term value',
                  'Steeper learning curve but more flexibility',
                ],
              }
            : undefined,
        },

        encouragement: {
          personalMessage:
            encouragement.personalMessage ||
            `${patient.firstName}, you've made an incredibly thoughtful decision! Your careful consideration of each factor shows you're ready for this next step in your diabetes journey. We're confident you'll thrive with your new pump.`,
          strengthsIdentified: encouragement.strengthsIdentified || [
            'Your clarity about what matters most to you',
            'Your realistic approach to daily management',
            'Your strong support system and family involvement',
            'Your positive attitude toward technology',
          ],
          successPredictors: encouragement.successPredictors || [
            `You've already shown great diabetes self-management skills`,
            'Your organized approach will make the transition smooth',
            'Your support system is ready to help you succeed',
            'Your motivation and commitment are clearly strong',
          ],
          nextSteps: [
            'Share this report with your endocrinologist',
            'Contact the pump company to start the process',
            'Review insurance requirements and documentation',
            'Schedule your pump start date and training',
          ],
        },

        visualData: {
          categoryRadarChart: recommendations[0].categoryScores || {},
          pumpComparisonChart: null,
          journeyTimeline: null,
        },
      };

      setReport(newReport);

      // Save report to patient record
      patientService.savePersonalizedReport(patient.internalId, newReport);
    } catch (error) {
      logError('PatientPumpReport', 'Error message', {});
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${patient?.firstName}_Pump_Report.pdf`);
    } catch (error) {
      logError('PatientPumpReport', 'Error message', {});
    }
  };

  const shareViaEmail = () => {
    const subject = 'My Insulin Pump Selection Report';
    const body = `I've completed my pump selection journey with TSHLA Medical! My recommended pump is ${report?.recommendations.topChoice.pump.pumpName}.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const printReport = () => {
    window.print();
  };

  if (!patient || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">
            {isGenerating ? 'Creating your personalized report...' : 'Loading your report...'}
          </p>
        </div>
      </div>
    );
  }

  const topChoice = report.recommendations.topChoice;
  const altChoice = report.recommendations.alternativeChoice;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header Actions */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <span className="mr-2">←</span> Back to Dashboard
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={downloadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <span className="mr-2">📥</span> Download PDF
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
                >
                  <span className="mr-2">📤</span> Share
                </button>

                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border">
                    <button
                      onClick={shareViaEmail}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center"
                    >
                      <span className="mr-2">📧</span> Email
                    </button>
                    <button
                      onClick={printReport}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center"
                    >
                      <span className="mr-2">🖨️</span> Print
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-3xl p-8 text-white mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">🎉 Congratulations, {patient.firstName}!</h1>
            <p className="text-xl mb-6">{report.encouragement.personalMessage}</p>
            <div className="inline-flex items-center bg-white/20 backdrop-blur rounded-full px-6 py-3">
              <span className="text-2xl mr-3">🏆</span>
              <div className="text-left">
                <div className="font-semibold">Your Perfect Match</div>
                <div className="text-2xl font-bold">{topChoice.pump.pumpName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Why This Pump Is Perfect For You */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="text-3xl mr-3">✨</span>
            Why {topChoice.pump.pumpName} Is Perfect For You
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {topChoice.whyPerfectForYou.map((reason, idx) => (
              <div key={idx} className="flex items-start">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-600 font-bold">{idx + 1}</span>
                </div>
                <p className="ml-4 text-gray-700">{reason}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-blue-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Match Score</div>
                <div className="text-3xl font-bold text-blue-600">{topChoice.pump.matchScore}%</div>
              </div>
              <div className="text-6xl">🎯</div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full"
                  style={{ width: `${topChoice.pump.matchScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Your Strengths */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="text-3xl mr-3">💪</span>
            Your Strengths We Noticed
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {report.encouragement.strengthsIdentified.map((strength, idx) => (
              <div
                key={idx}
                className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200"
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{['🌟', '💎', '🚀', '⭐'][idx] || '✨'}</span>
                  <p className="text-gray-800 font-medium">{strength}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why You'll Succeed */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="text-3xl mr-3">🎯</span>
            Why You'll Succeed
          </h2>

          <div className="space-y-4">
            {report.encouragement.successPredictors.map((predictor, idx) => (
              <div key={idx} className="flex items-start p-4 bg-green-50 rounded-lg">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="ml-3 text-gray-700">{predictor}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Getting Started Guide */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="text-3xl mr-3">🚀</span>
            Your Personal Getting Started Guide
          </h2>

          <div className="space-y-3">
            {topChoice.gettingStartedGuide.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">{idx + 1}</span>
                </div>
                <p className="ml-4 text-gray-700">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center">
              <span className="text-2xl mr-3">💡</span>
              <p className="text-gray-700">
                <strong>Pro Tip:</strong> Take your time with each step. There's no rush - going at
                your own pace will help you feel confident and in control.
              </p>
            </div>
          </div>
        </div>

        {/* Alternative Option */}
        {altChoice && (
          <div className="bg-gray-50 rounded-2xl p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-3">🔄</span>
              Alternative Option: {altChoice.pump.pumpName}
            </h3>
            <p className="text-gray-600 mb-4">
              While {topChoice.pump.pumpName} is our top recommendation, {altChoice.pump.pumpName}
              could be a great alternative if your needs change.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">When to Consider</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {altChoice.whenToConsider.map((when, idx) => (
                    <li key={idx}>• {when}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <span className="text-3xl mr-3">📋</span>
            Your Next Steps
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {report.encouragement.nextSteps.map((step, idx) => (
              <div key={idx} className="flex items-center p-3 bg-white/20 backdrop-blur rounded-lg">
                <input type="checkbox" className="w-5 h-5 mr-3" id={`step-${idx}`} />
                <label htmlFor={`step-${idx}`} className="cursor-pointer">
                  {step}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full mb-4">
            <span className="text-5xl">🎊</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            You've Got This, {patient.firstName}!
          </h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Remember, choosing an insulin pump is a big step, and you've done an amazing job
            thinking through what matters most to you. We're here to support you every step of the
            way. Your success is our success!
          </p>

          <div className="mt-8 space-x-4">
            <button
              onClick={() => navigate('/patient/chat')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700"
            >
              Chat with AVA About Your Report
            </button>
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
