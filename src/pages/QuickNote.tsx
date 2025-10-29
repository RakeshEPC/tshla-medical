// For now, we'll update the existing MedicalDictation component directly
// To avoid breaking changes, we'll import modernUI.css in the component
import MedicalDictation from '../components/MedicalDictation';

export default function QuickNote() {
  // Read patient data from sessionStorage (set when clicking patient from schedule)
  const storedPatient = sessionStorage.getItem('current_patient');
  const patientData = storedPatient ? JSON.parse(storedPatient) : null;

  return (
    <MedicalDictation
      patientId={patientData?.id}
      preloadPatientData={true}
    />
  );
}
