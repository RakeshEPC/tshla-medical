/**
 * Simple Appointment Service
 * Manages appointments in memory with localStorage persistence
 * Syncs with patient charts
 */

import { chartService } from './chart.service';
import { auditService } from './audit.service';
import type { Chart } from '../types/clinic.types';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface SimpleAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  chartId?: string;
  doctorId: string;
  doctorName: string;
  date: string; // YYYY-MM-DD
  time: string; // "9:00 AM"
  duration: number; // minutes
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  visitType: 'new-patient' | 'follow-up' | 'urgent' | 'procedure' | 'lab-review';
  visitReason: string;
  notes?: string;
  createdAt: Date;
}

class SimpleAppointmentService {
  private appointments: SimpleAppointment[] = [];

  constructor() {
    this.loadAppointments();
    if (this.appointments.length === 0) {
      this.initializeSampleData();
    }
  }

  /**
   * Initialize with sample appointments and charts for this week
   */
  private async initializeSampleData() {
    const today = new Date();
    const weekDates = this.getWeekDates(today);

    // Sample patients distributed across real doctors
    const patients = [
      { id: 'p001', name: 'John Smith', phone: '555-0101', email: 'john@email.com' },
      { id: 'p002', name: 'Sarah Johnson', phone: '555-0102', email: 'sarah@email.com' },
      { id: 'p003', name: 'Michael Brown', phone: '555-0103' },
      { id: 'p004', name: 'Emily Davis', phone: '555-0104', email: 'emily@email.com' },
      { id: 'p005', name: 'Robert Wilson', phone: '555-0105' },
      { id: 'p006', name: 'Lisa Anderson', phone: '555-0106' },
      { id: 'p007', name: 'David Martinez', phone: '555-0107' },
      { id: 'p008', name: 'Jennifer Taylor', email: 'jen@email.com' },
      { id: 'p009', name: 'Christopher Lee', phone: '555-0109' },
      { id: 'p010', name: 'Amanda White', phone: '555-0110' },
      { id: 'p011', name: 'Thomas Garcia', phone: '555-0111' },
      { id: 'p012', name: 'Patricia Rodriguez', phone: '555-0112', email: 'patricia@email.com' },
      { id: 'p013', name: 'Daniel Thompson', phone: '555-0113' },
      { id: 'p014', name: 'Mary Johnson', phone: '555-0114' },
      { id: 'p015', name: 'James Williams', phone: '555-0115', email: 'james@email.com' },
      { id: 'p016', name: 'Emma Chen', phone: '555-0116', email: 'emma@email.com' },
      { id: 'p017', name: 'William Davis', phone: '555-0117' },
      { id: 'p018', name: 'Sophia Martinez', phone: '555-0118', email: 'sophia@email.com' },
      { id: 'p019', name: 'Oliver Harris', phone: '555-0119' },
      { id: 'p020', name: 'Isabella White', phone: '555-0120', email: 'isabella@email.com' },
    ];

    // Create charts for each patient, distributed across real doctors
    const charts: Map<string, Chart> = new Map();
    const doctorAssignments = [
      { id: 'doc1', name: 'Dr. Rakesh Patel' },
      { id: 'doc2', name: 'Dr. Veena Watwe' },
      { id: 'doc3', name: 'Dr. Tess Chamakkala' },
      { id: 'doc4', name: 'Dr. Radha Bernander' },
      { id: 'doc5', name: 'Dr. Shannon Gregroek' },
      { id: 'doc6', name: 'Dr. Elinia Shakya' },
    ];

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      const doctor = doctorAssignments[i % doctorAssignments.length];
      const chart = await chartService.createChart(
        patient.id,
        patient.name,
        doctor.id,
        doctor.name
      );
      charts.set(patient.id, chart);
    }

