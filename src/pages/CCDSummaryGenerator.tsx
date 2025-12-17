/**
 * CCD Summary Generator Page
 * HIPAA-Compliant CCD file upload and one-page summary generation
 * User provides their own custom OpenAI prompt (no auto-generation)
 */

import { useState, useRef } from 'react';
import { Upload, FileText, Check, AlertCircle, Loader2, User, Calendar, Pill, Activity, Lock, Sparkles } from 'lucide-react';
import ccdParser from '../services/ccdParser.service';
import ccdSummaryAI from '../services/ccdSummaryAI.service';
import type { CCDExtractedData } from '../services/ccdParser.service';
import type { CCDSummary } from '../services/ccdSummaryAI.service';

export default function CCDSummaryGenerator() {
  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [ccdXml, setCcdXml] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsing state
  const [parsing, setParsing] = useState(false);
  const [extractedData, setExtractedData] = useState<CCDExtractedData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Prompt state
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState(false);

  // Summary generation state
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<CCDSummary | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Patient ID (in real app, get from auth context)
  const [patientId] = useState('temp-patient-id-' + Date.now());

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const xmlFile = files.find(f => f.name.endsWith('.xml'));

    if (xmlFile) {
      await handleFileSelect(xmlFile);
    } else {
      setParseError('Please upload an XML file');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setExtractedData(null);
    setSummary(null);
    setParsing(true);

    try {
      // Read file content
      const xmlContent = await ccdParser.readFile(selectedFile);
      setCcdXml(xmlContent);

      // Validate CCD structure
      const validation = ccdParser.validateCCD(xmlContent);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid CCD file');
      }

      // Parse CCD
      const data = await ccdParser.parseCCD(xmlContent);
      setExtractedData(data);

      console.log('✅ CCD file parsed successfully');
    } catch (error) {
      console.error('Parse error:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse CCD file');
    } finally {
      setParsing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!customPrompt.trim()) {
      setGenerationError('Please enter a custom prompt');
      return;
    }

    if (!consentChecked) {
      setGenerationError('Please confirm consent to AI processing');
      return;
    }

    if (!extractedData || !ccdXml || !file) {
      setGenerationError('Please upload a CCD file first');
      return;
    }

    // Validate prompt
    const promptValidation = ccdSummaryAI.validatePrompt(customPrompt);
    if (!promptValidation.valid) {
      setGenerationError(promptValidation.error || 'Invalid prompt');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const result = await ccdSummaryAI.generateSummary({
        patientId,
        customPrompt: customPrompt.trim(),
        extractedData,
        ccdXml,
        fileName: file.name
      });

      setSummary(result.summary);
      console.log('✅ Summary generated:', result.wordCount, 'words');
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setCcdXml('');
    setExtractedData(null);
    setSummary(null);
    setCustomPrompt('');
    setConsentChecked(false);
    setParseError(null);
    setGenerationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSummary = () => {
    if (!summary) return;

    const content = `
CCD SUMMARY
Generated: ${new Date(summary.created_at).toLocaleString()}
Patient: ${extractedData?.demographics?.fullName || 'Unknown'}
Model: ${summary.ai_model}
Word Count: ${summary.word_count}

${summary.summary_text}

---
Custom Prompt Used:
${summary.custom_prompt}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccd-summary-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-4 shadow-lg">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            CCD Summary Generator
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-4">
            Upload your Continuity of Care Document (CCD) and generate a comprehensive one-page summary using AI
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-full inline-flex">
            <Lock className="w-4 h-4" />
            <span className="font-semibold">HIPAA Compliant</span>
          </div>
        </div>

        {/* Step 1: File Upload */}
        {!extractedData && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full text-sm font-bold">1</span>
              Upload CCD File
            </h2>

            <div
              className={`
                border-3 border-dashed rounded-xl p-12 text-center transition-all
                ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'}
                ${parsing ? 'opacity-50 pointer-events-none' : 'hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={handleFileInput}
                className="hidden"
              />

              {parsing ? (
                <div className="space-y-4">
                  <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Parsing CCD File...</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Extracting medical data
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Drop CCD XML file here or click to upload
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Supports CCD/C-CDA XML files from any EMR system
                    </p>
                  </div>
                </div>
              )}
            </div>

            {parseError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Parse Error</p>
                  <p className="text-sm text-red-700 mt-1">{parseError}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Extracted Data */}
        {extractedData && !summary && (
          <div className="space-y-6">
            {/* Demographics Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Information
                </h2>
                <button
                  onClick={resetForm}
                  className="text-sm text-blue-100 hover:text-white transition"
                >
                  Upload Different File
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-semibold text-gray-900">{extractedData.demographics?.fullName || 'Not found'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date of Birth</p>
                  <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {extractedData.demographics?.dateOfBirth || 'Not found'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Gender</p>
                  <p className="text-lg font-semibold text-gray-900">{extractedData.demographics?.gender || 'Not found'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">MRN</p>
                  <p className="text-lg font-semibold text-gray-900">{extractedData.demographics?.mrn || 'Not found'}</p>
                </div>
              </div>
            </div>

            {/* Conditions Card */}
            {extractedData.conditions && extractedData.conditions.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Active Conditions
                    <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                      {extractedData.conditions.length}
                    </span>
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {extractedData.conditions.slice(0, 10).map((condition, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                        <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                        <span className="text-gray-900 font-medium">{condition.name}</span>
                        <span className="ml-auto text-xs text-gray-600">({condition.status})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Medications Card */}
            {extractedData.medications && extractedData.medications.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    Current Medications
                    <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                      {extractedData.medications.length}
                    </span>
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {extractedData.medications.slice(0, 10).map((med, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <Pill className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{med.name}</p>
                          {med.dose && (
                            <p className="text-sm text-gray-600 mt-1">{med.dose}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Custom Prompt Input */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full text-sm font-bold">2</span>
                Enter Your Custom Prompt
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Custom OpenAI Prompt (Your exact instructions - no modifications)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Example: Create a 400-word summary focusing on diabetes management, current medications, and recent lab results. Use simple language suitable for patients. Include action items and follow-up recommendations."
                  className="w-full h-40 rounded-xl bg-white border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all resize-none"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Tip: Specify the target word count (e.g., 400 words) and focus areas in your prompt
                </p>
              </div>

              {/* Consent Checkbox */}
              <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    <strong className="text-gray-900">I consent to AI processing:</strong> I confirm this file contains my medical data and I authorize the use of AI to generate a summary based on my custom prompt. All data is encrypted and HIPAA-compliant.
                  </span>
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateSummary}
                disabled={!customPrompt.trim() || !consentChecked || generating}
                className="w-full rounded-xl px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-semibold text-lg disabled:opacity-50 hover:from-indigo-500 hover:to-purple-600 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Generating Summary...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate One-Page Summary (400 words)
                  </>
                )}
              </button>

              {generationError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Generation Error</p>
                    <p className="text-sm text-red-700 mt-1">{generationError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Display Summary */}
        {summary && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <Check className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-green-900">Summary Generated Successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  Word count: {summary.word_count} | Model: {summary.ai_model}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadSummary}
                  className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition"
                >
                  Download
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition"
                >
                  New Summary
                </button>
              </div>
            </div>

            {/* Summary Display */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4">
                <h2 className="text-xl font-bold text-white">One-Page Summary</h2>
              </div>
              <div className="p-8">
                <div className="prose prose-lg max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-900 leading-relaxed">
                    {summary.summary_text}
                  </pre>
                </div>
              </div>
            </div>

            {/* Prompt Used */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Prompt Used:</h3>
              <p className="text-sm text-gray-600 italic">{summary.custom_prompt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
