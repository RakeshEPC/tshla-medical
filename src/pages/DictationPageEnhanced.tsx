import { useParams } from 'react-router-dom';
import MedicalDictation from '../components/MedicalDictation';

export default function DictationPageEnhanced() {
  const { patientId } = useParams();

  // Dictation page with patient ID - preload patient data
  return <MedicalDictation patientId={patientId} preloadPatientData={true} />;
}