    // Sample appointments spread across the week
    const sampleAppointments: SimpleAppointment[] = [
      // Monday
      {
        id: 'apt001',
        patientId: 'p001',
        patientName: 'John Smith',
        patientPhone: '555-0101',
        patientEmail: 'john@email.com',
        chartId: charts.get('p001')?.id,
        doctorId: 'doc1',
        doctorName: 'Dr. Rakesh Patel',
        date: this.formatDate(weekDates[0]),
        time: '9:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Diabetes follow-up - A1C review',
        notes: 'Patient on metformin 500mg BID for 3 months',
        createdAt: new Date(Date.now() - 86400000 * 7),
      },
      {
        id: 'apt002',
        patientId: 'p002',
        patientName: 'Sarah Johnson',
        patientPhone: '555-0102',
        chartId: charts.get('p002')?.id,
        doctorId: 'doc2',
        doctorName: 'Dr. Veena Watwe',
        date: this.formatDate(weekDates[0]),
        time: '10:00 AM',
        duration: 45,
        status: 'scheduled',
        visitType: 'new-patient',
        visitReason: 'Initial consultation - Hypertension',
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        id: 'apt003',
        patientId: 'p003',
        patientName: 'Michael Brown',
        chartId: charts.get('p003')?.id,
        doctorId: 'doc1',
        doctorName: 'Dr. Rakesh Patel',
        date: this.formatDate(weekDates[0]),
        time: '11:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Blood pressure check',
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        id: 'apt004',
        patientId: 'p004',
        patientName: 'Emily Davis',
        chartId: charts.get('p004')?.id,
        doctorId: 'doc3',
        doctorName: 'Dr. Tess Chamakkala',
        date: this.formatDate(weekDates[0]),
        time: '2:00 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Thyroid medication adjustment',
        notes: 'Review TSH levels',
        createdAt: new Date(Date.now() - 86400000 * 10),
      },

      // Tuesday
      {
        id: 'apt005',
        patientId: 'p005',
        patientName: 'Robert Wilson',
        chartId: charts.get('p005')?.id,
        doctorId: 'doc2',
        doctorName: 'Dr. Veena Watwe',
        date: this.formatDate(weekDates[1]),
        time: '9:30 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Cholesterol management',
        notes: 'Review lipid panel, consider statin adjustment',
        createdAt: new Date(Date.now() - 86400000 * 8),
      },
      {
        id: 'apt006',
        patientId: 'p006',
        patientName: 'Lisa Anderson',
        chartId: charts.get('p006')?.id,
        doctorId: 'doc1',
        doctorName: 'Dr. Rakesh Patel',
        date: this.formatDate(weekDates[1]),
        time: '10:30 AM',
        duration: 60,
        status: 'scheduled',
        visitType: 'procedure',
        visitReason: 'Annual physical exam',
        createdAt: new Date(Date.now() - 86400000 * 14),
      },
      {
        id: 'apt007',
        patientId: 'p007',
        patientName: 'David Martinez',
        chartId: charts.get('p007')?.id,
        doctorId: 'doc4',
        doctorName: 'Dr. Radha Bernander',
        date: this.formatDate(weekDates[1]),
        time: '2:30 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Weight management consultation',
        createdAt: new Date(Date.now() - 86400000 * 6),
      },
      {
        id: 'apt008',
        patientId: 'p008',
        patientName: 'Jennifer Taylor',
        chartId: charts.get('p008')?.id,
        doctorId: 'doc3',
        doctorName: 'Dr. Tess Chamakkala',
        date: this.formatDate(weekDates[1]),
        time: '4:00 PM',
        duration: 45,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Migraine management',
        notes: 'Consider preventive medication',
        createdAt: new Date(Date.now() - 86400000 * 4),
      },

      // Wednesday
      {
        id: 'apt009',
        patientId: 'p009',
        patientName: 'Christopher Lee',
        chartId: charts.get('p009')?.id,
        doctorId: 'doc2',
        doctorName: 'Dr. Veena Watwe',
        date: this.formatDate(weekDates[2]),
        time: '8:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Asthma control',
        notes: 'Check inhaler technique, spirometry if needed',
        createdAt: new Date(Date.now() - 86400000 * 12),
      },
      {
        id: 'apt010',
        patientId: 'p010',
        patientName: 'Amanda White',
        chartId: charts.get('p010')?.id,
        doctorId: 'doc5',
        doctorName: 'Dr. Shannon Gregroek',
        date: this.formatDate(weekDates[2]),
        time: '10:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Anxiety medication review',
        createdAt: new Date(Date.now() - 86400000 * 9),
      },
      {
        id: 'apt011',
        patientId: 'p011',
        patientName: 'Thomas Garcia',
        chartId: charts.get('p011')?.id,
        doctorId: 'doc1',
        doctorName: 'Dr. Rakesh Patel',
        date: this.formatDate(weekDates[2]),
        time: '11:30 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Post-surgery follow-up',
        notes: 'Check surgical site, remove sutures if healed',
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: 'apt012',
        patientId: 'p001',
        patientName: 'John Smith',
        chartId: charts.get('p001')?.id,
        doctorId: 'doc3',
        doctorName: 'Dr. Tess Chamakkala',
        date: this.formatDate(weekDates[2]),
        time: '3:00 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'lab-review',
        visitReason: 'Review recent lab results',
        createdAt: new Date(Date.now() - 86400000 * 1),
      },

      // Thursday
      {
        id: 'apt013',
        patientId: 'p012',
        patientName: 'Patricia Rodriguez',
        chartId: charts.get('p012')?.id,
        doctorId: 'doc3',
        doctorName: 'Dr. Tess Chamakkala',
        date: this.formatDate(weekDates[3]),
        time: '9:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'lab-review',
        visitReason: 'Discuss A1C and lipid panel results',
        notes: 'A1C trending up, may need medication adjustment',
        createdAt: new Date(Date.now() - 86400000 * 11),
      },
      {
        id: 'apt014',
        patientId: 'p013',
        patientName: 'Daniel Thompson',
        chartId: charts.get('p013')?.id,
        doctorId: 'doc4',
        doctorName: 'Dr. Radha Bernander',
        date: this.formatDate(weekDates[3]),
        time: '10:00 AM',
        duration: 45,
        status: 'scheduled',
        visitType: 'new-patient',
        visitReason: 'Sleep apnea evaluation',
        createdAt: new Date(Date.now() - 86400000 * 7),
      },
      {
        id: 'apt015',
        patientId: 'p014',
        patientName: 'Mary Johnson',
        chartId: charts.get('p014')?.id,
        doctorId: 'doc1',
        doctorName: 'Dr. Rakesh Patel',
        date: this.formatDate(weekDates[3]),
        time: '2:00 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Osteoporosis management',
        notes: 'Discuss bone density results',
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        id: 'apt016',
        patientId: 'p015',
        patientName: 'James Williams',
        chartId: charts.get('p015')?.id,
        doctorId: 'doc2',
        doctorName: 'Dr. Veena Watwe',
        date: this.formatDate(weekDates[3]),
        time: '3:30 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'urgent',
        visitReason: 'Acute back pain',
        createdAt: new Date(),
      },

      // Friday
      {
        id: 'apt017',
        patientId: 'p002',
        patientName: 'Sarah Johnson',
        chartId: charts.get('p002')?.id,
        doctorId: 'doc5',
        doctorName: 'Dr. Shannon Gregroek',
        date: this.formatDate(weekDates[4]),
        time: '8:30 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Depression screening',
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        id: 'apt018',
        patientId: 'p006',
        patientName: 'Lisa Anderson',
        chartId: charts.get('p006')?.id,
        doctorId: 'doc1',
        doctorName: 'Dr. Rakesh Patel',
        date: this.formatDate(weekDates[4]),
        time: '10:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Vaccine administration',
        notes: 'Flu shot and COVID booster',
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: 'apt019',
        patientId: 'p009',
        patientName: 'Christopher Lee',
        chartId: charts.get('p009')?.id,
        doctorId: 'doc4',
        doctorName: 'Dr. Radha Bernander',
        date: this.formatDate(weekDates[4]),
        time: '1:00 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'COPD management',
        createdAt: new Date(Date.now() - 86400000 * 8),
      },
      {
        id: 'apt020',
        patientId: 'p011',
        patientName: 'Thomas Garcia',
        chartId: charts.get('p011')?.id,
        doctorId: 'doc2',
        doctorName: 'Dr. Veena Watwe',
        date: this.formatDate(weekDates[4]),
        time: '3:00 PM',
        duration: 45,
        status: 'scheduled',
        visitType: 'procedure',
        visitReason: 'Skin biopsy',
        notes: 'Suspicious mole on back',
        createdAt: new Date(Date.now() - 86400000 * 4),
      },

      // Additional appointments for Dr. Elinia Shakya
      {
        id: 'apt021',
        patientId: 'p016',
        patientName: 'Emma Chen',
        chartId: charts.get('p016')?.id,
        doctorId: 'doc6',
        doctorName: 'Dr. Elinia Shakya',
        date: this.formatDate(weekDates[0]),
        time: '3:30 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'new-patient',
        visitReason: 'Initial endocrinology consultation',
        notes: 'Referred for possible thyroid disorder',
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        id: 'apt022',
        patientId: 'p017',
        patientName: 'William Davis',
        chartId: charts.get('p017')?.id,
        doctorId: 'doc6',
        doctorName: 'Dr. Elinia Shakya',
        date: this.formatDate(weekDates[1]),
        time: '4:00 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Diabetes management - insulin adjustment',
        notes: 'Review continuous glucose monitor data',
        createdAt: new Date(Date.now() - 86400000 * 7),
      },
      {
        id: 'apt023',
        patientId: 'p018',
        patientName: 'Sophia Martinez',
        chartId: charts.get('p018')?.id,
        doctorId: 'doc6',
        doctorName: 'Dr. Elinia Shakya',
        date: this.formatDate(weekDates[2]),
        time: '9:00 AM',
        duration: 45,
        status: 'scheduled',
        visitType: 'procedure',
        visitReason: 'Thyroid ultrasound and FNA',
        notes: 'Nodule found on previous exam',
        createdAt: new Date(Date.now() - 86400000 * 10),
      },
      {
        id: 'apt024',
        patientId: 'p019',
        patientName: 'Oliver Harris',
        chartId: charts.get('p019')?.id,
        doctorId: 'doc6',
        doctorName: 'Dr. Elinia Shakya',
        date: this.formatDate(weekDates[3]),
        time: '2:00 PM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'Growth hormone therapy review',
        notes: 'Pediatric patient - check growth charts',
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        id: 'apt025',
        patientId: 'p020',
        patientName: 'Isabella White',
        chartId: charts.get('p020')?.id,
        doctorId: 'doc6',
        doctorName: 'Dr. Elinia Shakya',
        date: this.formatDate(weekDates[4]),
        time: '11:00 AM',
        duration: 30,
        status: 'scheduled',
        visitType: 'follow-up',
        visitReason: 'PCOS management',
        notes: 'Review hormone levels and medication compliance',
        createdAt: new Date(Date.now() - 86400000 * 6),
      },
    ];

