import React, { useState, useEffect } from 'react';
import { shareService } from '../services/shareService';

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

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: PumpRecommendation;
  assessmentId?: number | null;
  patientName?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  recommendation,
  assessmentId,
  patientName
}: ShareModalProps) {
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isWebShareSupported, setIsWebShareSupported] = useState(false);

  useEffect(() => {
    setIsWebShareSupported(shareService.isWebShareSupported());
  }, []);

  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  const handleCopySuccess = (message: string) => {
    setCopySuccess(message);
  };

  const handleNativeShare = async () => {
    const success = await shareService.shareNative(recommendation, assessmentId, patientName);
    if (success) {
      onClose();
    }
  };

  const handleCopyRecommendation = async () => {
    const success = await shareService.copyRecommendation(recommendation, assessmentId, patientName);
    if (success) {
      handleCopySuccess('Recommendation copied to clipboard!');
    }
  };

  const handleCopyUrl = async () => {
    const success = await shareService.copyUrl(assessmentId);
    if (success) {
      handleCopySuccess('Link copied to clipboard!');
    }
  };

  const handleEmailShare = () => {
    shareService.shareViaEmail(recommendation, assessmentId, patientName);
    onClose();
  };

  const handleSocialShare = (platform: 'twitter' | 'facebook') => {
    shareService.shareOnSocial(platform, recommendation, assessmentId);
    onClose();
  };

  const handleDownload = () => {
    shareService.downloadAsText(recommendation, assessmentId, patientName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <span className="mr-2">📤</span>
              Share Your Results
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Share your {recommendation.topRecommendation.name} recommendation
          </p>
        </div>

        {/* Copy Success Message */}
        {copySuccess && (
          <div className="mx-6 mt-4 p-3 bg-green-100 border border-green-400 rounded-lg text-green-700 text-sm">
            ✅ {copySuccess}
          </div>
        )}

        {/* Share Options */}
        <div className="p-6 space-y-4">
          {/* Native Share (Mobile) */}
          {isWebShareSupported && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">📱</span>
                <div className="text-left">
                  <div className="font-semibold text-gray-800">Share</div>
                  <div className="text-sm text-gray-600">Open share menu</div>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          )}

          {/* Copy Recommendation */}
          <button
            onClick={handleCopyRecommendation}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200 rounded-lg transition-colors"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">📋</span>
              <div className="text-left">
                <div className="font-semibold text-gray-800">Copy Summary</div>
                <div className="text-sm text-gray-600">Copy recommendation text</div>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyUrl}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 rounded-lg transition-colors"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">🔗</span>
              <div className="text-left">
                <div className="font-semibold text-gray-800">Copy Link</div>
                <div className="text-sm text-gray-600">Share report URL</div>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Email */}
          <button
            onClick={handleEmailShare}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 border border-yellow-200 rounded-lg transition-colors"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">📧</span>
              <div className="text-left">
                <div className="font-semibold text-gray-800">Email</div>
                <div className="text-sm text-gray-600">Send via email</div>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-slate-50 hover:from-gray-100 hover:to-slate-100 border border-gray-200 rounded-lg transition-colors"
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">💾</span>
              <div className="text-left">
                <div className="font-semibold text-gray-800">Download</div>
                <div className="text-sm text-gray-600">Save as text file</div>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Social Media */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Social Media</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSocialShare('twitter')}
                className="flex items-center justify-center p-3 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg transition-colors"
              >
                <span className="mr-2">🐦</span>
                Twitter
              </button>
              <button
                onClick={() => handleSocialShare('facebook')}
                className="flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-colors"
              >
                <span className="mr-2">📘</span>
                Facebook
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            Share responsibly. Always consult with your healthcare provider for medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}