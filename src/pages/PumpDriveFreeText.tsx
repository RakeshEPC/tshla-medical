/**
 * @deprecated This component is DEPRECATED
 * Use PumpDriveUnified instead (src/pages/PumpDriveUnified.tsx)
 *
 * This free-text assessment flow has been superseded by PumpDriveUnified,
 * which includes conversational AI functionality.
 *
 * Migration: Replace all references to PumpDriveFreeText with PumpDriveUnified
 * See DEPRECATED.md for full migration guide
 *
 * This file will be moved to src/legacy/ in Phase 2 and removed in Phase 3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { freeTextMCPService } from '../services/freeTextMCP.service';
import { logWarn } from '../services/logger.service';

interface FreeTextData {
  currentSituation: string;
  timestamp: string;
}

const PumpDriveFreeText: React.FC = () => {
  const navigate = useNavigate();
  const [freeText, setFreeText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // ⚠️ DEPRECATION WARNING
  useEffect(() => {
    logWarn('⚠️ DEPRECATION WARNING: PumpDriveFreeText is DEPRECATED');
    logWarn('Please use PumpDriveUnified instead (src/pages/PumpDriveUnified.tsx)');
    logWarn('This component will be moved to src/legacy/ and eventually removed');
    logWarn('See DEPRECATED.md for migration guide');
    console.warn('%c⚠️ DEPRECATED COMPONENT', 'color: orange; font-size: 16px; font-weight: bold');
    console.warn('%cPumpDriveFreeText is deprecated. Use PumpDriveUnified instead.', 'color: orange');
    console.warn('See DEPRECATED.md for migration guide');
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setFreeText(text);
    setCharCount(text.length);
  };

  const handleSubmit = async () => {
    if (!freeText.trim()) {
      alert('Please share your thoughts before continuing.');
      return;
    }

    setIsSaving(true);
    
    try {
      // Generate session ID
      const sessionId = freeTextMCPService.generateSessionId();
      
      // Analyze the text
      const analysis = freeTextMCPService.analyzeText(freeText);
      
      // Save to MCP server
      await freeTextMCPService.saveFreeTextResponse(sessionId, freeText.trim(), analysis);
      
      // Save to session storage for backward compatibility
      const freeTextData: FreeTextData = {
        currentSituation: freeText.trim(),
        timestamp: new Date().toISOString()
      };
      
      sessionStorage.setItem('pumpDriveFreeText', JSON.stringify(freeTextData));
      sessionStorage.setItem('freeTextSessionId', sessionId);
      
      console.log('✅ Free text saved successfully');
      
      // Navigate to next step
      navigate('/pumpdrive/results');
      
    } catch (error) {
      console.error('❌ Error saving free text:', error);
      alert('Error saving your response. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Save empty response but still track that user was here
    const freeTextData: FreeTextData = {
      currentSituation: '',
      timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('pumpDriveFreeText', JSON.stringify(freeTextData));
    navigate('/pumpdrive/results');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            💭 Share Your Story
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Tell us what you like or don't like about your current situation and any fears or excitement about going on a new pump
          </p>
          <div className="w-24 h-1 bg-purple-500 mx-auto mt-4 rounded"></div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
          {/* Prompt */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="text-3xl mr-3">🗣️</span>
              Your Current Experience
            </h2>
            <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-400">
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>We'd love to hear from you:</strong>
              </p>
              <ul className="space-y-2 text-gray-700">
                <li>• What do you like or dislike about your current diabetes management?</li>
                <li>• What concerns or fears do you have about switching to a new pump?</li>
                <li>• What are you most excited about with a potential new pump?</li>
                <li>• Any specific challenges or goals you'd like to address?</li>
              </ul>
            </div>
          </div>

          {/* Text Area */}
          <div className="mb-6">
            <label htmlFor="freeText" className="block text-sm font-medium text-gray-700 mb-3">
              Share your thoughts (optional but helpful for better recommendations):
            </label>
            <textarea
              id="freeText"
              value={freeText}
              onChange={handleTextChange}
              placeholder="Take your time and share whatever feels important to you. There are no right or wrong answers - we just want to understand your unique situation better..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-700 leading-relaxed"
              maxLength={2000}
            />
            
            {/* Character Counter */}
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-500">
                {charCount === 0 ? 'Feel free to write as much or as little as you\'d like' : 'Thank you for sharing your thoughts'}
              </span>
              <span className={`${charCount > 1800 ? 'text-orange-500' : 'text-gray-400'}`}>
                {charCount}/2000 characters
              </span>
            </div>
          </div>

          {/* Benefits of Sharing */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
            <h3 className="text-sm font-semibold text-green-800 mb-2">💡 Why this helps:</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• More personalized pump recommendations</p>
              <p>• Better understanding of your specific needs and concerns</p>
              <p>• Tailored advice for your transition process</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleSkip}
              className="px-8 py-3 rounded-xl text-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
            >
              ⏭️ Skip for Now
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className={`px-8 py-3 rounded-xl text-lg font-semibold transition-all transform ${
                isSaving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 shadow-lg'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  💾 Saving...
                </span>
              ) : (
                '🎯 Continue to Recommendations'
              )}
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="text-center">
          <div className="text-sm text-gray-500">
            Step 2 of 3: Personal Story
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2 max-w-md mx-auto">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '67%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PumpDriveFreeText;