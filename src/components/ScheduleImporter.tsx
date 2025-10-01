import React, { useState } from 'react';
import { simpleAppointmentService } from '../services/simpleAppointment.service';
import { noteActionsService } from '../services/noteActions.service';

interface ParsedAppointment {
  id: string;
  doctorName: string;
  doctorId?: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  patientDOB?: string;
  date: string;
  time: string;
  duration: number;
  visitType: string;
  visitReason: string;
  status: 'scheduled' | 'open' | 'frozen';
  location?: string;
  isVirtual: boolean;
}

const DOCTOR_MAPPING: Record<string, { id: string; fullName: string }> = {
  'veena r watwe': { id: 'doc2', fullName: 'Dr. Veena Watwe' },
  'veena watwe': { id: 'doc2', fullName: 'Dr. Veena Watwe' },
  'kamili wade-reescano': { id: 'doc7', fullName: 'Kamili Wade-Reescano, LMFT' },
  'nadia younus': { id: 'doc8', fullName: 'Dr. Nadia Younus' },
  'rakesh patel': { id: 'doc1', fullName: 'Dr. Rakesh Patel' },
  'rakesh raman patel': { id: 'doc1', fullName: 'Dr. Rakesh Patel' },
  'tess chamakkala': { id: 'doc3', fullName: 'Dr. Tess Chamakkala' },
  'radha bernander': { id: 'doc4', fullName: 'Dr. Radha Bernander' },
  'shannon gregroek': { id: 'doc5', fullName: 'Dr. Shannon Gregroek' },
  'elinia shakya': { id: 'doc6', fullName: 'Dr. Elinia Shakya' },
  'elina shakya': { id: 'doc6', fullName: 'Dr. Elinia Shakya' },
  'ghislaine tonye': { id: 'doc9', fullName: 'Dr. Ghislaine Tonye' },
  'cindy laverde': { id: 'doc10', fullName: 'Dr. Cindy Laverde' },
  'vanessa laverde': { id: 'doc10', fullName: 'Dr. Vanessa Laverde' },
};

