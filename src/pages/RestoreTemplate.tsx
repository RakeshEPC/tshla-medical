import React from 'react';
import { templateStorage } from '../lib/templateStorage';
import { useNavigate } from 'react-router-dom';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function RestoreTemplate() {
  const navigate = useNavigate();

  const restoreRakesh222Template = () => {
    const rakesh222Template = {
      name: 'rakesh 222',
      specialty: 'Endocrinology',
      template_type: 'custom',
      generalInstructions: 'third person, professional, all of this is bullet points, not prose or sentences, so have bullet points that has all pertinent info',
      sections: {
        subjective: {
          title: 'R: SUBJECTIVE',
          aiInstructions: 'This is the part where they tell you the story of what happened since last time medically. include everything. If it\'s endocrine related, make it bold, keep it organized and in chronological order as much as possible. Do not put labs or medications here. put what the sugars are here from CGM or fingersticks.',
          order: 0
        },
        current_status: {
          title: 'R: CURRENT STATUS',
          aiInstructions: 'This is where we want to know what meds that they are taking. We want to know what the labs were done and the results here. bullet points, not prose. we want to know what they stopped or not compliant with here. We want a summary of the main endocrine problem.',
          order: 1
        },
        plan: {
          title: 'R: PLAN',
          aiInstructions: 'This is what we are going to do. What meds are we starting. What meds are we changing the dose up or down. What meds are we stopping. What labs are we ordering.',
          order: 2
        },
        follow_up: {
          title: 'R: FOLLOW UP',
          aiInstructions: 'When do we want to see the patient again. What are we going to do next time',
          order: 3
        },
        ultrasound: {
          title: 'R: ULTRASOUND',
          aiInstructions: 'If ultrasound was done, include this section. If no ultrasound done, ignore and do not include this section. Put summary of the results of the ultrasound here.',
          order: 4
        },
        cpt: {
          title: 'R: CPT',
          aiInstructions: 'From the dictation, grab all the diagnosis you can and list them here in icd-10 format. It\'s ok to infer, if we are starting a statin, it\'s ok to add hyperlipidemia or hyperTG or goiter, or nodules or diabetes controlled or uncontrolled, etc... start with diagnosis to consider',
          order: 5
        }
      },
      is_shared: false,
      is_system_template: false
    };

    try {
      // First, delete any existing rakesh 222 template
      const existingTemplates = templateStorage.getTemplates();
      const existingRakesh = existingTemplates.find(t => t.name === 'rakesh 222');
      if (existingRakesh) {
        templateStorage.deleteTemplate(existingRakesh.id);
        logDebug('RestoreTemplate', 'Debug message', {});
      }
      
      // Create the template
      const created = templateStorage.createTemplate(rakesh222Template);
      logDebug('RestoreTemplate', 'Debug message', {});
      logDebug('RestoreTemplate', 'Debug message', {});
      
      // Verify the template has AI instructions
      Object.entries(created.sections).forEach(([key, section]) => {
        logDebug('RestoreTemplate', 'Debug message', {});
        if (typeof section === 'object' && section.aiInstructions) {
          logDebug("RestoreTemplate", "Section has AI instructions");
        } else {
          logWarn('RestoreTemplate', 'Warning message', {});
        }
      });
      
      // Set as default
      localStorage.setItem('defaultTemplateId', created.id);
      
      alert('✅ rakesh 222 template has been restored successfully!\n\nThe template has been created and set as your default.\n\nCheck the console to verify AI instructions are present.');
      
      // Navigate to dictation page
      navigate('/');
    } catch (error) {
      logError('RestoreTemplate', 'Error message', {});
      alert('Error creating template. Please check the console.');
    }
  };

  const checkExistingTemplates = () => {
    const templates = templateStorage.getTemplates();
    logDebug('RestoreTemplate', 'Debug message', {});
    alert(`Found ${templates.length} templates:\n${templates.map(t => `- ${t.name} (${t.id})`).join('\n')}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Restore rakesh 222 Template</h1>
          
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="font-semibold mb-2">Template Details:</h2>
            <ul className="text-sm space-y-1">
              <li>• Name: rakesh 222</li>
              <li>• Specialty: Endocrinology</li>
              <li>• Sections: Subjective, Current Status, Plan, Follow Up, Ultrasound, CPT</li>
              <li>• Format: Third person, bullet points, professional</li>
            </ul>
          </div>

          <div className="space-y-4">
            <button
              onClick={restoreRakesh222Template}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              🔄 Restore rakesh 222 Template
            </button>

            <button
              onClick={checkExistingTemplates}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              📋 Check Existing Templates
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              ← Back to Dictation
            </button>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">Full AI Instructions:</h3>
            <div className="text-xs space-y-2 text-gray-700">
              <div>
                <strong>General:</strong> third person, professional, all of this is bullet points, not prose or sentences
              </div>
              <div>
                <strong>Subjective:</strong> Story of what happened since last time medically. If endocrine related, make bold. Keep chronological. Include CGM/fingerstick sugars.
              </div>
              <div>
                <strong>Current Status:</strong> Current meds, labs done and results, what they stopped/non-compliant with. Main endocrine problem summary.
              </div>
              <div>
                <strong>Plan:</strong> Meds starting, dose changes up/down, meds stopping, labs ordering.
              </div>
              <div>
                <strong>Follow Up:</strong> When to see patient again, what to do next time.
              </div>
              <div>
                <strong>Ultrasound:</strong> Only include if ultrasound done, otherwise ignore section.
              </div>
              <div>
                <strong>CPT:</strong> ICD-10 diagnosis codes. OK to infer (statin→hyperlipidemia, etc).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}