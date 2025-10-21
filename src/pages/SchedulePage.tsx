import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import type { Template } from '../types/template.types';

interface Appointment {
  id: string;
  time: string;
  patient: string;
  mrn?: string;
  type: string;
  duration: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  template?: Template;
  notes?: string;
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [doctorId, setDoctorId] = useState<string>('');
  const currentDoctor = currentUser?.name || 'Dr. Smith';

  useEffect(() => {
    const loadUser = async () => {
      const result = await unifiedAuthService.getCurrentUser();
      if (result.success && result.user) {
        setCurrentUser(result.user);
        const id = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
        setDoctorId(id);
        doctorProfileService.initialize(id);
        await loadTemplates(id);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    // Load appointments for the selected date
    loadAppointments();
  }, [selectedDate]);

  const loadTemplates = async (id: string) => {
    try {
      const doctorTemplates = await doctorProfileService.getTemplates(id);
      // Convert DoctorTemplate to Template format
      const convertedTemplates: Template[] = doctorTemplates.map((dt: DoctorTemplate) => ({
        id: dt.id,
        name: dt.name,
        description: dt.description || '',
        specialty: 'General',
        template_type: 'custom',
        sections: dt.sections || {},
        created_at: dt.createdAt,
        usage_count: dt.usageCount || 0,
      }));
      setTemplates(convertedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    }
  };

  const loadAppointments = () => {
    // Mock appointments - in production, fetch from backend
    const mockAppointments: Appointment[] = [
      {
        id: '1',
        time: '9:00 AM',
        patient: 'John Smith',
        mrn: 'MRN001',
        type: 'Follow-up',
        duration: 30,
        status: 'scheduled',
      },
      {
        id: '2',
        time: '9:30 AM',
        patient: 'Jane Doe',
        mrn: 'MRN002',
        type: 'New Patient',
        duration: 45,
        status: 'scheduled',
      },
      {
        id: '3',
        time: '10:15 AM',
        patient: 'Bob Johnson (T1D)',
        mrn: 'ENDO003',
        type: 'Pump Check',
        duration: 30,
        status: 'scheduled',
      },
      {
        id: '4',
        time: '10:45 AM',
        patient: 'Available Slot',
        type: 'Open',
        duration: 30,
        status: 'scheduled',
      },
      {
        id: '5',
        time: '11:15 AM',
        patient: 'Alice Brown',
        mrn: 'MRN004',
        type: 'Consultation',
        duration: 30,
        status: 'scheduled',
      },
      {
        id: '6',
        time: '2:00 PM',
        patient: 'Emma Wilson (Age 8)',
        mrn: 'PED001',
        type: 'Diabetes Follow-up',
        duration: 30,
        status: 'scheduled',
      },
      {
        id: '7',
        time: '2:30 PM',
        patient: 'Michael Chen',
        mrn: 'MRN005',
        type: 'Annual Physical',
        duration: 45,
        status: 'scheduled',
      },
      {
        id: '8',
        time: '3:15 PM',
        patient: 'Sarah Davis (T2D)',
        mrn: 'ENDO004',
        type: 'Medication Review',
        duration: 30,
        status: 'scheduled',
      },
    ];

    // Customize based on doctor specialty
    if (
      currentDoctor?.specialty?.includes('Endocrinology') ||
      currentDoctor?.specialty?.includes('Diabetes')
    ) {
      // Add more diabetes-specific appointments
      mockAppointments.forEach(apt => {
        if (apt.patient.includes('T1D') || apt.patient.includes('T2D')) {
          apt.type = 'Diabetes Management';
        }
      });
    }

    setAppointments(mockAppointments);
  };

  const startDictationWithTemplate = async (appointmentId: string, template: Template) => {
    // Track template usage in Supabase
    if (doctorId) {
      try {
        await doctorProfileService.trackTemplateUsage(template.id, doctorId);
      } catch (error) {
        console.error('Error tracking template usage:', error);
      }
    }

    // Navigate to dictation with template
    navigate(`/dictation/${appointmentId}`, {
      state: {
        template,
        appointment: appointments.find(a => a.id === appointmentId),
      },
    });
  };

  const addNewPatient = () => {
    const newPatient = prompt('Enter patient name:');
    if (newPatient) {
      const newAppointment: Appointment = {
        id: `new_${Date.now()}`,
        time: prompt('Enter appointment time (e.g., 4:00 PM):') || '4:00 PM',
        patient: newPatient,
        mrn: `MRN${Math.floor(Math.random() * 10000)}`,
        type: 'New Patient',
        duration: 30,
        status: 'scheduled',
      };
      setAppointments(
        [...appointments, newAppointment].sort((a, b) => {
          // Sort by time
          const timeA = new Date(`2025-01-01 ${a.time}`).getTime();
          const timeB = new Date(`2025-01-01 ${b.time}`).getTime();
          return timeA - timeB;
        })
      );
    }
  };

  const getTemplateRecommendation = (appointmentType: string): Template | undefined => {
    // Recommend template based on appointment type
    if (appointmentType.includes('Pump') || appointmentType.includes('Diabetes')) {
      return templates.find(t => t.id === 'default_pump' || t.specialty === 'Endocrinology');
    }
    if (appointmentType === 'New Patient') {
      return templates.find(t => t.id === 'default_general');
    }
    if (appointmentType.includes('Consultation')) {
      return templates.find(
        t => t.template_type === 'specialty' && t.specialty === currentDoctor?.specialty
      );
    }
    return templates.find(t => t.id === 'default_general');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/doctor')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold">Schedule & Calendar</h1>
              <span className="text-sm text-gray-500">
                {currentDoctor?.name} • {currentDoctor?.specialty}
              </span>
            </div>
            <button
              onClick={addNewPatient}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Patient
            </button>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              ← Previous Day
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">{formatDate(selectedDate)}</h2>
              <p className="text-gray-600">{appointments.length} appointments scheduled</p>
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
              Next Day →
            </button>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="divide-y divide-gray-200">
            {appointments.map(appointment => {
              const recommendedTemplate = getTemplateRecommendation(appointment.type);
              return (
                <div key={appointment.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="text-lg font-medium text-gray-900">{appointment.time}</div>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            appointment.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : appointment.status === 'in-progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : appointment.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {appointment.status}
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-lg font-medium text-gray-900">{appointment.patient}</p>
                        <p className="text-sm text-gray-500">
                          {appointment.mrn && `MRN: ${appointment.mrn} • `}
                          {appointment.type} • {appointment.duration} minutes
                        </p>
                      </div>
                      {appointment.template && (
                        <div className="mt-2 text-sm text-blue-600">
                          Template: {appointment.template.name}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      {appointment.patient !== 'Available Slot' && (
                        <>
                          {/* Template Selection */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setShowTemplateSelector(
                                  showTemplateSelector === appointment.id ? null : appointment.id
                                )
                              }
                              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              {appointment.template ? 'Change Template' : 'Select Template'}
                            </button>

                            {showTemplateSelector === appointment.id && (
                              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-10">
                                <div className="p-4">
                                  <h3 className="font-medium mb-3">Choose Template</h3>
                                  {recommendedTemplate && (
                                    <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                                      <p className="text-sm text-blue-700 font-medium">
                                        Recommended:
                                      </p>
                                      <button
                                        onClick={() => {
                                          appointment.template = recommendedTemplate;
                                          setShowTemplateSelector(null);
                                          setAppointments([...appointments]);
                                        }}
                                        className="mt-1 text-sm text-blue-600 hover:text-blue-700"
                                      >
                                        {recommendedTemplate.name} ({recommendedTemplate.specialty})
                                      </button>
                                    </div>
                                  )}
                                  <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {templates.map(template => (
                                      <button
                                        key={template.id}
                                        onClick={() => {
                                          appointment.template = template;
                                          setShowTemplateSelector(null);
                                          setAppointments([...appointments]);
                                        }}
                                        className="w-full text-left p-2 hover:bg-gray-50 rounded"
                                      >
                                        <div className="font-medium text-sm">{template.name}</div>
                                        <div className="text-xs text-gray-500">
                                          {template.specialty} • {template.template_type}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Start Dictation */}
                          <button
                            onClick={() => {
                              const template =
                                appointment.template || recommendedTemplate || templates[0];
                              startDictationWithTemplate(appointment.id, template);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                          >
                            Start Dictation
                          </button>

                          {/* View Chart */}
                          <button
                            onClick={() => navigate(`/patient/${appointment.mrn}`)}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            View Chart
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-medium text-gray-500">Total Patients</h4>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {appointments.filter(a => a.patient !== 'Available Slot').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-medium text-gray-500">Completed</h4>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {appointments.filter(a => a.status === 'completed').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-medium text-gray-500">Templates Used</h4>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {appointments.filter(a => a.template).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-medium text-gray-500">Available Slots</h4>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {appointments.filter(a => a.patient === 'Available Slot').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
