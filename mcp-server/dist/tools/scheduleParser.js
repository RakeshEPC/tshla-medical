// Map doctor names to our system IDs
const DOCTOR_MAPPING = {
    'veena r watwe': { id: 'doc2', fullName: 'Dr. Veena Watwe' },
    'veena watwe': { id: 'doc2', fullName: 'Dr. Veena Watwe' },
    'kamili wade-reescano': { id: 'doc7', fullName: 'Kamili Wade-Reescano, LMFT' },
    'nadia younus': { id: 'doc8', fullName: 'Dr. Nadia Younus' },
    'rakesh patel': { id: 'doc1', fullName: 'Dr. Rakesh Patel' },
    'tess chamakkala': { id: 'doc3', fullName: 'Dr. Tess Chamakkala' },
    'radha bernander': { id: 'doc4', fullName: 'Dr. Radha Bernander' },
    'shannon gregroek': { id: 'doc5', fullName: 'Dr. Shannon Gregroek' },
    'elinia shakya': { id: 'doc6', fullName: 'Dr. Elinia Shakya' }
};
export async function parseScheduleData(scheduleText, dateStr) {
    const appointments = [];
    const errors = [];
    const lines = scheduleText.split('\n').map(line => line.trim()).filter(line => line);
    let currentDoctor = '';
    let currentDoctorId = '';
    let currentLocation = '';
    let currentDate = dateStr ? new Date(dateStr) : new Date();
    let appointmentIdCounter = 1;
    const summary = {
        totalAppointments: 0,
        byDoctor: {},
        openSlots: 0,
        virtualVisits: 0
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if this is a doctor name line (contains known doctor name or ends with office)
        const lowerLine = line.toLowerCase();
        const matchedDoctor = Object.entries(DOCTOR_MAPPING).find(([key]) => lowerLine.includes(key));
        if (matchedDoctor || lowerLine.includes('office')) {
            if (matchedDoctor) {
                currentDoctor = matchedDoctor[1].fullName;
                currentDoctorId = matchedDoctor[1].id;
            }
            else {
                // Extract doctor name from line like "Doctor Name, Office*"
                const parts = line.split(/[,*]/);
                if (parts.length > 0) {
                    currentDoctor = parts[0].trim();
                    const doctorKey = currentDoctor.toLowerCase();
                    if (DOCTOR_MAPPING[doctorKey]) {
                        currentDoctorId = DOCTOR_MAPPING[doctorKey].id;
                        currentDoctor = DOCTOR_MAPPING[doctorKey].fullName;
                    }
                }
            }
            // Extract location if present
            if (lowerLine.includes('office')) {
                currentLocation = line;
            }
            if (!summary.byDoctor[currentDoctor]) {
                summary.byDoctor[currentDoctor] = 0;
            }
            continue;
        }
        // Check if this is a time line (e.g., "9:00 AM", "2:30 PM")
        const timeMatch = line.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (timeMatch) {
            const time = line;
            let duration = 15; // Default duration
            let patientName = '';
            let patientInfo = '';
            let visitReason = '';
            let status = 'scheduled';
            let isVirtual = false;
            // Look ahead for appointment details
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                // Check for OPEN, FROZEN, or duration
                if (nextLine === 'OPEN') {
                    status = 'open';
                    summary.openSlots++;
                    i++; // Skip this line
                }
                else if (nextLine === 'FROZEN') {
                    status = 'frozen';
                    i++; // Skip this line
                }
                else if (nextLine.includes('min')) {
                    // Extract duration (e.g., "30min", "60min")
                    const durationMatch = nextLine.match(/(\d+)min/);
                    if (durationMatch) {
                        duration = parseInt(durationMatch[1]);
                    }
                    i++; // Skip this line
                    // Get patient name (next line after duration)
                    if (i + 1 < lines.length) {
                        patientName = lines[i + 1];
                        i++;
                        // Get patient info (age, gender, DOB)
                        if (i + 1 < lines.length && lines[i + 1].includes('|')) {
                            patientInfo = lines[i + 1];
                            i++;
                        }
                        // Get visit reason (remaining lines until next time or doctor)
                        const reasonLines = [];
                        while (i + 1 < lines.length) {
                            const lookAhead = lines[i + 1];
                            if (lookAhead.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i) ||
                                DOCTOR_MAPPING[lookAhead.toLowerCase()] ||
                                lookAhead.includes('Office')) {
                                break;
                            }
                            reasonLines.push(lookAhead);
                            i++;
                        }
                        visitReason = reasonLines.join('; ');
                        // Check if virtual
                        isVirtual = visitReason.toLowerCase().includes('virtual') ||
                            visitReason.toLowerCase().includes('telemedicine') ||
                            visitReason.toLowerCase().includes('not online');
                        if (isVirtual) {
                            summary.virtualVisits++;
                        }
                    }
                }
            }
            // Create appointment object
            if (currentDoctor && (status === 'open' || status === 'frozen' || patientName)) {
                const appointment = {
                    id: `parsed-${currentDate.toISOString().split('T')[0]}-${appointmentIdCounter++}`,
                    doctorName: currentDoctor,
                    doctorId: currentDoctorId,
                    patientName: status === 'open' ? 'OPEN SLOT' : (status === 'frozen' ? 'FROZEN' : patientName),
                    date: currentDate.toISOString().split('T')[0],
                    time,
                    duration,
                    visitType: isVirtual ? 'telemedicine' : 'in-person',
                    visitReason: visitReason || (status === 'open' ? 'Available' : 'Appointment'),
                    status,
                    location: currentLocation,
                    isVirtual
                };
                // Parse patient info if available
                if (patientInfo) {
                    const infoMatch = patientInfo.match(/(\d+)yo\s*([MF])\s*\|\s*([\d-]+)/);
                    if (infoMatch) {
                        appointment.patientAge = infoMatch[1];
                        appointment.patientGender = infoMatch[2];
                        appointment.patientDOB = infoMatch[3];
                    }
                }
                appointments.push(appointment);
                if (status === 'scheduled') {
                    summary.totalAppointments++;
                    summary.byDoctor[currentDoctor]++;
                }
            }
        }
    }
    return {
        success: appointments.length > 0,
        appointments,
        errors,
        summary
    };
}
//# sourceMappingURL=scheduleParser.js.map