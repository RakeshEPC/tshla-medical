/**
 * @deprecated This component is DEPRECATED
 * Use PumpDriveUnified instead (src/pages/PumpDriveUnified.tsx)
 *
 * This standalone feature selection page has been integrated into PumpDriveUnified.
 *
 * Migration: Replace all references to PumpFeatureSelection with PumpDriveUnified
 * See DEPRECATED.md for full migration guide
 *
 * This file will be moved to src/legacy/ in Phase 2 and removed in Phase 3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PUMP_FEATURES, FEATURE_CATEGORIES, type PumpFeature } from '../data/pumpFeatures';
import { logWarn } from '../services/logger.service';

const PumpFeatureSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());

  // ⚠️ DEPRECATION WARNING
  useEffect(() => {
    logWarn('⚠️ DEPRECATION WARNING: PumpFeatureSelection is DEPRECATED');
    logWarn('Please use PumpDriveUnified instead (src/pages/PumpDriveUnified.tsx)');
    logWarn('This component will be moved to src/legacy/ and eventually removed');
    logWarn('See DEPRECATED.md for migration guide');
    console.warn('%c⚠️ DEPRECATED COMPONENT', 'color: orange; font-size: 16px; font-weight: bold');
    console.warn('%cPumpFeatureSelection is deprecated. Use PumpDriveUnified instead.', 'color: orange');
    console.warn('See DEPRECATED.md for migration guide');
  }, []);
  
  const handleFeatureToggle = (featureId: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(featureId)) {
      newSelected.delete(featureId);
    } else {
      newSelected.add(featureId);
    }
    setSelectedFeatures(newSelected);
  };

  const handleContinue = () => {
    // Save selections and continue to sliders
    const selectedFeaturesData = Array.from(selectedFeatures).map(id => 
      PUMP_FEATURES.find(f => f.id === id)
    ).filter(Boolean) as PumpFeature[];
    
    sessionStorage.setItem('selectedPumpFeatures', JSON.stringify(selectedFeaturesData));
    navigate('/pumpdrive/sliders');
  };

  // Group features by category for better organization
  const featuresByCategory = PUMP_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, PumpFeature[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            ✨ What Sounds Amazing to You?
          </h1>
          <p className="text-xl text-gray-600">
            Pick one or more features that would make your life better
          </p>
          <p className="text-lg text-gray-500 mt-2">
            (We'll match you with pumps that have what you want)
          </p>
          <div className="w-24 h-1 bg-purple-500 mx-auto mt-4 rounded"></div>
        </div>

        {/* Feature Categories */}
        <div className="space-y-8 mb-8">
          {Object.entries(featuresByCategory).map(([category, features]) => (
            <div key={category} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              {/* Category Header */}
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">{FEATURE_CATEGORIES[category as keyof typeof FEATURE_CATEGORIES].icon}</span>
                <h2 className="text-xl font-semibold text-gray-800">
                  {FEATURE_CATEGORIES[category as keyof typeof FEATURE_CATEGORIES].name}
                </h2>
              </div>

              {/* Features Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    onClick={() => handleFeatureToggle(feature.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all transform hover:scale-105 ${
                      selectedFeatures.has(feature.id)
                        ? 'border-purple-500 bg-purple-50 shadow-lg'
                        : 'border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-25'
                    }`}
                  >
                    {/* Feature Header */}
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{feature.emoji}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedFeatures.has(feature.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedFeatures.has(feature.id) && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                    </div>

                    {/* Feature Content */}
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-xs leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <button
            onClick={handleContinue}
            className={`px-12 py-4 rounded-2xl text-xl font-semibold transition-all transform ${
              selectedFeatures.size > 0
                ? 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 shadow-lg'
                : 'bg-gray-300 text-gray-500'
            }`}
          >
            {selectedFeatures.size > 0 
              ? `✨ Continue with ${selectedFeatures.size} feature${selectedFeatures.size > 1 ? 's' : ''} selected`
              : '🤔 Pick what interests you, then continue'
            }
          </button>

          <div className="text-center">
            <button
              onClick={() => navigate('/pumpdrive/sliders')}
              className="text-gray-500 hover:text-gray-700 underline text-sm"
            >
              Skip this step →
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="text-center mt-8">
          <div className="text-sm text-gray-500">
            Step 1 of 3: Feature Preferences  
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2 max-w-md mx-auto">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
          </div>
        </div>

        {/* Selection Summary */}
        {selectedFeatures.size > 0 && (
          <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">
              🎯 You're interested in: ({selectedFeatures.size} features)
            </h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedFeatures).map(featureId => {
                const feature = PUMP_FEATURES.find(f => f.id === featureId);
                return feature ? (
                  <span
                    key={featureId}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center"
                  >
                    <span className="mr-1">{feature.emoji}</span>
                    {feature.title}
                    <button
                      onClick={() => handleFeatureToggle(featureId)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PumpFeatureSelection;