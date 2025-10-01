import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import styles from '../styles/DoctorDashboard.module.css';
import {
  Calendar,
  Clock,
  Users,
  Activity,
  Plus,
  LogOut,
  FileText,
  Settings,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  appointmentTime: string;
  status: 'pending' | 'in-progress' | 'completed';
  phone?: string;
  dob?: string;
  email?: string;
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

export default function DoctorDashboardModern() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const doctorName = currentUser?.name || user?.name || 'Dr. Smith';

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
      },
      {
        id: '111-111',
        name: 'Sarah Johnson',
        mrn: 'MRN111111',
        appointmentTime: '9:30 AM',
        status: 'completed',
      },
      {
        id: '222-222',
        name: 'Michael Chen',
        mrn: 'MRN222222',
        appointmentTime: '10:00 AM',
        status: 'in-progress',
      },
      {
        id: '333-333',
        name: 'Emily Rodriguez',
        mrn: 'MRN333333',
        appointmentTime: '10:30 AM',
        status: 'pending',
      },
      {
        id: '555-555',
        name: 'David Wilson',
        mrn: 'MRN555555',
        appointmentTime: '11:00 AM',
        status: 'pending',
      },
      {
        id: '666-666',
        name: 'Lisa Anderson',
        mrn: 'MRN666666',
        appointmentTime: '2:00 PM',
        status: 'pending',
      },
    ];
  });

  const [showAddPatient, setShowAddPatient] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed'>(
    'all'
  );

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    localStorage.setItem('scheduled_patients', JSON.stringify(patients));
  }, [patients]);

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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return `${styles.statusBadge} ${styles.pending}`;
      case 'in-progress':
        return `${styles.statusBadge} ${styles.inProgress}`;
      case 'completed':
        return `${styles.statusBadge} ${styles.completed}`;
      default:
        return styles.statusBadge;
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || patient.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Calculate stats
  const stats = {
    total: patients.length,
    completed: patients.filter(p => p.status === 'completed').length,
    inProgress: patients.filter(p => p.status === 'in-progress').length,
    pending: patients.filter(p => p.status === 'pending').length,
  };

  // Group patients by time
  const patientsByTime = timeSlots.map(slot => ({
    time: slot,
    patients: filteredPatients.filter(p => p.appointmentTime === slot),
  }));

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}>
              <Activity size={28} />
              <span>TSHLA Medical</span>
            </div>
            <div className={styles.doctorInfo}>
              <span className={styles.welcomeText}>Welcome back,</span>
              <span className={styles.doctorName}>{doctorName}</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              onClick={() => navigate('/quick-note')}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              <Plus size={16} />
              Quick Note
            </button>

            <button
              onClick={() => navigate('/doctor/templates')}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              <FileText size={16} />
              Templates
            </button>

            <button
              onClick={() => navigate('/doctor/profile')}
              className={`${styles.btn} ${styles.btnIcon}`}
            >
              <Settings size={16} />
            </button>

            <button onClick={logout} className={`${styles.btn} ${styles.btnIcon}`}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.blue}`}>
              <Users />
            </div>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total Patients</div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.green}`}>✓</div>
            <div className={styles.statValue}>{stats.completed}</div>
            <div className={styles.statLabel}>Completed</div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.purple}`}>
              <Clock />
            </div>
            <div className={styles.statValue}>{stats.inProgress}</div>
            <div className={styles.statLabel}>In Progress</div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.orange}`}>
              <Calendar />
            </div>
            <div className={styles.statValue}>{stats.pending}</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
        </div>

        {/* Schedule Section */}
        <div className={styles.scheduleSection}>
          <div className={styles.scheduleHeader}>
            <div className={styles.scheduleTitle}>
              <Calendar size={20} />
              Today's Schedule
              <span className={styles.todayBadge}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div className={styles.headerActions}>
              {/* Search */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search
                  size={16}
                  style={{ position: 'absolute', left: '12px', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem 0.5rem 2.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    width: '200px',
                  }}
                />
              </div>

              {/* Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              <button
                onClick={() => setShowAddPatient(true)}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                <Plus size={16} />
                Add Patient
              </button>
            </div>
          </div>

          {/* Patient List */}
          <div className={styles.patientList}>
            {patientsByTime.map(({ time, patients: timePatients }) => {
              if (timePatients.length === 0 && filterStatus !== 'all') return null;

              return (
                <div key={time} className={styles.timeSlot}>
                  <div className={styles.timeLabel}>{time}</div>

                  {timePatients.length > 0 ? (
                    timePatients.map(patient => (
                      <div
                        key={patient.id}
                        className={`${styles.patientCard} ${patient.status === 'completed' ? styles.completed : ''}`}
                      >
                        <div className={styles.patientCardContent}>
                          <div className={styles.patientInfo}>
                            <div className={styles.patientAvatar}>
                              {getPatientInitials(patient.name)}
                            </div>
                            <div className={styles.patientDetails}>
                              <div className={styles.patientName}>{patient.name}</div>
                              <div className={styles.patientMeta}>
                                <span className={styles.metaItem}>MRN: {patient.mrn}</span>
                                {patient.phone && (
                                  <span className={styles.metaItem}>📞 {patient.phone}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={styles.patientActions}>
                            <span className={getStatusBadgeClass(patient.status)}>
                              {patient.status.replace('-', ' ')}
                            </span>

                            {patient.status !== 'completed' && (
                              <button
                                onClick={() => startDictation(patient.id)}
                                className={`${styles.actionButton} ${styles.primary}`}
                              >
                                Start Dictation
                                <ChevronRight
                                  size={14}
                                  style={{ marginLeft: '4px', display: 'inline' }}
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptySlot}>
                      <Plus size={16} style={{ display: 'inline', marginRight: '4px' }} />
                      No patients scheduled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Add Patient Modal */}
      {showAddPatient && (
        <div className={styles.modal} onClick={() => setShowAddPatient(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add New Patient</h3>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Patient Name</label>
                <input type="text" className={styles.formInput} placeholder="Enter patient name" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>MRN</label>
                <input type="text" className={styles.formInput} placeholder="Enter MRN" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Appointment Time</label>
                <select className={styles.formInput}>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Phone (Optional)</label>
                <input type="tel" className={styles.formInput} placeholder="Enter phone number" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email (Optional)</label>
                <input
                  type="email"
                  className={styles.formInput}
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={() => setShowAddPatient(false)}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Add patient logic here
                  setShowAddPatient(false);
                }}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Add Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
