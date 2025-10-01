import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { unifiedAuthService } from '../services/unifiedAuth.service';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  appointmentTime: string;
  status: 'pending' | 'in-progress' | 'completed';
  phone?: string;
  dob?: string;
  email?: string;
  reasonForVisit?: string;
  isPrepped?: boolean;
}

// Generate time slots for the day
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 9; hour < 12; hour++) {
    slots.push(`${hour}:00 AM`);
    slots.push(`${hour}:30 AM`);
  }
  slots.push('12:00 PM', '12:30 PM');
  for (let hour = 1; hour <= 5; hour++) {
    slots.push(`${hour}:00 PM`);
    slots.push(`${hour}:30 PM`);
  }
  return slots;
};

export default function DoctorDashboardStyled() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const doctorName = currentUser?.name || user?.name || 'Dr. Smith';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('scheduled_patients');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      {
        id: '444-444',
        name: 'John Smith',
        mrn: 'MRN444444',
        appointmentTime: '9:00 AM',
        status: 'completed',
        reasonForVisit: 'Annual physical exam',
        isPrepped: true,
      },
      {
        id: '111-111',
        name: 'Sarah Johnson',
        mrn: 'MRN111111',
        appointmentTime: '9:30 AM',
        status: 'completed',
        reasonForVisit: 'Follow-up diabetes management',
        isPrepped: true,
      },
      {
        id: '222-222',
        name: 'Michael Chen',
        mrn: 'MRN222222',
        appointmentTime: '10:00 AM',
        status: 'in-progress',
        reasonForVisit: 'Chest pain evaluation',
        isPrepped: true,
      },
      {
        id: '333-333',
        name: 'Emily Rodriguez',
        mrn: 'MRN333333',
        appointmentTime: '10:30 AM',
        status: 'pending',
        reasonForVisit: 'Hypertension checkup',
        isPrepped: false,
      },
      {
        id: '555-555',
        name: 'David Wilson',
        mrn: 'MRN555555',
        appointmentTime: '11:00 AM',
        status: 'pending',
        reasonForVisit: 'New patient consultation',
        isPrepped: true,
      },
      {
        id: '666-666',
        name: 'Lisa Anderson',
        mrn: 'MRN666666',
        appointmentTime: '2:00 PM',
        status: 'pending',
        reasonForVisit: 'Medication review',
        isPrepped: false,
      },
    ];
  });

  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    mrn: '',
    appointmentTime: '',
    phone: '',
    email: '',
    reasonForVisit: '',
  });

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    localStorage.setItem('scheduled_patients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDictation = (patientId: string) => {
    navigate(`/dictation/${patientId}`);
  };

  const getPatientInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const addPatient = () => {
    if (newPatient.name && newPatient.mrn && newPatient.appointmentTime) {
      const patient: Patient = {
        id: `patient-${Date.now()}`,
        name: newPatient.name,
        mrn: newPatient.mrn,
        appointmentTime: newPatient.appointmentTime,
        status: 'pending',
        phone: newPatient.phone,
        email: newPatient.email,
        reasonForVisit: newPatient.reasonForVisit,
        isPrepped: false,
      };
      setPatients(
        [...patients, patient].sort((a, b) => {
          const timeA = timeSlots.indexOf(a.appointmentTime);
          const timeB = timeSlots.indexOf(b.appointmentTime);
          return timeA - timeB;
        })
      );
      setNewPatient({
        name: '',
        mrn: '',
        appointmentTime: '',
        phone: '',
        email: '',
        reasonForVisit: '',
      });
      setShowAddPatient(false);
    }
  };

  const togglePrepped = (patientId: string) => {
    setPatients(patients.map(p => (p.id === patientId ? { ...p, isPrepped: !p.isPrepped } : p)));
  };

  // Modern styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
    },
    header: {
      background: 'white',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      borderBottom: '1px solid #e8f0fe',
      padding: '1.5rem 2rem',
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
    },
    headerContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logo: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#1e40af',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    welcomeText: {
      fontSize: '0.875rem',
      color: '#64748b',
      marginBottom: '0.125rem',
    },
    doctorName: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#1e293b',
    },
    btnPrimary: {
      padding: '0.625rem 1.25rem',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
      transition: 'all 0.2s',
    },
    btnSecondary: {
      padding: '0.625rem 1.25rem',
      background: 'white',
      color: '#475569',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    mainContent: {
      maxWidth: '1400px',
      margin: '2rem auto',
      padding: '0 2rem',
    },
    scheduleSection: {
      background: 'white',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      border: '1px solid #f1f5f9',
      overflow: 'hidden',
      minHeight: '700px',
    },
    scheduleHeader: {
      padding: '1.5rem',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    },
    patientCard: {
      background: 'white',
      border: '1px solid #e8f0fe',
      borderRadius: '0.5rem',
      padding: '0.75rem',
      marginBottom: '0.5rem',
      transition: 'all 0.2s',
      cursor: 'pointer',
    },
    patientAvatar: {
      width: '48px',
      height: '48px',
      borderRadius: '0.75rem',
      background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      color: '#4c1d95',
      fontSize: '1.125rem',
    },
    modal: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      background: 'white',
      borderRadius: '1rem',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
      maxWidth: '500px',
      width: '90%',
      padding: '2rem',
    },
    formGroup: {
      marginBottom: '1.25rem',
    },
    formLabel: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#475569',
      marginBottom: '0.5rem',
    },
    formInput: {
      width: '100%',
      padding: '0.625rem 0.875rem',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      fontSize: '0.9375rem',
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={styles.logo}>
              <span>TSHLA Medical</span>
            </div>
            <div>
              <div style={styles.welcomeText}>Welcome back,</div>
              <div style={styles.doctorName}>{doctorName}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/quick-note')}
              style={styles.btnPrimary}
              onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              Quick Note
            </button>

            <button onClick={() => navigate('/doctor/templates')} style={styles.btnSecondary}>
              📝 Templates
            </button>

            <button onClick={() => navigate('/doctor/profile')} style={styles.btnSecondary}>
              ⚙️ Profile
            </button>

            <button onClick={logout} style={styles.btnSecondary}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.mainContent}>
        {/* Schedule Section */}
        <div style={styles.scheduleSection}>
          <div style={styles.scheduleHeader}>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>
              Today's Schedule
              <span
                style={{
                  fontSize: '0.75rem',
                  marginLeft: '1rem',
                  padding: '0.25rem 0.75rem',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  borderRadius: '1rem',
                  fontWeight: 500,
                }}
              >
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            <button onClick={() => setShowAddPatient(true)} style={styles.btnPrimary}>
              + Add Patient
            </button>
          </div>

          {/* Patient List */}
          <div style={{ padding: '0.75rem' }}>
            {timeSlots.map(slot => {
              const slotPatients = patients.filter(p => p.appointmentTime === slot);
              if (slotPatients.length === 0) return null;

              return (
                <div key={slot} style={{ marginBottom: '1rem' }}>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '0.5rem',
                      borderLeft: '3px solid #3b82f6',
                      paddingLeft: '0.75rem',
                    }}
                  >
                    {slot}
                  </div>

                  {slotPatients.map(patient => (
                    <div
                      key={patient.id}
                      style={{
                        ...styles.patientCard,
                        opacity: patient.status === 'completed' ? 0.7 : 1,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e8f0fe';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={styles.patientAvatar}>
                              {getPatientInitials(patient.name)}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  marginBottom: '0.25rem',
                                }}
                              >
                                {patient.name}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                MRN: {patient.mrn}
                                {patient.phone && ` • ${patient.phone}`}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                padding: '0.25rem 0.625rem',
                                borderRadius: '0.375rem',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em',
                                background:
                                  patient.status === 'completed'
                                    ? '#d1fae5'
                                    : patient.status === 'in-progress'
                                      ? '#dbeafe'
                                      : '#fef3c7',
                                color:
                                  patient.status === 'completed'
                                    ? '#065f46'
                                    : patient.status === 'in-progress'
                                      ? '#1e40af'
                                      : '#92400e',
                              }}
                            >
                              {patient.status.replace('-', ' ')}
                            </span>

                            <button
                              onClick={() => togglePrepped(patient.id)}
                              style={{
                                padding: '0.25rem 0.625rem',
                                borderRadius: '0.375rem',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                background: patient.isPrepped ? '#10b981' : '#e5e7eb',
                                color: patient.isPrepped ? 'white' : '#6b7280',
                                transition: 'all 0.2s',
                              }}
                            >
                              {patient.isPrepped ? '✓ Prepped' : 'Prep'}
                            </button>

                            {patient.status !== 'completed' && (
                              <button
                                onClick={() => startDictation(patient.id)}
                                style={{
                                  ...styles.btnPrimary,
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Start →
                              </button>
                            )}
                          </div>
                        </div>

                        {patient.reasonForVisit && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              paddingLeft: '3.5rem',
                              fontSize: '0.8125rem',
                              color: '#475569',
                              fontStyle: 'italic',
                            }}
                          >
                            {patient.reasonForVisit}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Add Patient Modal */}
      {showAddPatient && (
        <div style={styles.modal} onClick={() => setShowAddPatient(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '1.5rem',
              }}
            >
              Add New Patient
            </h3>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Patient Name</label>
              <input
                type="text"
                style={styles.formInput}
                value={newPatient.name}
                onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                placeholder="Enter patient name"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>MRN</label>
              <input
                type="text"
                style={styles.formInput}
                value={newPatient.mrn}
                onChange={e => setNewPatient({ ...newPatient, mrn: e.target.value })}
                placeholder="Enter MRN"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Appointment Time</label>
              <select
                style={styles.formInput}
                value={newPatient.appointmentTime}
                onChange={e => setNewPatient({ ...newPatient, appointmentTime: e.target.value })}
              >
                <option value="">Select time...</option>
                {timeSlots.map(slot => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Phone (Optional)</label>
              <input
                type="tel"
                style={styles.formInput}
                value={newPatient.phone}
                onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Email (Optional)</label>
              <input
                type="email"
                style={styles.formInput}
                value={newPatient.email}
                onChange={e => setNewPatient({ ...newPatient, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Reason for Visit</label>
              <input
                type="text"
                style={styles.formInput}
                value={newPatient.reasonForVisit}
                onChange={e => setNewPatient({ ...newPatient, reasonForVisit: e.target.value })}
                placeholder="e.g., Annual physical, follow-up visit, etc."
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                marginTop: '2rem',
              }}
            >
              <button onClick={() => setShowAddPatient(false)} style={styles.btnSecondary}>
                Cancel
              </button>
              <button onClick={addPatient} style={styles.btnPrimary}>
                Add Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
