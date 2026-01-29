const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const patientId = '32cddaea-5a92-40c5-a3f1-2cd4b076038b';
const tshlaId = 'TSH 412-376';

const labs = [
  { name: 'CHOLESTEROL, TOTAL', value: '174', unit: 'MG/DL', reference_range: '<200', status: 'NORMAL' },
  { name: 'HDL CHOLESTEROL', value: '49', unit: 'MG/DL', reference_range: '>= 40', status: 'NORMAL' },
  { name: 'TRIGLYCERIDES', value: '181', unit: 'MG/DL', reference_range: '<150', status: 'HIGH' },
  { name: 'LDL-CHOLESTEROL', value: '97', unit: 'MG/DL', reference_range: '<100', status: 'NORMAL' },
  { name: 'GLUCOSE', value: '209', unit: 'MG/DL', reference_range: '65-99', status: 'HIGH' },
  { name: 'HEMOGLOBIN A1C', value: '6.9', unit: '%', reference_range: '<5.7', status: 'HIGH' },
  { name: 'CREATININE', value: '0.97', unit: 'MG/DL', reference_range: '0.60-1.29', status: 'NORMAL' },
  { name: 'eGFR', value: '97', unit: 'ML/MIN/1.73M2', reference_range: '>=60', status: 'NORMAL' },
  { name: 'SODIUM', value: '138', unit: 'MMOL/L', reference_range: '135-146', status: 'NORMAL' },
  { name: 'POTASSIUM', value: '4.0', unit: 'MMOL/L', reference_range: '3.5-5.3', status: 'NORMAL' },
  { name: 'TSH', value: '2.63', unit: 'MIU/L', reference_range: '0.40-4.50', status: 'NORMAL' },
  { name: 'PSA, TOTAL', value: '0.8', unit: 'NG/ML', reference_range: '<=4.0', status: 'NORMAL' },
  { name: 'TESTOSTERONE, TOTAL', value: '1329', unit: 'NG/DL', reference_range: '250-1100', status: 'HIGH' }
];

(async () => {
  console.log('Creating chart with labs...');
  
  const { data, error } = await supabase
    .from('patient_comprehensive_chart')
    .insert({
      patient_id: patientId,
      tshla_id: tshlaId,
      labs: labs,
      version: 0
    })
    .select();
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Created chart with', labs.length, 'labs');
  }
})();
