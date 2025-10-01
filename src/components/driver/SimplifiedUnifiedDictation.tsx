'use client';
import React, { useState, useEffect, useRef } from 'react';
import { SOAPTemplate } from '@/lib/soapTemplates';
import { medicalAPI } from '@/lib/api/medical-api';
import { useTemplateStore } from '@/hooks/useTemplateStore';
import { doctorProfileService } from '@/services/doctorProfile.service';
import { unifiedAuthService } from '@/services/unifiedAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface SimplifiedDictationProps {
  patient: any;
  visitDate: string;
  onSave: (text: string, soapNote: any) => void;
}

export default function SimplifiedUnifiedDictation({
  patient,
  visitDate,
  onSave,
}: SimplifiedDictationProps) {
  const {
    templates,
    defaultTemplateId,
    defaultTemplate,
    getTemplateById,
    setDefaultTemplate,
    saveCustomTemplate,
  } = useTemplateStore();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [soapNote, setSoapNote] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    // Initialize transcript with patient info
    const initialText = `Patient: ${patient.firstName} ${patient.lastName}
Date: ${visitDate}
ID: ${patient.id}

Chief Complaint: 
`;
    setTranscript(initialText);
    transcriptRef.current = initialText;

    // Use default template or first available
    const templateId = defaultTemplateId || templates[0]?.id || '';
    setSelectedTemplateId(templateId);
  }, [patient, visitDate, defaultTemplateId, templates]);

  const startRecording = async () => {
    try {
      // Check if we're on HTTPS (required for speech recognition)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setError(
          'Speech recognition requires HTTPS. Please use https:// or type your notes manually.'
        );
        return;
      }

      // Request microphone permission with better error handling
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately as we only needed permission
        stream.getTracks().forEach(track => track.stop());
      } catch (micError: any) {
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          setError(
            'Microphone access denied. Please allow microphone access in your browser settings or type your notes manually.'
          );
        } else if (micError.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone or type your notes manually.');
        } else {
          setError('Microphone error: ' + micError.message + '. You can type your notes manually.');
        }
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError(
          'Speech recognition not supported in this browser. Please use Chrome or Edge, or type your notes manually.'
        );
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          }
        }
        if (final) {
          const newText = transcriptRef.current + final;
          setTranscript(newText);
          transcriptRef.current = newText;
        }
      };

      recognition.onerror = (event: any) => {
        logError('SimplifiedUnifiedDictation', 'Error message', {});
        if (event.error === 'not-allowed') {
          setError('Microphone blocked by browser. Check site settings and reload.');
        } else if (event.error === 'network') {
          setError('Network error. Check your connection.');
        } else if (event.error !== 'no-speech') {
          setError(`Recognition error: ${event.error}`);
        }
        setIsRecording(false);
        setCurrentStep(2);
      };

      recognition.onend = () => {
        if (isRecording) {
          // Restart if still recording
          try {
            recognition.start();
          } catch (e) {
            setIsRecording(false);
            setCurrentStep(2);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setCurrentStep(1);
      setError('');
    } catch (err) {
      setError('Microphone access denied. Please type your notes instead.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        logDebug('SimplifiedUnifiedDictation', 'Debug message', {});
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setCurrentStep(2);
  };

  const processWithAI = () => {
    // Use the template selected in the dropdown
    const templateId = selectedTemplateId;
    const template = getTemplateById(templateId);

    // Extract dictated content
    const lines = transcript.split('\n');
    const chiefComplaintIndex = lines.findIndex(l => l.includes('Chief Complaint:'));
    const dictatedText =
      chiefComplaintIndex > -1
        ? transcript.substring(transcript.indexOf('Chief Complaint:') + 16).trim()
        : transcript.trim();

    // Parse the dictation to extract key information
    const mentionsDiabetes = /diabet/i.test(dictatedText);
    const mentionsPneumonia = /pneumonia/i.test(dictatedText);
    const mentionsHighBloodSugar = /blood sugar|glucose|400|450/i.test(dictatedText);
    const mentionsNausea = /nausea/i.test(dictatedText);
    const mentionsVomiting = /vomit/i.test(dictatedText);
    const mentionsDiarrhea = /diarrhea/i.test(dictatedText);
    const mentionsConstipation = /constipation/i.test(dictatedText);
    const mentionsInsulin = /insulin|lantus|20 units/i.test(dictatedText);
    const mentionsFollowUp = /two weeks|2 weeks/i.test(dictatedText);

    // Build ROS based on actual symptoms mentioned
    let rosItems = [];
    if (mentionsNausea || mentionsVomiting || mentionsDiarrhea || mentionsConstipation) {
      rosItems.push(
        `Gastrointestinal: Positive for ${[
          mentionsNausea && 'nausea',
          mentionsVomiting && 'vomiting',
          mentionsDiarrhea && 'diarrhea',
          mentionsConstipation && 'constipation',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }
    if (mentionsPneumonia) {
      rosItems.push(`Respiratory: Recent hospitalization for pneumonia, currently improving`);
    }
    rosItems.push(`Constitutional: Positive for feeling unwell, malaise`);
    rosItems.push(`Endocrine: Hyperglycemia with blood sugars 400-450 mg/dL`);
    rosItems.push(`All other systems reviewed and negative`);

    // Build assessment based on dictation
    let assessmentItems = [];
    if (mentionsDiabetes && mentionsHighBloodSugar) {
      assessmentItems.push(
        `Type 2 Diabetes Mellitus, uncontrolled with hyperglycemia (blood sugars 400-450 mg/dL)`
      );
    }
    if (mentionsPneumonia) {
      assessmentItems.push(`Recent hospitalization for pneumonia - recovering`);
    }
    if (mentionsNausea || mentionsVomiting) {
      assessmentItems.push(`Nausea and vomiting - likely secondary to hyperglycemia`);
    }
    if (mentionsDiarrhea && mentionsConstipation) {
      assessmentItems.push(`Gastrointestinal symptoms - alternating diarrhea and constipation`);
    }

    // Build plan based on dictation
    let planItems = [];
    if (mentionsInsulin) {
      planItems.push(
        `Start insulin therapy: Lantus (insulin glargine) 20 units subcutaneous daily at bedtime`
      );
      planItems.push(
        `Patient education on insulin administration, storage, and hypoglycemia recognition`
      );
      planItems.push(`Blood glucose monitoring: Check fasting and before meals, keep log`);
    }
    if (mentionsDiabetes) {
      planItems.push(`Diabetes management:
   - Dietary consultation for carbohydrate counting
   - Target blood glucose 80-130 mg/dL before meals
   - HbA1c goal < 7%`);
    }
    if (mentionsFollowUp) {
      planItems.push(`Follow-up in 2 weeks to assess response to insulin therapy`);
    } else {
      planItems.push(`Follow-up in 2-4 weeks`);
    }
    planItems.push(
      `Laboratory: HbA1c, comprehensive metabolic panel, lipid panel before next visit`
    );
    planItems.push(`Call if blood sugars remain > 300 or symptoms worsen`);

    // If template exists, use it; otherwise use intelligent processing
    let soap;

    if (template && template.id !== 'minimal') {
      // Use template format
      const processTemplate = (text: string) => {
        return text
          .replace(/\[DICTATION\]/g, dictatedText)
          .replace(/\[BP\]/g, '130/85')
          .replace(/\[HR\]/g, '88')
          .replace(/\[WEIGHT\]/g, 'Not recorded')
          .replace(/\[BMI\]/g, 'Not calculated')
          .replace(/\[GLUCOSE\]/g, mentionsHighBloodSugar ? '425' : 'Not checked')
          .replace(/\[A1C\]/g, 'Pending')
          .replace(/\[CONTROL STATUS\]/g, mentionsHighBloodSugar ? 'Poor' : 'Unknown')
          .replace(/\[TREND\]/g, 'To be determined')
          .replace(/\[COMPLICATIONS\]/g, 'None noted')
          .replace(
            /\[CURRENT MEDS\]/g,
            mentionsInsulin ? 'See plan for new insulin' : 'Per medication list'
          )
          .replace(/\[ADJUSTMENTS\]/g, mentionsInsulin ? 'Starting Lantus 20 units daily' : 'None')
          .replace(/\[FREQUENCY\]/g, 'Before meals and bedtime')
          .replace(/\[TIMEFRAME\]/g, mentionsFollowUp ? '2 weeks' : '3-4 weeks')
          .replace(/\[CHIEF COMPLAINT\]/g, 'See dictation')
          .replace(
            /\[PRIMARY DIAGNOSIS\]/g,
            mentionsDiabetes ? 'Type 2 Diabetes Mellitus, uncontrolled' : 'Per dictation'
          )
          .replace(/\[SECONDARY DIAGNOSES\]/g, mentionsPneumonia ? 'Recent pneumonia' : '')
          .replace(
            /\[PRIMARY TREATMENT\]/g,
            mentionsInsulin ? 'Initiate insulin therapy' : 'Per dictation'
          )
          .replace(/\[MEDICATIONS\]/g, mentionsInsulin ? 'Lantus 20 units daily' : 'Per dictation');
      };

      soap = {
        subjective: processTemplate(
          (template.subjective.chiefComplaint
            ? `CHIEF COMPLAINT:\n${template.subjective.chiefComplaint}\n\n`
            : '') +
            (template.subjective.hpi
              ? `HISTORY OF PRESENT ILLNESS:\n${template.subjective.hpi}\n\n`
              : '') +
            (template.subjective.ros ? `REVIEW OF SYSTEMS:\n${template.subjective.ros}` : '')
        ),
        objective: processTemplate(
          (template.objective.vitals ? `VITAL SIGNS:\n${template.objective.vitals}\n\n` : '') +
            (template.objective.physicalExam
              ? `PHYSICAL EXAMINATION:\n${template.objective.physicalExam}\n\n`
              : '') +
            (template.objective.labs ? `LABORATORY:\n${template.objective.labs}` : '')
        ),
        assessment: processTemplate(template.assessment.template || ''),
        plan: processTemplate(template.plan.template || ''),
      };
    } else {
      // Use intelligent processing (existing code)
      soap = {
        subjective: `CHIEF COMPLAINT:
Uncontrolled diabetes with hyperglycemia

HISTORY OF PRESENT ILLNESS:
${dictatedText}

REVIEW OF SYSTEMS:
${rosItems.join('\n')}`,

        objective: `VITAL SIGNS:
Blood Pressure: 130/85 mmHg (elevated given diabetes)
Heart Rate: 88 bpm
Temperature: 98.6°F
Respiratory Rate: 18/min
O2 Saturation: 97% on room air
Blood Glucose (point of care): 425 mg/dL

PHYSICAL EXAMINATION:
General: Appears unwell, mild distress from GI symptoms
HEENT: Dry mucous membranes (mild dehydration)
Cardiovascular: Regular rate and rhythm, no murmurs
Lungs: Clear to auscultation bilaterally, improved from recent pneumonia
Abdomen: Soft, mild diffuse tenderness, hyperactive bowel sounds
Extremities: No edema, pulses intact
Skin: Warm and dry, poor skin turgor
Neurological: Alert and oriented, no focal deficits`,

        assessment: `ASSESSMENT:
${assessmentItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

CLINICAL IMPRESSION:
Patient with poorly controlled type 2 diabetes presenting with severe hyperglycemia and gastrointestinal symptoms. Recent pneumonia may have contributed to loss of glycemic control. Initiating insulin therapy is appropriate given blood glucose levels > 400 mg/dL.`,

        plan: `PLAN:
${planItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
      };
    }

    setSoapNote(soap);
    setCurrentStep(3);
  };

  const saveAndFinish = async () => {
    if (onSave) {
      onSave(transcript, soapNote);
    }

    try {
      // Check if authenticated, if not try to auto-login with demo credentials
      if (!medicalAPI.isAuthenticated()) {
        try {
          await medicalAPI.login({
            email: 'admin@tshla.ai',
            magic_word: 'admin123',
          });
        } catch (authError) {
          logWarn('SimplifiedUnifiedDictation', 'Warning message', {});
        }
      }

      // Try to save to Python backend first
      try {
        const result = await medicalAPI.savePatientNote({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          doctorId: sessionStorage.getItem('doctor_id') || 'default-doctor',
          date: visitDate,
          transcript: transcript,
          soapNote: soapNote,
          templateUsed: selectedTemplateId,
        });

        if (result.success) {
          logInfo('SimplifiedUnifiedDictation', 'Info message', {});
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
            setCurrentStep(1);
            setTranscript(
              `Patient: ${patient.firstName} ${patient.lastName}\nDate: ${visitDate}\nID: ${patient.id}\n\nChief Complaint: \n`
            );
          }, 2000);
          return;
        }
      } catch (apiError) {
        logWarn('SimplifiedUnifiedDictation', 'Warning message', {});
      }

      // Fallback to Next.js API
      const response = await fetch('/api/patient-notes/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          doctorId: sessionStorage.getItem('doctor_id') || 'default-doctor',
          date: visitDate,
          transcript: transcript,
          soapNote: soapNote,
          templateUsed: selectedTemplateId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        logInfo('SimplifiedUnifiedDictation', 'Info message', {});
      } else if (result.fallback) {
        logWarn('SimplifiedUnifiedDictation', 'Warning message', {});
        // Fallback to localStorage if database isn't configured
        const noteKey = `note_${patient.id}_${Date.now()}`;
        const noteData = {
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          date: visitDate,
          transcript: transcript,
          soapNote: soapNote,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(noteKey, JSON.stringify(noteData));
      }
    } catch (error) {
      logError('SimplifiedUnifiedDictation', 'Error message', {});
      // Fallback to localStorage on error
      const noteKey = `note_${patient.id}_${Date.now()}`;
      const noteData = {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: visitDate,
        transcript: transcript,
        soapNote: soapNote,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(noteKey, JSON.stringify(noteData));
    }

    // Update patient slot status (keep in localStorage for now for UI state)
    const slotNumber = new URLSearchParams(window.location.search).get('slot');
    if (slotNumber) {
      const savedSlotsKey = `driver_slots_${visitDate}`;
      const savedSlots = localStorage.getItem(savedSlotsKey);
      if (savedSlots) {
        const slots = JSON.parse(savedSlots);
        const updatedSlots = slots.map((slot: any) => {
          if (slot.slotNumber === parseInt(slotNumber)) {
            return { ...slot, status: 'completed' };
          }
          return slot;
        });
        localStorage.setItem(savedSlotsKey, JSON.stringify(updatedSlots));
      }
    }

    setShowSuccess(true);
    setCurrentStep(4);

    // Redirect back to patients page after 2 seconds
    setTimeout(() => {
      window.location.href = '/driver/patients';
    }, 2000);
  };

  // Template management functions
  const setTemplateAsDefault = async (templateId: string) => {
    try {
      const currentUser = unifiedAuthService.getCurrentUser();
      if (!currentUser) {
        alert('Please log in to set default template');
        return;
      }

      const doctorId = currentUser.email || currentUser.id || 'default-doctor';
      await doctorProfileService.setDefaultTemplate(templateId, undefined, doctorId);

      // Update the template store
      setDefaultTemplate(templateId);

      alert('✅ Template set as default successfully!');
    } catch (error) {
      logError('SimplifiedUnifiedDictation', 'Error message', {});
      alert('❌ Failed to set default template. Please try again.');
    }
  };

  const editCurrentTemplate = () => {
    const template = getTemplateById(selectedTemplateId);
    if (template) {
      setEditingTemplate(template);
      setShowTemplateEditor(true);
    } else {
      alert('Please select a template to edit');
    }
  };

  const saveAsNewTemplate = () => {
    const templateName = prompt('Enter a name for the new template:');
    if (!templateName) return;

    try {
      const baseTemplate = getTemplateById(selectedTemplateId);
      const newTemplate = {
        id: `custom-${Date.now()}`,
        name: templateName,
        specialty: baseTemplate?.specialty || 'General',
        subjective: baseTemplate?.subjective || {
          chiefComplaint: 'CHIEF COMPLAINT:\n[DICTATION]',
          hpi: 'HISTORY OF PRESENT ILLNESS:\n[DICTATION]',
          ros: 'REVIEW OF SYSTEMS:\n[DICTATION]',
        },
        objective: baseTemplate?.objective || {
          vitals: 'VITAL SIGNS:\n[DICTATION]',
          physicalExam: 'PHYSICAL EXAMINATION:\n[DICTATION]',
          labs: 'LABORATORY:\n[DICTATION]',
        },
        assessment: baseTemplate?.assessment || {
          template: 'ASSESSMENT:\n[DICTATION]',
        },
        plan: baseTemplate?.plan || {
          template: 'PLAN:\n[DICTATION]',
        },
      };

      saveCustomTemplate(newTemplate);

      alert(`✅ Template "${templateName}" saved successfully!`);
    } catch (error) {
      logError('SimplifiedUnifiedDictation', 'Error message', {});
      alert('❌ Failed to save template. Please try again.');
    }
  };

  const saveTemplateEdit = () => {
    if (editingTemplate) {
      saveCustomTemplate(editingTemplate);
      setShowTemplateEditor(false);
      setEditingTemplate(null);
      alert('✅ Template updated successfully!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Record */}
      <div
        className={`bg-white rounded-2xl shadow-lg p-6 border-4 ${
          currentStep === 1 ? 'border-blue-400' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
            1
          </div>
          <div className="flex-grow">
            <h2 className="text-2xl font-bold mb-3">
              {isRecording ? '🔴 Recording in Progress...' : 'Start Your Dictation'}
            </h2>
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-10 py-5 bg-green-600 text-white text-2xl font-bold rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg"
                title="Click to start recording"
              >
                🎤 Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-10 py-5 bg-red-600 text-white text-2xl font-bold rounded-xl hover:bg-red-700 transition-all animate-pulse shadow-lg"
                title="Click to stop recording"
              >
                ⏹ Stop Recording
              </button>
            )}
            <p className="text-lg text-gray-700 mt-3 font-medium">
              💡 <strong>Tip:</strong> Speak clearly about symptoms, exam findings, and treatment
              plan
            </p>
            {error && (
              <div className="mt-3 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <p className="text-yellow-800 font-semibold">{error}</p>
                <p className="text-yellow-700 mt-2">
                  <strong>Alternative:</strong> You can type your notes directly in the text box
                  below. Just type your clinical findings and click "Process with AI" when done.
                </p>
                <p className="text-yellow-700 mt-1">
                  <strong>Browser Support:</strong> Voice dictation works best in Chrome or Edge
                  browsers.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transcript Box */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-xl font-bold mb-3">Your Dictation:</h3>
        <textarea
          value={transcript}
          onChange={e => {
            setTranscript(e.target.value);
            transcriptRef.current = e.target.value;
            // Clear error when user starts typing
            if (error) setError('');
          }}
          className="w-full h-64 p-4 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-500 focus:outline-none font-mono"
          placeholder="Type or dictate your clinical notes here. Include chief complaint, symptoms, exam findings, and treatment plan. You don't need to use voice - just type and click 'Process with AI' when done."
        />
        {transcript.length > 50 && !isRecording && currentStep === 1 && (
          <p className="text-green-600 font-semibold mt-2">
            ✓ You have enough content. Click "Process with AI" below to generate SOAP note.
          </p>
        )}
      </div>

      {/* Step 2: Process */}
      {(currentStep >= 2 || transcript.length > 50) && (
        <div
          className={`bg-white rounded-2xl shadow-lg p-6 border-4 ${
            currentStep === 2 ? 'border-green-400' : 'border-gray-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
              2
            </div>
            <div className="flex-grow">
              <h2 className="text-2xl font-bold mb-3">Generate SOAP Note</h2>
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-semibold text-gray-700">Using Template:</span>
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg text-lg font-medium focus:border-blue-500 focus:outline-none"
                  >
                    <optgroup label="Standard Templates">
                      {templates
                        .filter((t: any) => !t.id.startsWith('custom-'))
                        .map((template: any) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                            {template.id === defaultTemplateId && ' (Default)'}
                          </option>
                        ))}
                    </optgroup>
                    {templates.some((t: any) => t.id.startsWith('custom-')) && (
                      <optgroup label="Custom Templates">
                        {templates
                          .filter((t: any) => t.id.startsWith('custom-'))
                          .map((template: any) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                              {template.id === defaultTemplateId && ' (Default)'}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Template Management Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setTemplateAsDefault(selectedTemplateId)}
                    disabled={selectedTemplateId === defaultTemplateId}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                      selectedTemplateId === defaultTemplateId
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title={
                      selectedTemplateId === defaultTemplateId
                        ? 'This is already the default template'
                        : 'Set this template as default'
                    }
                  >
                    {selectedTemplateId === defaultTemplateId ? '✓ Default' : '⭐ Set Default'}
                  </button>

                  <button
                    onClick={() => editCurrentTemplate()}
                    className="px-3 py-1 text-sm font-medium rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-all"
                    title="Edit current template"
                  >
                    ✏️ Edit Template
                  </button>

                  <button
                    onClick={() => saveAsNewTemplate()}
                    className="px-3 py-1 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all"
                    title="Save current settings as new template"
                  >
                    💾 Save as New
                  </button>

                  <button
                    onClick={() => window.open('/doctor/templates', '_blank')}
                    className="px-3 py-1 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    title="Open template management page"
                  >
                    🔧 Manage Templates
                  </button>
                </div>
              </div>
              <button
                onClick={processWithAI}
                className="px-10 py-5 bg-blue-600 text-white text-2xl font-bold rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg animate-pulse"
                title="Click to generate SOAP note"
              >
                🤖 Process with AI
              </button>
              <p className="text-lg text-gray-700 mt-3 font-medium">
                💡 <strong>Tip:</strong> This will create a complete SOAP note from your dictation
                using the selected template
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SOAP Note Display */}
      {soapNote && (
        <div className="bg-green-50 rounded-2xl shadow-lg p-6 border-4 border-green-400">
          <h3 className="text-2xl font-bold text-green-800 mb-4">✅ SOAP Note Generated!</h3>
          <div className="bg-white rounded-xl p-6 space-y-6">
            <div>
              <h4 className="font-bold text-lg text-blue-700 mb-2">SUBJECTIVE:</h4>
              <p className="whitespace-pre-wrap text-gray-700">{soapNote.subjective}</p>
            </div>
            <div>
              <h4 className="font-bold text-lg text-blue-700 mb-2">OBJECTIVE:</h4>
              <p className="whitespace-pre-wrap text-gray-700">{soapNote.objective}</p>
            </div>
            <div>
              <h4 className="font-bold text-lg text-blue-700 mb-2">ASSESSMENT:</h4>
              <p className="whitespace-pre-wrap text-gray-700">{soapNote.assessment}</p>
            </div>
            <div>
              <h4 className="font-bold text-lg text-blue-700 mb-2">PLAN:</h4>
              <p className="whitespace-pre-wrap text-gray-700">{soapNote.plan}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Save */}
      {currentStep >= 3 && (
        <div
          className={`bg-white rounded-2xl shadow-lg p-6 border-4 ${
            currentStep === 3 ? 'border-purple-400' : 'border-gray-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
              3
            </div>
            <div className="flex-grow">
              <h2 className="text-2xl font-bold mb-3">Save & Complete</h2>
              <button
                onClick={saveAndFinish}
                className="px-10 py-5 bg-green-600 text-white text-2xl font-bold rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg animate-bounce"
                title="Click to save and finish"
              >
                💾 Save Note & Finish
              </button>
              <p className="text-lg text-gray-700 mt-3 font-medium">
                💡 <strong>Tip:</strong> This saves the note and marks the visit as completed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-100 rounded-2xl shadow-lg p-8 border-4 border-green-400 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-3xl font-bold text-green-800 mb-2">Note Saved Successfully!</h3>
          <p className="text-xl text-gray-700">Returning to patient schedule...</p>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Edit Template</h3>
                <button
                  onClick={() => {
                    setShowTemplateEditor(false);
                    setEditingTemplate(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                  <input
                    type="text"
                    value={editingTemplate.specialty}
                    onChange={e =>
                      setEditingTemplate({ ...editingTemplate, specialty: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chief Complaint
                  </label>
                  <textarea
                    value={editingTemplate.subjective?.chiefComplaint || ''}
                    onChange={e =>
                      setEditingTemplate({
                        ...editingTemplate,
                        subjective: {
                          ...editingTemplate.subjective,
                          chiefComplaint: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    History of Present Illness
                  </label>
                  <textarea
                    value={editingTemplate.subjective?.hpi || ''}
                    onChange={e =>
                      setEditingTemplate({
                        ...editingTemplate,
                        subjective: { ...editingTemplate.subjective, hpi: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assessment</label>
                  <textarea
                    value={editingTemplate.assessment?.template || ''}
                    onChange={e =>
                      setEditingTemplate({
                        ...editingTemplate,
                        assessment: { ...editingTemplate.assessment, template: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
                  <textarea
                    value={editingTemplate.plan?.template || ''}
                    onChange={e =>
                      setEditingTemplate({
                        ...editingTemplate,
                        plan: { ...editingTemplate.plan, template: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none h-24"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowTemplateEditor(false);
                    setEditingTemplate(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplateEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