    this.appointments = sampleAppointments;
    this.saveAppointments();
  }

  /**
   * Get appointments filtered by doctor and/or date
   */
  getAppointments(filters?: {
    doctorId?: string;
    date?: string;
    weekOf?: Date;
  }): SimpleAppointment[] {
    let filtered = [...this.appointments];

    if (filters?.doctorId && filters.doctorId !== 'all') {
      filtered = filtered.filter(a => a.doctorId === filters.doctorId);
    }

    if (filters?.date) {
      filtered = filtered.filter(a => a.date === filters.date);
    }

    if (filters?.weekOf) {
      const weekDates = this.getWeekDates(filters.weekOf);
      const weekStrings = weekDates.map(d => this.formatDate(d));
      filtered = filtered.filter(a => weekStrings.includes(a.date));
    }

    return filtered.sort((a, b) => {
      // Sort by date first, then by time
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return this.timeToMinutes(a.time) - this.timeToMinutes(b.time);
    });
  }

  /**
   * Get appointments for calendar grid view
   */
  getCalendarData(weekOf: Date, doctorId?: string): Map<string, Map<string, SimpleAppointment[]>> {
    const weekDates = this.getWeekDates(weekOf);
    const calendarData = new Map<string, Map<string, SimpleAppointment[]>>();

    // Initialize time slots
    const timeSlots = [
      '8:00 AM',
      '9:00 AM',
      '10:00 AM',
      '11:00 AM',
      '12:00 PM',
      '1:00 PM',
      '2:00 PM',
      '3:00 PM',
      '4:00 PM',
      '5:00 PM',
    ];

    timeSlots.forEach(time => {
      const dayMap = new Map<string, SimpleAppointment[]>();
      weekDates.forEach(date => {
        const dateStr = this.formatDate(date);
        const appointments = this.getAppointments({ doctorId, date: dateStr }).filter(
          a => this.getTimeSlot(a.time) === time
        );
        dayMap.set(dateStr, appointments);
      });
      calendarData.set(time, dayMap);
    });

    return calendarData;
  }

  /**
   * Helper: Get the hour slot for an appointment time
   */
  private getTimeSlot(time: string): string {
    const [timePart, period] = time.split(' ');
    const [hours] = timePart.split(':');
    return `${hours}:00 ${period}`;
  }

  /**
   * Helper: Convert time string to minutes for sorting
   */
  private timeToMinutes(time: string): number {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  /**
   * Helper: Get week dates starting from Monday
   */
  private getWeekDates(startDate: Date): Date[] {
    const dates: Date[] = [];
    const start = new Date(startDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);

    start.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }

    return dates;
  }

  /**
   * Helper: Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Save appointments to localStorage
   */
  private saveAppointments() {
    try {
      localStorage.setItem('tshla_simple_appointments', JSON.stringify(this.appointments));
    } catch (error) {
      logError('simpleAppointment', 'Error message', {});
    }
  }

  /**
   * Load appointments from localStorage
   */
  private loadAppointments() {
    try {
      const saved = localStorage.getItem('tshla_simple_appointments');
      if (saved) {
        this.appointments = JSON.parse(saved);
      }
    } catch (error) {
      logError('simpleAppointment', 'Error message', {});
    }
  }

  /**
   * Clear all appointments
   */
  clearAllAppointments() {
    this.appointments = [];
    this.saveAppointments();
    logDebug('simpleAppointment', 'Debug message', {});
  }

  /**
   * Create a new appointment
   */
  async createAppointment(appointmentData: {
    patientId: string;
    patientName: string;
    patientPhone?: string;
    patientEmail?: string;
    doctorId: string;
    doctorName: string;
    date: string;
    time: string;
    duration: number;
    visitType: 'new-patient' | 'follow-up' | 'urgent' | 'procedure' | 'lab-review' | 'telemedicine';
    visitReason: string;
    notes?: string;
  }): Promise<SimpleAppointment> {
    const newAppointment: SimpleAppointment = {
      id: `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...appointmentData,
      status: 'scheduled',
      createdAt: new Date(),
    };

    // Create chart if needed
    if (!newAppointment.chartId) {
      const chart = await chartService.createChart(
        appointmentData.patientId,
        appointmentData.patientName,
        appointmentData.doctorId,
        appointmentData.doctorName
      );
      newAppointment.chartId = chart.id;
    }

    this.appointments.push(newAppointment);
    this.saveAppointments();

    // Log audit
    await auditService.log('create', 'appointment', newAppointment.id, {
      patientName: appointmentData.patientName,
      doctorName: appointmentData.doctorName,
      date: appointmentData.date,
      time: appointmentData.time,
    });

    return newAppointment;
  }

  /**
   * Get appointment count for a doctor
   */
  getAppointmentCount(doctorId?: string): number {
    if (!doctorId || doctorId === 'all') {
      return this.appointments.length;
    }
    return this.appointments.filter(a => a.doctorId === doctorId).length;
  }

  /**
   * Get color for doctor (for calendar display)
   */
  getDoctorColor(doctorId: string): string {
    const colors: { [key: string]: string } = {
      doc1: 'bg-blue-100 text-blue-800 border-blue-200',
      doc2: 'bg-purple-100 text-purple-800 border-purple-200',
      doc3: 'bg-green-100 text-green-800 border-green-200',
      doc4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      doc5: 'bg-red-100 text-red-800 border-red-200',
      doc6: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[doctorId] || 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export const simpleAppointmentService = new SimpleAppointmentService();
