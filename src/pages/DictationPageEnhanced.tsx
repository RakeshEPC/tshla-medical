import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MedicalDictation from '../components/MedicalDictation';
import PatientSelector from '../components/PatientSelector';

interface Patient {
  id: string;
  tshla_id?: string;
  patient_id?: string;
  first_name: string;
  last_name: string;
  phone_primary: string;
  phone_display?: string;
  date_of_birth?: string;
}

export default function DictationPageEnhanced() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientSelector, setShowPatientSelector] = useState(false);

  // Load patient if patientId provided in URL
  useEffect(() => {
    if (patientId) {
      loadPatientFromId(patientId);
    } else {
      // No patient ID in URL - show selector
      setShowPatientSelector(true);
    }
  }, [patientId]);

  /**
   * Load patient data from ID (from URL parameter)
   */
  const loadPatientFromId = async (id: string) => {
    try {
      const response = await fetch(`/api/patient-chart/${id}`);
      if (response.ok) {
        const { patient } = await response.json();
        setSelectedPatient(patient);
        setShowPatientSelector(false);
      } else {
        console.error('Patient not found');
        setShowPatientSelector(true);
      }
    } catch (error) {
      console.error('Error loading patient:', error);
      setShowPatientSelector(true);
    }
  };

  /**
   * Handle patient selection from selector
   */
  const handlePatientSelected = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientSelector(false);

    // Update URL with patient ID
    if (patient.id) {
      navigate(`/dictation/${patient.id}`, { replace: true });
    }
  };

  /**
   * Handle cancel - go back to dashboard
   */
  const handleCancel = () => {
    navigate('/dashboard');
  };

  /**
   * Change patient - show selector again
   */
  const handleChangePatient = () => {
    setShowPatientSelector(true);
  };

  return (
    <div className="relative">
      {/* Patient Selector Modal */}
      {showPatientSelector && (
        <PatientSelector
          onPatientSelected={handlePatientSelected}
          onCancel={handleCancel}
          preloadSchedule={true}
        />
      )}

      {/* Dictation Interface */}
      {selectedPatient ? (
        <div>
          {/* Patient Info Bar */}
          <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-4">
              <div>
                <div className="font-semibold text-lg">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </div>
                <div className="text-blue-100 text-sm flex items-center gap-3">
                  {selectedPatient.tshla_id && (
                    <span>ID: {selectedPatient.tshla_id}</span>
                  )}
                  {selectedPatient.phone_display && (
                    <span>Phone: {selectedPatient.phone_display}</span>
                  )}
                  {selectedPatient.date_of_birth && (
                    <span>DOB: {new Date(selectedPatient.date_of_birth).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleChangePatient}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors"
            >
              Change Patient
            </button>
          </div>

          {/* Medical Dictation Component */}
          <MedicalDictation
            patientId={selectedPatient.id}
            preloadPatientData={true}
          />
        </div>
      ) : !showPatientSelector ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading patient...</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
