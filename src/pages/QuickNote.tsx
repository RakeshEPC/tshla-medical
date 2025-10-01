// For now, we'll update the existing MedicalDictation component directly
// To avoid breaking changes, we'll import modernUI.css in the component
import MedicalDictation from '../components/MedicalDictation';

export default function QuickNote() {
  // Quick Note page - no patient preloading with modern UI enhancements
  return <MedicalDictation preloadPatientData={false} />;
}
