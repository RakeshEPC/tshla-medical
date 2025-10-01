import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/pump-report-print.css';

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

interface QAItem {
  question: string;
  answer: string;
  timestamp?: string;
}

export default function PumpDriveHTMLReport() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const [patientName, setPatientName] = useState('');
  const [recommendation, setRecommendation] = useState<PumpRecommendation | LegacyPumpRecommendation | null>(null);
  const [sliderData, setSliderData] = useState<Record<string, number>>({});
  const [featureData, setFeatureData] = useState<any[]>([]);
  const [clarifyingData, setClarifyingData] = useState<Record<string, string>>({});
  const [conversationData, setConversationData] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [assessmentId]);

  const loadReportData = async () => {
    try {
      // Get patient name from session storage or use default
      const storedName = sessionStorage.getItem('pumpDrivePatientName') || '';
      setPatientName(storedName || 'Pump Drive Assessment');

      // Load recommendation data
      const storedRecommendation = sessionStorage.getItem('pumpDriveRecommendation');
      if (storedRecommendation) {
        setRecommendation(JSON.parse(storedRecommendation));
      }

      // Load user preferences
      const storedSliders = sessionStorage.getItem('pumpDriveSliders');
      if (storedSliders) {
        setSliderData(JSON.parse(storedSliders));
      }

      // Load selected features
      const storedFeatures = sessionStorage.getItem('selectedPumpFeatures');
      if (storedFeatures) {
        setFeatureData(JSON.parse(storedFeatures));
      }

      // Load clarifying responses
      const storedClarifying = sessionStorage.getItem('pumpDriveClarifyingResponses');
      if (storedClarifying) {
        setClarifyingData(JSON.parse(storedClarifying));
      }

      // Load conversation history
      const storedConversation = sessionStorage.getItem('pumpDriveConversation');
      if (storedConversation) {
        setConversationData(JSON.parse(storedConversation));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading report data:', error);
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveHTML = () => {
    const htmlContent = document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pump-report-${patientName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExcitingBenefits = (pumpName: string): string[] => {
    const benefits: Record<string, string[]> = {
      'Medtronic 780G': [
        'Most aggressive blood sugar control - wake up with better numbers!',
        'Swim up to 12 feet deep - no more missing pool parties!',
        'AA batteries available everywhere - never worry about charging!',
        'Large 300-unit capacity - fewer interruptions to your day!',
        'Proven track record - thousands of happy users worldwide!'
      ],
      't:slim X2': [
        'Smartphone-like touchscreen - so easy your kids could use it!',
        'Multiple CGM options - freedom to choose what works for you!',
        'Sleek, modern design - looks like a cool tech device!',
        'Loaner program for travel - never stuck without backup!',
        'Regular software updates - your pump gets better over time!'
      ],
      'Tandem Mobi': [
        'Smallest rechargeable pump ever - barely notice you\'re wearing it!',
        'Apple Watch control - manage diabetes right from your wrist!',
        'Ultra-discreet - fits anywhere, visible to no one!',
        'Quick-release feature - perfect for sports and activities!',
        'Modern tech that actually makes diabetes easier!'
      ],
      'Omnipod 5': [
        'Completely tubeless - total freedom of movement!',
        'Waterproof design - swim, shower, exercise without worry!',
        'No buttons to accidentally press - set it and forget it!',
        'Automatic insulin delivery - like having a personal assistant!',
        'Pod system means no pump to drop or break!'
      ],
      'Beta Bionics iLet': [
        'Revolutionary dual-hormone technology - glucagon AND insulin!',
        'Just enter your weight - the simplest setup ever!',
        'Learns your body automatically - gets smarter every day!',
        'Handles both highs AND lows - complete diabetes management!',
        'Future of diabetes care, available today!'
      ],
      'Twiist': [
        'Incredibly lightweight at just 2 ounces - you\'ll forget it\'s there!',
        'Apple Watch bolusing - control everything from your wrist!',
        'Ultra-minimal design - maximum discretion!',
        'Perfect for active lifestyles - built for movement!',
        'Cutting-edge technology in the smallest package!'
      ]
    };

    return benefits[pumpName] || [
      'Automated insulin delivery - freedom from constant management!',
      'Better blood sugar control - feel your best every day!',
      'Modern technology - diabetes care that actually helps!',
      'Improved quality of life - more time for what matters!',
      'Join thousands of happy pump users!'
    ];
  };

  // Helper function to get recommendation data in consistent format
  const getRecommendationData = () => {
    if (!recommendation) return null;

    // Check if it's the new format
    if ('topRecommendation' in recommendation) {
      return {
        topChoice: {
          name: recommendation.topRecommendation.name,
          score: recommendation.topRecommendation.score,
          reasons: recommendation.topRecommendation.pros || []
        },
        alternatives: recommendation.alternatives.map(alt => ({
          name: alt.name,
          score: alt.score,
          reasons: [alt.explanation]
        })),
        keyFactors: recommendation.decisionSummary.userPriorities || [],
        personalizedInsights: recommendation.detailedAnalysis
      };
    }

    // Legacy format
    return recommendation as LegacyPumpRecommendation;
  };

  if (loading) {
    return (
      <div className="report-container">
        <div className="loading-message">Loading your pump report...</div>
      </div>
    );
  }

  const recData = getRecommendationData();

  if (!recData) {
    return (
      <div className="report-container">
        <div className="error-message">
          <h2>No Report Data Found</h2>
          <p>Please complete a pump assessment first.</p>
          <button onClick={() => navigate('/pumpdrive')} className="action-button">
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-container">
      {/* Print Controls - Hidden when printing */}
      <div className="print-controls no-print">
        <button onClick={() => navigate('/pumpdrive/results')} className="back-button">
          ← Back to Results
        </button>
        <div className="print-actions">
          <button onClick={handlePrint} className="print-button">
            🖨️ Print Report
          </button>
          <button onClick={handleSaveHTML} className="save-button">
            💾 Save as HTML
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="report-content">
        {/* Header */}
        <header className="report-header">
          <div className="header-content">
            <h1>Your Perfect Pump Match</h1>
            {patientName && <h2>For: {patientName}</h2>}
            <div className="report-date">
              Generated on {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </header>

        {/* What You Told Us Section */}
        <section className="preferences-section">
          <h2 className="section-title">What You Told Us</h2>

          {Object.keys(sliderData).length > 0 && (
            <div className="preferences-group">
              <h3>Your Top Priorities:</h3>
              <ul className="preferences-list">
                {Object.entries(sliderData)
                  .filter(([_, value]) => value >= 7)
                  .map(([key, value]) => (
                    <li key={key}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}: {value}/10
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {featureData.length > 0 && (
            <div className="preferences-group">
              <h3>Features You Wanted:</h3>
              <ul className="preferences-list">
                {featureData.slice(0, 5).map((feature, index) => (
                  <li key={index}>
                    {feature.name || feature.title || feature || 'Unknown feature'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Page break before recommendation */}
        <div className="page-break"></div>

        {/* Your Perfect Match Section */}
        <section className="recommendation-section">
          <h2 className="section-title">Your Perfect Match</h2>

          <div className="top-recommendation">
            <h3 className="pump-name">{recData.topChoice.name}</h3>
            <div className="match-score">Match Score: {recData.topChoice.score}/100</div>

            <div className="reasons-group">
              <h4>Why This Pump is Perfect for You:</h4>
              <ul className="reasons-list">
                {recData.topChoice.reasons.slice(0, 4).map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Alternative Options */}
          {recData.alternatives && recData.alternatives.length > 0 && (
            <div className="alternatives-section">
              <h4>Alternative Options:</h4>
              {recData.alternatives.slice(0, 2).map((alt, index) => (
                <div key={index} className="alternative-item">
                  <strong>{alt.name}</strong> (Score: {alt.score}/100)
                  {alt.reasons && alt.reasons.length > 0 && (
                    <p>{alt.reasons[0]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Q&A Sections */}
        {Object.keys(clarifyingData).length > 0 && (
          <section className="qa-section">
            <h2 className="section-title">Clarifying Questions We Asked</h2>
            {Object.entries(clarifyingData).map(([question, answer], index) => (
              <div key={index} className="qa-item">
                <div className="question">
                  <strong>Q:</strong> {question}
                </div>
                <div className="answer">
                  <strong>A:</strong> {answer}
                </div>
              </div>
            ))}
          </section>
        )}

        {conversationData.length > 0 && (
          <section className="qa-section">
            <h2 className="section-title">Your Follow-up Questions & Our Full Answers</h2>
            {conversationData.map((qa, index) => (
              <div key={index} className="qa-item">
                <div className="question">
                  <strong>Q:</strong> {qa.question}
                </div>
                <div className="answer">
                  <strong>A:</strong> {qa.answer}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Page break before benefits */}
        <div className="page-break"></div>

        {/* Amazing Benefits Section */}
        <section className="benefits-section">
          <h2 className="section-title benefits-title">Amazing Benefits Waiting for You</h2>

          <ul className="benefits-list">
            {getExcitingBenefits(recData.topChoice.name).map((benefit, index) => (
              <li key={index} className="benefit-item">{benefit}</li>
            ))}
          </ul>

          <div className="encouragement">
            <p className="ready-text">Ready to transform your diabetes management?</p>
            <p className="share-text">Share this report with your healthcare provider to get started!</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="report-footer">
          <div className="footer-content">
            <p>Generated by TSHLA Medical AI</p>
            <p>For more information, visit www.tshla.ai</p>
          </div>
        </footer>
      </div>
    </div>
  );
}