export const ScheduleImporter: React.FC = () => {
  const [scheduleText, setScheduleText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [parsedAppointments, setParsedAppointments] = useState<ParsedAppointment[]>([]);
  const [importStatus, setImportStatus] = useState<
    'idle' | 'parsing' | 'importing' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const parseSchedule = () => {
    setImportStatus('parsing');
    setMessage('Parsing schedule data...');

    try {
      const appointments: ParsedAppointment[] = [];
      const lines = scheduleText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);

      let currentDoctor = '';
      let currentDoctorId = '';
      let currentLocation = '';
      let appointmentIdCounter = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // Check for doctor name - handle both formats
        // Format 1: Doctor name on its own line
        // Format 2: Doctor name with office on next line
        const matchedDoctor = Object.entries(DOCTOR_MAPPING).find(([key]) =>
          lowerLine.includes(key)
        );

        if (matchedDoctor) {
          currentDoctor = matchedDoctor[1].fullName;
          currentDoctorId = matchedDoctor[1].id;

          // Check if next line is office location
          if (i + 1 < lines.length && lines[i + 1].toLowerCase().includes('office')) {
            currentLocation = lines[i + 1];
            i++; // Skip the office line
          }
          continue;
        }

        // Also check for standalone office lines (for backward compatibility)
        if (lowerLine.includes('office') && !currentDoctor) {
          currentLocation = line;
          continue;
        }

        // Check for time
        const timeMatch = line.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (timeMatch && currentDoctor) {
          const time = line;
          let duration = 15;
          let patientName = '';
          let patientInfo = '';
          let visitReason = '';
          let status: 'scheduled' | 'open' | 'frozen' = 'scheduled';
          let isVirtual = false;
          let skipToNextTime = false;

          // Look ahead for details
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];

            if (nextLine === 'OPEN') {
              status = 'open';
              i++;
            } else if (nextLine === 'FROZEN') {
              status = 'frozen';
              i++;
            } else if (nextLine.includes('min')) {
              const durationMatch = nextLine.match(/(\d+)min/);
              if (durationMatch) {
                duration = parseInt(durationMatch[1]);
              }
              i++;

              // Get patient info
              if (i + 1 < lines.length) {
                patientName = lines[i + 1];
                i++;

                if (i + 1 < lines.length && lines[i + 1].includes('|')) {
                  patientInfo = lines[i + 1];
                  i++;
                }

                // Get visit reason
                const reasonLines: string[] = [];
                while (i + 1 < lines.length) {
                  const lookAhead = lines[i + 1];
                  if (
                    lookAhead.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i) ||
                    Object.keys(DOCTOR_MAPPING).some(key => lookAhead.toLowerCase().includes(key))
                  ) {
                    break;
                  }
                  reasonLines.push(lookAhead);
                  i++;
                }
                visitReason = reasonLines.join('; ');

                isVirtual =
                  visitReason.toLowerCase().includes('virtual') ||
                  visitReason.toLowerCase().includes('telemedicine') ||
                  visitReason.toLowerCase().includes('not online');
              }
            }
          }

          // Check if this might be a duplicate time slot (multiple appointments at same time)
          // Look for pattern where next time is same as current or very close
          let isDuplicateSlot = false;
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextTimeMatch = nextLine.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (nextTimeMatch && nextLine === time) {
              isDuplicateSlot = true;
            }
          }

          if (status === 'open' || status === 'frozen' || patientName) {
            const appointment: ParsedAppointment = {
              id: `import-${selectedDate}-${appointmentIdCounter++}`,
              doctorName: currentDoctor,
              doctorId: currentDoctorId,
              patientName:
                status === 'open' ? 'OPEN SLOT' : status === 'frozen' ? 'FROZEN' : patientName,
              date: selectedDate,
              time,
              duration,
              visitType: isVirtual ? 'telemedicine' : 'in-person',
              visitReason:
                visitReason ||
                (status === 'open'
                  ? 'Available'
                  : status === 'frozen'
                    ? 'Frozen Slot'
                    : 'Appointment'),
              status,
              location: currentLocation,
              isVirtual,
            };

            if (patientInfo) {
              const infoMatch = patientInfo.match(/(\d+)yo\s*([MF])\s*\|\s*([\d-]+)/);
              if (infoMatch) {
                appointment.patientAge = infoMatch[1];
                appointment.patientGender = infoMatch[2];
                appointment.patientDOB = infoMatch[3];
              }
            }

            appointments.push(appointment);
          }
        }
      }

      setParsedAppointments(appointments);
      setShowPreview(true);
      setImportStatus('idle');
      setMessage(
        `Parsed ${appointments.length} appointments. Review and click Import to add them.`
      );
    } catch (error) {
      setImportStatus('error');
      setMessage(
        `Error parsing schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const importAppointments = async () => {
    setImportStatus('importing');
    setMessage('Importing appointments...');

    try {
      let successCount = 0;

      for (const appt of parsedAppointments) {
        if (appt.status === 'scheduled' && appt.patientName && appt.patientName !== 'OPEN SLOT') {
          // Create a simple appointment
          await simpleAppointmentService.createAppointment({
            patientId: `imported-patient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientName: appt.patientName,
            doctorId: appt.doctorId || 'doc1',
            doctorName: appt.doctorName,
            date: appt.date,
            time: appt.time,
            duration: appt.duration,
            visitType: appt.isVirtual ? 'telemedicine' : 'follow-up',
            visitReason: appt.visitReason,
          });
          successCount++;
        }
      }

      setImportStatus('success');
      setMessage(`Successfully imported ${successCount} appointments!`);
      setScheduleText('');
      setParsedAppointments([]);
      setShowPreview(false);

      // Trigger a refresh of the calendar
      window.dispatchEvent(new Event('appointmentsUpdated'));
    } catch (error) {
      setImportStatus('error');
      setMessage(
        `Error importing appointments: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Import Schedule Data</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paste Schedule Data
          </label>
          <textarea
            value={scheduleText}
            onChange={e => setScheduleText(e.target.value)}
            placeholder="Paste schedule data here (times, patient names, visit types, etc.)"
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={parseSchedule}
            disabled={!scheduleText || importStatus === 'parsing'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {importStatus === 'parsing' ? 'Parsing...' : 'Parse Schedule'}
          </button>

          {parsedAppointments.length > 0 && (
            <button
              onClick={importAppointments}
              disabled={importStatus === 'importing'}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {importStatus === 'importing'
                ? 'Importing...'
                : `Import ${parsedAppointments.length} Appointments`}
            </button>
          )}
        </div>

        {message && (
          <div
            className={`p-3 rounded-md ${
              importStatus === 'error'
                ? 'bg-red-50 text-red-700'
                : importStatus === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {message}
          </div>
        )}

        {showPreview && parsedAppointments.length > 0 && (
          <div className="border rounded-md p-4 max-h-96 overflow-y-auto">
            <h4 className="font-medium mb-2">Preview ({parsedAppointments.length} appointments)</h4>
            <div className="space-y-2 text-sm">
              {parsedAppointments.map((appt, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded ${
                    appt.status === 'open'
                      ? 'bg-gray-50'
                      : appt.status === 'frozen'
                        ? 'bg-yellow-50'
                        : 'bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {appt.time} - {appt.doctorName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        appt.status === 'open'
                          ? 'bg-gray-200'
                          : appt.status === 'frozen'
                            ? 'bg-yellow-200'
                            : appt.isVirtual
                              ? 'bg-purple-200'
                              : 'bg-blue-200'
                      }`}
                    >
                      {appt.status === 'open'
                        ? 'OPEN'
                        : appt.status === 'frozen'
                          ? 'FROZEN'
                          : appt.isVirtual
                            ? 'Virtual'
                            : 'In-Person'}
                    </span>
                  </div>
                  {appt.patientName && appt.patientName !== 'OPEN SLOT' && (
                    <>
                      <div>
                        {appt.patientName}{' '}
                        {appt.patientAge && `(${appt.patientAge}yo ${appt.patientGender})`}
                      </div>
                      <div className="text-gray-600">{appt.visitReason}</div>
                    </>
                  )}
                  <div className="text-gray-500">{appt.duration} min</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
