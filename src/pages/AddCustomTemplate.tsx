import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateStorage } from '../lib/templateStorage';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function AddCustomTemplate() {
  const navigate = useNavigate();

  useEffect(() => {
    // Add a custom template for testing
    const customTemplate = templateStorage.createTemplate({
      name: 'My Custom SOAP Template',
      specialty: 'Internal Medicine',
      template_type: 'custom',
      is_shared: false,
      is_system_template: false,
      sections: {
        chief_complaint: 'Patient presents today with ',
        history_present_illness: 'The patient is a [age] year old [gender] who reports ',
        review_of_systems:
          'Constitutional: Denies fever, chills, weight loss\nCardiovascular: Denies chest pain\nRespiratory: Denies shortness of breath',
        past_medical_history: 'Significant for ',
        medications: 'Current medications:\n',
        allergies: 'No known drug allergies',
        social_history: 'Social history is significant for ',
        family_history: 'Family history is notable for ',
        physical_exam:
          'Vital Signs: BP ___, HR ___, RR ___, Temp ___, O2 Sat ___\nGeneral: Well-appearing, no acute distress\nHEENT: Normocephalic, atraumatic\nCardiovascular: Regular rate and rhythm\nPulmonary: Clear to auscultation bilaterally\nAbdomen: Soft, non-tender, non-distended\nExtremities: No edema\nNeurological: Alert and oriented x3',
        assessment: 'Assessment:\n1. ',
        plan: 'Plan:\n1. \n2. \n3. Follow up in ',
      },
      quick_phrases: [
        'No acute distress',
        'Well-appearing',
        'Regular rate and rhythm',
        'Clear bilaterally',
        'Soft, non-tender',
      ],
    });

    logDebug('AddCustomTemplate', 'Debug message', {});

    // Also add another custom template
    const pumpTemplate = templateStorage.createTemplate({
      name: 'Custom Pump Evaluation',
      specialty: 'Endocrinology',
      template_type: 'pump_custom',
      is_shared: true,
      is_system_template: false,
      sections: {
        chief_complaint: 'Insulin pump evaluation and adjustment',
        history_present_illness:
          'Patient with Type 1 DM on pump therapy. Current pump: [model]. Settings review: ',
        review_of_systems:
          'Glucose control: Average BG ___, Time in range ___%, Episodes of hypoglycemia: ___, Episodes of hyperglycemia: ___',
        medications:
          'Insulin pump with current settings:\n- Basal rates: ___\n- I:C ratios: ___\n- ISF: ___\n- Target BG: ___',
        physical_exam:
          'Pump site inspection: No signs of infection or lipodystrophy\nSkin: No rashes or irritation at infusion sites',
        assessment:
          'Type 1 Diabetes Mellitus on insulin pump therapy\nGlycemic control: [Well controlled/Suboptimal/Poor]',
        plan: 'Pump adjustments:\n- Basal rate changes: \n- I:C ratio changes: \n- ISF changes: \n- Continue CGM monitoring\n- Follow up in 3 months',
      },
      macros: {
        tir: 'Time in range: __%, Time below range: __%, Time above range: __%',
        settings: 'Basal: ___ u/hr, I:C: 1:___, ISF: 1:___',
      },
    });

    logDebug('AddCustomTemplate', 'Debug message', {});
    alert('Custom templates added successfully! Redirecting to doctor dashboard...');

    setTimeout(() => {
      navigate('/doctor');
    }, 2000);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Adding Custom Templates...</h2>
        <p className="text-gray-600">Templates have been added to your localStorage.</p>
        <p className="text-gray-600 mt-2">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
