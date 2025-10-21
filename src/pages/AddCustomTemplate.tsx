import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorProfileService } from '../services/doctorProfile.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function AddCustomTemplate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    async function addTemplates() {
      try {
        setStatus('Loading user...');

        // Get current doctor
        const result = await supabaseAuthService.getCurrentUser();
        if (!result.success || !result.user) {
          alert('Please log in first');
          navigate('/login');
          return;
        }

        const doctorId = result.user.authUserId || result.user.id || result.user.email;
        doctorProfileService.initialize(doctorId);

        setStatus('Creating custom templates in Supabase...');

        // Add a custom SOAP template
        await doctorProfileService.createTemplate(
          {
            name: 'My Custom SOAP Template',
            description: 'Custom internal medicine SOAP note template',
            visitType: 'follow-up',
            isDefault: false,
            sections: {
              chief_complaint: {
                title: 'Chief Complaint',
                prompt: 'Patient presents today with',
                exampleText: 'Patient presents today with shortness of breath',
                keywords: ['complaint', 'presenting', 'chief'],
                required: true,
              },
              history_present_illness: {
                title: 'History of Present Illness',
                prompt: 'The patient is a [age] year old [gender] who reports',
                exampleText: 'The patient is a 45 year old male who reports worsening dyspnea',
                keywords: ['HPI', 'history', 'present illness'],
                required: true,
              },
              review_of_systems: {
                title: 'Review of Systems',
                prompt:
                  'Constitutional: Denies fever, chills, weight loss\nCardiovascular: Denies chest pain\nRespiratory: Denies shortness of breath',
                exampleText: 'Constitutional: Denies fever, chills. Reports fatigue.',
                keywords: ['ROS', 'systems', 'review'],
                required: false,
              },
              assessment: {
                title: 'Assessment',
                prompt: 'Assessment:\n1.',
                exampleText: 'Assessment:\n1. Dyspnea - likely cardiac in origin\n2. Hypertension - uncontrolled',
                keywords: ['assessment', 'diagnosis', 'impression'],
                required: true,
              },
              plan: {
                title: 'Plan',
                prompt: 'Plan:\n1. \n2. \n3. Follow up in',
                exampleText: 'Plan:\n1. Chest X-ray\n2. Echocardiogram\n3. Follow up in 1 week',
                keywords: ['plan', 'treatment', 'follow-up'],
                required: true,
              },
            },
            macros: {
              nad: 'No acute distress',
              rrr: 'Regular rate and rhythm',
              ctab: 'Clear to auscultation bilaterally',
            },
            quickPhrases: [
              'No acute distress',
              'Well-appearing',
              'Regular rate and rhythm',
              'Clear bilaterally',
              'Soft, non-tender',
            ],
            generalInstructions: 'Focus on presenting complaint and relevant systems',
          },
          doctorId
        );

        logDebug('AddCustomTemplate', 'Created custom SOAP template', {});

        // Add a custom pump evaluation template
        await doctorProfileService.createTemplate(
          {
            name: 'Custom Pump Evaluation',
            description: 'Insulin pump evaluation and adjustment template',
            visitType: 'pump-visit',
            isDefault: false,
            sections: {
              chief_complaint: {
                title: 'Chief Complaint',
                prompt: 'Insulin pump evaluation and adjustment',
                exampleText: 'Scheduled insulin pump evaluation and settings review',
                keywords: ['pump', 'evaluation', 'diabetes'],
                required: true,
              },
              glucose_control: {
                title: 'Glucose Control',
                prompt:
                  'Average BG ___, Time in range ___%, Episodes of hypoglycemia: ___, Episodes of hyperglycemia: ___',
                exampleText: 'Average BG 145 mg/dL, Time in range 72%, No severe hypoglycemia',
                keywords: ['glucose', 'TIR', 'control'],
                required: true,
              },
              pump_settings: {
                title: 'Current Pump Settings',
                prompt:
                  'Insulin pump with current settings:\n- Basal rates: ___\n- I:C ratios: ___\n- ISF: ___\n- Target BG: ___',
                exampleText:
                  'Insulin pump settings:\n- Basal: 0.8 u/hr\n- I:C: 1:10\n- ISF: 1:50\n- Target: 110 mg/dL',
                keywords: ['settings', 'basal', 'insulin'],
                required: true,
              },
              assessment: {
                title: 'Assessment',
                prompt:
                  'Type 1 Diabetes Mellitus on insulin pump therapy\nGlycemic control: [Well controlled/Suboptimal/Poor]',
                exampleText: 'Type 1 DM on pump. Glycemic control well maintained with current regimen.',
                keywords: ['assessment', 'diabetes', 'control'],
                required: true,
              },
              plan: {
                title: 'Plan',
                prompt:
                  'Pump adjustments:\n- Basal rate changes: \n- I:C ratio changes: \n- ISF changes: \n- Continue CGM monitoring\n- Follow up in 3 months',
                exampleText: 'Continue current settings. Monitor overnight basals. F/U 3 months.',
                keywords: ['plan', 'adjustments', 'followup'],
                required: true,
              },
            },
            macros: {
              tir: 'Time in range: __%, Time below range: __%, Time above range: __%',
              settings: 'Basal: ___ u/hr, I:C: 1:___, ISF: 1:___',
            },
            quickPhrases: [
              'Well controlled on current regimen',
              'No severe hypoglycemia',
              'Good compliance with CGM',
              'Continue current pump settings',
            ],
            generalInstructions: 'Review CGM data and adjust pump settings as needed',
          },
          doctorId
        );

        logDebug('AddCustomTemplate', 'Created custom pump template', {});

        setStatus('Templates created successfully!');
        alert('Custom templates added to Supabase successfully! Redirecting to templates page...');

        setTimeout(() => {
          navigate('/templates');
        }, 2000);
      } catch (error) {
        console.error('Failed to create templates:', error);
        logError('AddCustomTemplate', 'Failed to create templates', { error });
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        alert('Failed to create templates. Check console for details.');
      }
    }

    addTemplates();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-4">Adding Custom Templates...</h2>
        <p className="text-gray-600">{status}</p>
        <p className="text-gray-600 mt-2 text-sm">Templates will be saved to Supabase database</p>
      </div>
    </div>
  );
}
