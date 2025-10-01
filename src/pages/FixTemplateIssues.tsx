import React, { useState } from 'react';
import { fixRInSectionTitles, analyzeRImpact } from '../utils/fixTemplateRIssue';
import { fixCorruptedTemplates } from '../utils/fixCorruptedTemplates';

export default function FixTemplateIssues() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [fixApplied, setFixApplied] = useState(false);
  const [corruptionFixed, setCorruptionFixed] = useState(false);

  const runAnalysis = () => {
    const result = analyzeRImpact();
    setAnalysis(result);
  };

  const applyFix = () => {
    const fixed = fixRInSectionTitles();
    setFixApplied(true);
    // Re-run analysis after fix
    setTimeout(() => {
      runAnalysis();
    }, 100);
  };

  const fixCorruption = () => {
    fixCorruptedTemplates();
    setCorruptionFixed(true);
    // Re-run analysis after fix
    setTimeout(() => {
      runAnalysis();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Template Issue Analyzer & Fixer</h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Template Analysis</h2>

          <div className="space-y-4">
            <button
              onClick={runAnalysis}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
            >
              Analyze Templates for "R:" Issue
            </button>

            {analysis && (
              <div className="mt-6 space-y-4">
                <div
                  className={`p-4 rounded-lg ${analysis.hasRPrefix ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}
                >
                  <h3 className="font-semibold mb-2">
                    {analysis.hasRPrefix ? '⚠️ Issues Found' : '✅ No Issues Found'}
                  </h3>

                  {analysis.affectedTemplates.length > 0 && (
                    <div className="mb-3">
                      <strong>Affected Templates:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {analysis.affectedTemplates.map((template: string) => (
                          <li key={template}>{template}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap text-sm text-gray-700">
                    {analysis.explanation}
                  </div>
                </div>

                {analysis.hasRPrefix && !fixApplied && (
                  <button
                    onClick={applyFix}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600"
                  >
                    Fix "R:" Prefixes in Templates
                  </button>
                )}

                {fixApplied && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    ✅ Fix applied successfully! The "R:" prefixes have been removed from section
                    titles.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Other Template Fixes</h2>

          <div className="space-y-4">
            <div>
              <p className="text-gray-600 mb-3">
                Fix corrupted template sections (removes invalid sections without proper
                title/aiInstructions):
              </p>
              <button
                onClick={fixCorruption}
                className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600"
              >
                Fix Corrupted Templates
              </button>

              {corruptionFixed && (
                <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  ✅ Corruption fix applied! Invalid template sections have been removed.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">How This Affects AI Processing:</h3>
          <p className="text-sm text-gray-700">
            The "R:" prefix in section titles interferes with the AI's ability to:
          </p>
          <ul className="list-disc list-inside mt-2 text-sm text-gray-700">
            <li>Properly categorize medical information into correct sections</li>
            <li>Extract specific data like medications, labs, and follow-up times</li>
            <li>Match dictated content with template section instructions</li>
            <li>Generate clean, professional-looking clinical notes</li>
          </ul>
          <p className="text-sm text-gray-700 mt-2">
            <strong>Answer to your question:</strong> Yes, the "R:" does mess up the AI processing.
            It causes the AI to misidentify sections and fail to apply the correct formatting rules.
          </p>
        </div>
      </div>
    </div>
  );
}
