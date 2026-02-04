/**
 * Schedule Import Service
 * Handles bulk import of appointment schedules from CSV/TSV files
 */

import { appointmentService, type AppointmentCreateData } from './appointment.service';
import { supabaseAuthService as unifiedAuthService } from './supabaseAuth.service';
import { simpleAppointmentService } from './simpleAppointment.service';
import { aiScheduleParserService } from './aiScheduleParser.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface ImportedAppointment {
  apptdate: string;
  patient_firstname: string;
  patientid: string;
  patient_lastname: string;
  patientdob: string;
  patient_email: string;
  patient_homephone: string;
  patient_mobile?: string;
  rndrng_prvdr: string;
  apptscheduletime?: string;
  appt_schdlng_prvdrfullnme?: string; // Provider full name
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  appointments?: any[];
}

// Provider mapping - handles both codes and full names
const PROVIDER_MAPPING: Record<string, { email: string; name: string; id: string }> = {
  // Provider codes
  'GC_EPC_Adeleke_A': { email: 'adeleke@tshla.ai', name: 'Dr. Adenike Adeleke', id: 'doc_adeleke' },
  'GC_EPC_Chamakkala_T': { email: 'tess@tshla.ai', name: 'Dr. Tess Chamakkala', id: 'doc_tess' },
  'GC_EPC_Shakya_E': { email: 'elina@tshla.ai', name: 'Dr. Elina Shakya', id: 'doc_elina' },
  'GC_EPC_Watwe_V': { email: 'veena@tshla.ai', name: 'Dr. Veena Watwe', id: 'doc_veena' },
  'GC_EPC_Bernander_R': { email: 'radha@tshla.ai', name: 'Dr. Radha Bernander', id: 'doc_radha' },
  'GC_EPC_Laverde_V': { email: 'vanessa@tshla.ai', name: 'Dr. Cindy Laverde', id: 'doc_vanessa' },
  'GC_EPC_Laverde_C': { email: 'vanessa@tshla.ai', name: 'Dr. Cindy Laverde', id: 'doc_vanessa' },
  'GC_EPC_Tonye_G': { email: 'ghislaine@tshla.ai', name: 'Dr. Ghislaine Tonye', id: 'doc_ghislaine' },
  'GC_EPC_Gregorek_S': { email: 'shannon@tshla.ai', name: 'Dr. Shannon Gregorek', id: 'doc_shannon' },
  'GC_EPC_Gregroek_S': { email: 'shannon@tshla.ai', name: 'Dr. Shannon Gregorek', id: 'doc_shannon' },
  
  // Full names - LASTNAME, FIRSTNAME format
  'ADELEKE, ADENIKE': { email: 'adeleke@tshla.ai', name: 'Dr. Adenike Adeleke', id: 'doc_adeleke' },
  'BERNANDER, RADHA': { email: 'radha@tshla.ai', name: 'Dr. Radha Bernander', id: 'doc_radha' },
  'CHAMAKKALA, TESS': { email: 'tess@tshla.ai', name: 'Dr. Tess Chamakkala', id: 'doc_tess' },
  'GREGOREK, SHANNON': { email: 'shannon@tshla.ai', name: 'Dr. Shannon Gregorek', id: 'doc_shannon' },
  'LAVERDE, CINDY': { email: 'vanessa@tshla.ai', name: 'Dr. Cindy Laverde', id: 'doc_vanessa' },
  'PATEL, NEHA': { email: 'neha@tshla.ai', name: 'Dr. Neha Patel', id: 'doc_neha' },
  'PATEL, RAKESH': { email: 'rakesh.patel@tshla.ai', name: 'Dr. Rakesh Patel', id: 'doc_rakesh_patel' },
  'PATEL-KONASAGAR, KRUTI': { email: 'kruti@tshla.ai', name: 'Dr. Kruti Patel-Konasagar', id: 'doc_kruti' },
  'RAGHU, PREEYA': { email: 'preeya@tshla.ai', name: 'Dr. Preeya Raghu', id: 'doc_preeya' },
  'SHAKYA, ELINA': { email: 'elina@tshla.ai', name: 'Dr. Elina Shakya', id: 'doc_elina' },
  'SUBAWALLA, DILNAVAZ': { email: 'dilnavaz@tshla.ai', name: 'Dr. Dilnavaz Subawalla', id: 'doc_dilnavaz' },
  'TONYE, GHISLAINE': { email: 'ghislaine@tshla.ai', name: 'Dr. Ghislaine Tonye', id: 'doc_ghislaine' },
  'WADE-REESCANO, KAMILI': { email: 'kamili@tshla.ai', name: 'Dr. Kamili Wade-Reescano', id: 'doc_kamili' },
  'WATWE, VEENA': { email: 'veena@tshla.ai', name: 'Dr. Veena Watwe', id: 'doc_veena' },
  'YOUNUS, NADIA': { email: 'nadia@tshla.ai', name: 'Dr. Nadia Younus', id: 'doc_nadia' },
  'LEAL, ELIZABETH': { email: 'elizabeth@tshla.ai', name: 'Dr. Elizabeth Leal', id: 'doc_elizabeth' },
  'NEBEOLISA, OGECHI': { email: 'ogechi@tshla.ai', name: 'Dr. Ogechi Nebeolisa', id: 'doc_ogechi' },
  
  // Just last names (common in some formats)
  'ADELEKE': { email: 'adeleke@tshla.ai', name: 'Dr. Adenike Adeleke', id: 'doc_adeleke' },
  'ADENIKE': { email: 'adeleke@tshla.ai', name: 'Dr. Adenike Adeleke', id: 'doc_adeleke' },
  'BERNANDER': { email: 'radha@tshla.ai', name: 'Dr. Radha Bernander', id: 'doc_radha' },
  'CHAMAKKALA': { email: 'tess@tshla.ai', name: 'Dr. Tess Chamakkala', id: 'doc_tess' },
  'GREGOREK': { email: 'shannon@tshla.ai', name: 'Dr. Shannon Gregorek', id: 'doc_shannon' },
  'SHANNON': { email: 'shannon@tshla.ai', name: 'Dr. Shannon Gregorek', id: 'doc_shannon' },
  'LAVERDE': { email: 'vanessa@tshla.ai', name: 'Dr. Cindy Laverde', id: 'doc_vanessa' },
  'PATEL': { email: 'neha@tshla.ai', name: 'Dr. Neha Patel', id: 'doc_neha' },
  'RAKESH': { email: 'rakesh.patel@tshla.ai', name: 'Dr. Rakesh Patel', id: 'doc_rakesh_patel' },
  'RAKESH PATEL': { email: 'rakesh.patel@tshla.ai', name: 'Dr. Rakesh Patel', id: 'doc_rakesh_patel' },
  'DR RAKESH PATEL': { email: 'rakesh.patel@tshla.ai', name: 'Dr. Rakesh Patel', id: 'doc_rakesh_patel' },
  'SHAKYA': { email: 'elina@tshla.ai', name: 'Dr. Elina Shakya', id: 'doc_elina' },
  'TONYE': { email: 'ghislaine@tshla.ai', name: 'Dr. Ghislaine Tonye', id: 'doc_ghislaine' },
  'WATWE': { email: 'veena@tshla.ai', name: 'Dr. Veena Watwe', id: 'doc_veena' },
  'YOUNUS': { email: 'nadia@tshla.ai', name: 'Dr. Nadia Younus', id: 'doc_nadia' },
  'LEAL': { email: 'elizabeth@tshla.ai', name: 'Dr. Elizabeth Leal', id: 'doc_elizabeth' },
  'NEBEOLISA': { email: 'ogechi@tshla.ai', name: 'Dr. Ogechi Nebeolisa', id: 'doc_ogechi' },
  'SUBAWALLA': { email: 'dilnavaz@tshla.ai', name: 'Dr. Dilnavaz Subawalla', id: 'doc_dilnavaz' },
  'RAGHU': { email: 'preeya@tshla.ai', name: 'Dr. Preeya Raghu', id: 'doc_preeya' },
  'WADE-REESCANO': { email: 'kamili@tshla.ai', name: 'Dr. Kamili Wade-Reescano', id: 'doc_kamili' },
  'KAMILI': { email: 'kamili@tshla.ai', name: 'Dr. Kamili Wade-Reescano', id: 'doc_kamili' },
  
  // Special cases
  'IDEAL PROTEIN COACH,': { email: 'coach@tshla.ai', name: 'Ideal Protein Coach', id: 'doc_coach' },
  'IDEAL PROTEIN COACH': { email: 'coach@tshla.ai', name: 'Ideal Protein Coach', id: 'doc_coach' },
  'EPCTHRIVE,': { email: 'epcthrive@tshla.ai', name: 'EPCThrive', id: 'doc_epcthrive' },
  'EPCTHRIVE': { email: 'epcthrive@tshla.ai', name: 'EPCThrive', id: 'doc_epcthrive' },
  'CGMS KATY,': { email: 'cgms@tshla.ai', name: 'CGMS Katy', id: 'doc_cgms' },
  'CGMS KATY': { email: 'cgms@tshla.ai', name: 'CGMS Katy', id: 'doc_cgms' }
};

class ScheduleImportService {
  /**
   * Parse CSV/TSV content into appointment objects
   */
  parseScheduleFile(content: string): ImportedAppointment[] {
    const lines = content.trim().split('\n');
    const appointments: ImportedAppointment[] = [];

    if (lines.length < 2) return appointments;

    // Skip first line if it's a report name header (e.g., "REPORT NAME : ...")
    let headerLineIndex = 0;
    if (lines[0].toUpperCase().startsWith('REPORT NAME')) {
      headerLineIndex = 1;
    }

    if (lines.length < headerLineIndex + 2) return appointments;

    // Parse header to determine column positions
    const headerLine = lines[headerLineIndex];
    const delimiter = headerLine.includes('\t') ? '\t' : ',';
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    
    // Map header positions
    const columnMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      // Normalize header names to match expected fields
      if (header.includes('apptdate') || header.includes('appointmentdate') || (header === 'date' && !header.includes('birth'))) {
        columnMap['apptdate'] = index;
      }
      if (header.includes('firstname') || header === 'patientfirstname' || header === 'first') {
        columnMap['firstname'] = index;
      }
      if (header.includes('lastname') || header === 'patientlastname' || header === 'last') {
        columnMap['lastname'] = index;
      }
      if (header.includes('patientid') || header === 'id' || header === 'mrn' || header === 'patientnumber') {
        columnMap['patientid'] = index;
      }
      if (header.includes('dob') || header.includes('dateofbirth') || header.includes('patientdob') || header.includes('birthdate')) {
        columnMap['dob'] = index;
      }
      if (header.includes('email') || header.includes('patientemail')) {
        columnMap['email'] = index;
      }
      if (header.includes('phone') || header.includes('homephone') || header.includes('patienthomephone')) {
        columnMap['phone'] = index;
      }
      if (header.includes('mobile') || header.includes('cell') || header.includes('patientmobile')) {
        columnMap['mobile'] = index;
      }
      // Provider should be more specific to avoid matching date columns
      if (header.includes('prvdr') || header.includes('provider') || header.includes('rndrng') || 
          header.includes('schdlng') || header.includes('doctor') || header.includes('physician')) {
        columnMap['provider'] = index;
      }
      if (header === 'apptstarttime' || (header.includes('time') && !header.includes('cancelled') && !header.includes('schedule')) || header.includes('appointmenttime')) {
        columnMap['time'] = index;
      }
    });
    
    // Debug log the column mapping
    logDebug('scheduleImport', 'Debug message', {});
    logDebug('scheduleImport', 'Debug message', {});

    // Process data rows (start after header)
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(delimiter).map(p => p.trim());
      
      // Skip if row doesn't have enough data
      if (parts.length < 5) continue;
      
      // Build appointment object using mapped columns
      const appointment: ImportedAppointment = {
        apptdate: columnMap['apptdate'] !== undefined ? parts[columnMap['apptdate']] : '',
        patient_firstname: columnMap['firstname'] !== undefined ? parts[columnMap['firstname']] : '',
        patient_lastname: columnMap['lastname'] !== undefined ? parts[columnMap['lastname']] : '',
        patientid: columnMap['patientid'] !== undefined ? parts[columnMap['patientid']] : '',
        patientdob: columnMap['dob'] !== undefined ? parts[columnMap['dob']] : '',
        patient_email: columnMap['email'] !== undefined ? 
          (parts[columnMap['email']] === 'No Email' ? '' : parts[columnMap['email']]) : '',
        patient_homephone: columnMap['phone'] !== undefined ? parts[columnMap['phone']] : '',
        patient_mobile: columnMap['mobile'] !== undefined ? parts[columnMap['mobile']] : '',
        rndrng_prvdr: columnMap['provider'] !== undefined ? parts[columnMap['provider']] : '',
        appt_schdlng_prvdrfullnme: columnMap['provider'] !== undefined ? parts[columnMap['provider']] : '',
        apptscheduletime: columnMap['time'] !== undefined ? parts[columnMap['time']] : ''
      };
      
      // Debug first few rows
      if (i <= 3) {
        logDebug('scheduleImport', 'Debug message', {});
        logDebug('scheduleImport', 'Debug message', {});
      }
      
      // Only add if we have minimum required fields
      // Include rows with dates and provider info even if patient data is placeholder
      const hasValidDate = appointment.apptdate && appointment.apptdate !== '-';
      const hasValidProvider = (appointment.rndrng_prvdr && appointment.rndrng_prvdr !== '-') ||
                               (appointment.appt_schdlng_prvdrfullnme && appointment.appt_schdlng_prvdrfullnme !== '-');
      
      // Row is valid if it has date and provider (even if patient info is placeholder)
      if (hasValidDate && hasValidProvider) {
        // If patient info is placeholder, generate temporary values
        if (appointment.patient_firstname === '-' || !appointment.patient_firstname) {
          appointment.patient_firstname = 'Available';
        }
        if (appointment.patient_lastname === '-' || !appointment.patient_lastname) {
          appointment.patient_lastname = 'Slot';
        }
        if (appointment.patientid === '-' || !appointment.patientid) {
          appointment.patientid = `slot-${i}-${Date.now()}`;
        }
        
        appointments.push(appointment);
      }
    }
    
    return appointments;
  }
  
  /**
   * Convert date from MM/DD/YYYY to YYYY-MM-DD
   */
  private formatDate(dateStr: string): string {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  /**
   * Convert time from HH:MM AM/PM format or generate if not provided
   */
  private formatTimeSlot(timeStr: string | undefined, index: number, totalForDay: number): string {
    // If time is provided in the data, use it
    if (timeStr && timeStr.includes(':')) {
      // Handle formats like "07:10 PM" or "7:10 PM"
      const cleanTime = timeStr.trim();
      if (cleanTime.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) {
        return cleanTime.toUpperCase();
      }
    }
    
    // Otherwise generate time slot
    const startHour = 9; // Start at 9 AM
    const endHour = 17; // End at 5 PM
    const totalSlots = endHour - startHour;
    
    // Calculate time based on index
    const minutesPerAppointment = (totalSlots * 60) / totalForDay;
    const totalMinutes = index * minutesPerAppointment;
    const hours = Math.floor(totalMinutes / 60) + startHour;
    const minutes = Math.floor(totalMinutes % 60);
    
    // Format as 12-hour time
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours;
    const displayMinutes = minutes === 0 ? '00' : minutes < 10 ? `0${minutes}` : minutes;
    
    return `${displayHour}:${displayMinutes} ${period}`;
  }
  
  /**
   * Import appointments into the system with AI assistance
   */
  async importAppointmentsWithAI(
    fileContent: string,
    createdBy: string,
    clearExisting: boolean = false
  ): Promise<ImportResult> {
    const errors: string[] = [];
    const imported: any[] = [];
    let failedCount = 0;
    
    try {
      logDebug('scheduleImport', 'Debug message', {});
      
      // Debug: Check input file
      const inputLines = fileContent.trim().split('\n');
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      
      // Clear existing appointments if requested
      if (clearExisting) {
        simpleAppointmentService.clearAllAppointments();
        logInfo('scheduleImport', 'Info message', {});
      } else {
        logDebug('scheduleImport', 'Debug message', {});
      }
      
      // Use AI to parse the schedule
      const aiResult = await aiScheduleParserService.parseScheduleWithAI(fileContent);
      
      if (aiResult.appointments.length === 0) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          errors: ['No valid appointments found in file. ' + aiResult.suggestions.join('; ')]
        };
      }
      
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      
      // Track duplicates
      const seenAppointments = new Set<string>();
      const duplicateCount = { count: 0 };
      let processedCount = 0;
      
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      
      // Process each AI-parsed appointment
      for (const aiAppt of aiResult.appointments) {
        processedCount++;
        
        // Create unique key for duplicate detection
        // Only consider it a duplicate if it's the SAME patient with SAME doctor at SAME date/time
        const date = aiAppt.date || 'no-date';
        const rawTime = aiAppt.time || 'no-time';
        
        // Normalize time for better duplicate detection
        const normalizedTime = this.normalizeTime(rawTime) || rawTime;
        
        const patientFirst = aiAppt.patientFirstName || '';
        const patientLast = aiAppt.patientLastName || '';
        const patientId = aiAppt.patientId || '';
        const provider = aiAppt.providerName || aiAppt.providerCode || 'unknown';
        
        // Create unique key: patient+provider+date+normalized_time
        // This allows same patient to have appointments with different doctors or at different times
        const apptKey = `${patientId || (patientFirst + patientLast)}|${provider}|${date}|${normalizedTime}`.toLowerCase().trim();
        
        // Debug logging for first few appointments
        if (processedCount <= 5) {
          logDebug('scheduleImport', 'Debug message', {});
          logDebug('scheduleImport', 'Debug message', {});
        }
        
        if (seenAppointments.has(apptKey)) {
          duplicateCount.count++;
          if (duplicateCount.count <= 5) { // Only log first 5 duplicates
            logDebug('scheduleImport', 'Debug message', {});
          }
          continue;
        }
        seenAppointments.add(apptKey);
        
        if (processedCount % 100 === 0) {
          logDebug('scheduleImport', 'Debug message', {});
        }
        try {
          // Map provider name to our system
          let doctorInfo = null;
          
          if (aiAppt.providerName || aiAppt.providerCode) {
            const providerKey = aiAppt.providerCode || aiAppt.providerName || '';
            
            // Debug logging (only for first few to reduce noise)
            if (processedCount <= 3) {
              logDebug('scheduleImport', 'Debug message', {});
              logDebug('scheduleImport', 'Debug message', {});
              logDebug('scheduleImport', 'Debug message', {});
            }
            
            // Try exact match first (case-insensitive)
            const exactMatch = Object.entries(PROVIDER_MAPPING).find(([key]) => 
              key.toUpperCase() === providerKey.toUpperCase()
            );
            
            if (exactMatch) {
              doctorInfo = exactMatch[1];
              if (processedCount <= 3) {
                logInfo('scheduleImport', 'Info message', {});
              }
            }
            
            // Try without trailing comma/spaces
            if (!doctorInfo && providerKey) {
              const cleanKey = providerKey.replace(/[,\s]+$/, '').trim();
              const cleanMatch = Object.entries(PROVIDER_MAPPING).find(([key]) => 
                key.toUpperCase() === cleanKey.toUpperCase()
              );
              
              if (cleanMatch) {
                doctorInfo = cleanMatch[1];
                logInfo('scheduleImport', 'Info message', {});
              }
            }
            
            // Try last name only match
            if (!doctorInfo && providerKey) {
              const lastName = providerKey.split(',')[0].trim().toUpperCase();
              const lastNameMatch = Object.entries(PROVIDER_MAPPING).find(([key]) => {
                const keyLastName = key.split(',')[0].trim().toUpperCase();
                return keyLastName === lastName || key.toUpperCase() === lastName;
              });
              
              if (lastNameMatch) {
                doctorInfo = lastNameMatch[1];
                logInfo('scheduleImport', 'Info message', {});
              }
            }
            
            // Try partial match
            if (!doctorInfo && providerKey) {
              const partialMatch = Object.entries(PROVIDER_MAPPING).find(([key]) => {
                const upperKey = key.toUpperCase();
                const upperProvider = providerKey.toUpperCase();
                return upperKey.includes(upperProvider) || upperProvider.includes(upperKey);
              });
              
              if (partialMatch) {
                doctorInfo = partialMatch[1];
                logInfo('scheduleImport', 'Info message', {});
              }
            }
          }
          
          // Use rotating default doctors if no match (to distribute load)
          if (!doctorInfo) {
            const defaultDoctors = [
              { email: 'tess@tshla.ai', name: 'Dr. Tess Chamakkala', id: 'doc_tess' },
              { email: 'elina@tshla.ai', name: 'Dr. Elina Shakya', id: 'doc_elina' },
              { email: 'veena@tshla.ai', name: 'Dr. Veena Watwe', id: 'doc_veena' },
              { email: 'radha@tshla.ai', name: 'Dr. Radha Bernander', id: 'doc_radha' },
              { email: 'shannon@tshla.ai', name: 'Dr. Shannon Gregorek', id: 'doc_shannon' },
              { email: 'adeleke@tshla.ai', name: 'Dr. Adenike Adeleke', id: 'doc_adeleke' },
              { email: 'rakesh.patel@tshla.ai', name: 'Dr. Rakesh Patel', id: 'doc_rakesh_patel' }
            ];
            const defaultIndex = imported.length % defaultDoctors.length;
            doctorInfo = defaultDoctors[defaultIndex];
            
            logDebug('scheduleImport', 'Debug message', {});
            logDebug('scheduleImport', 'Debug message', {});
            
            // Track unmatched providers for analysis
            if (!errors.find(e => e.includes(`Unmatched provider: ${aiAppt.providerName || aiAppt.providerCode}`))) {
              errors.push(`Info: Unmatched provider: "${aiAppt.providerName || aiAppt.providerCode}" - please add to mapping`);
            }
          }
          
          // Format dates
          const appointmentDate = aiAppt.date ? this.formatDate(aiAppt.date) : '';
          const patientDob = aiAppt.patientDob ? this.formatDate(aiAppt.patientDob) : '';
          
          // Create appointment in simple service (always works)
          await simpleAppointmentService.createAppointment({
            patientId: aiAppt.patientId || `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientName: `${aiAppt.patientFirstName || ''} ${aiAppt.patientLastName || ''}`.trim() || 'Unknown Patient',
            patientPhone: aiAppt.patientPhone || aiAppt.patientMobile || '',
            patientEmail: aiAppt.patientEmail || '',
            doctorId: doctorInfo.id,
            doctorName: doctorInfo.name,
            date: appointmentDate,
            time: this.normalizeTime(aiAppt.time) || this.generateTimeSlot(imported.length),
            duration: 30,
            visitType: aiAppt.visitType || 'follow-up',
            visitReason: 'Scheduled Visit',
            notes: `Imported with ${Math.round(aiAppt.confidence * 100)}% confidence. Provider: ${aiAppt.providerName || aiAppt.providerCode || 'Unknown'}`
          });
          
          imported.push({
            id: `import-${Date.now()}-${imported.length}`,
            patient_name: `${aiAppt.patientFirstName || ''} ${aiAppt.patientLastName || ''}`.trim(),
            doctor_name: doctorInfo.name,
            appointment_date: appointmentDate,
            appointment_time: aiAppt.time || 'TBD',
            confidence: aiAppt.confidence
          });
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to import appointment: ${errorMsg}`);
          failedCount++;
        }
      }
      
      // Add AI suggestions to errors if helpful
      if (aiResult.suggestions.length > 0) {
        errors.push(...aiResult.suggestions.map(s => `Suggestion: ${s}`));
      }
      
      // Final import summary
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      
      // Log duplicate information
      if (duplicateCount.count > 0) {
        errors.push(`Info: Skipped ${duplicateCount.count} duplicate appointments`);
      }
      
      return {
        success: imported.length > 0,
        imported: imported.length,
        failed: failedCount,
        duplicates: duplicateCount.count,
        errors,
        appointments: imported
      };
      
    } catch (error) {
      logError('scheduleImport', 'Error message', {});
      // Fall back to the original import method
      return this.importAppointments(fileContent, createdBy);
    }
  }
  
  /**
   * Normalize time format to handle various input formats
   */
  private normalizeTime(timeStr: string | undefined): string | null {
    if (!timeStr) return null;
    
    // Remove any invalid characters
    const cleanTime = timeStr.trim();
    
    // Check for standard time format
    if (cleanTime.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) {
      return cleanTime.toUpperCase();
    }
    
    // Handle times like "380:00" by converting to valid times
    if (cleanTime.match(/^\d+:\d{2}$/)) {
      const [hoursStr, minutesStr] = cleanTime.split(':');
      let hours = parseInt(hoursStr);
      const minutes = parseInt(minutesStr);
      
      // If hours > 24, wrap around
      if (hours >= 24) {
        hours = 9 + (hours % 8); // Map to 9 AM - 5 PM range
      }
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    
    // Try to parse as 24-hour format
    if (cleanTime.match(/^\d{1,2}:\d{2}$/)) {
      const [hoursStr, minutesStr] = cleanTime.split(':');
      const hours = parseInt(hoursStr);
      const minutes = parseInt(minutesStr);
      
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
    }
    
    return null;
  }
  
  /**
   * Generate a time slot for appointments without times
   */
  private generateTimeSlot(index: number): string {
    const startHour = 9;
    const endHour = 17; // 5 PM
    const slotsPerDay = (endHour - startHour) * 2; // 30-minute slots
    
    // Wrap around to distribute across working hours
    const slotInDay = index % slotsPerDay;
    const totalMinutes = slotInDay * 30;
    const hours = Math.floor(totalMinutes / 60) + startHour;
    const minutes = totalMinutes % 60;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  /**
   * Import appointments into the system (original method as fallback)
   */
  async importAppointments(
    fileContent: string,
    createdBy: string
  ): Promise<ImportResult> {
    const errors: string[] = [];
    const imported: any[] = [];
    let failedCount = 0;
    
    try {
      // Parse the file
      const appointments = this.parseScheduleFile(fileContent);
      
      if (appointments.length === 0) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          errors: ['No valid appointments found in file']
        };
      }
      
      // Debug first appointment to see what we got
      logDebug('scheduleImport', 'Debug message', {});
      logDebug('scheduleImport', 'Debug message', {});
      
      // Group appointments by date and doctor
      const groupedAppointments = new Map<string, ImportedAppointment[]>();
      
      for (const appt of appointments) {
        // Use provider or default to 'unknown'
        const providerKey = appt.rndrng_prvdr || appt.appt_schdlng_prvdrfullnme || 'unknown';
        const key = `${appt.apptdate}_${providerKey}`;
        if (!groupedAppointments.has(key)) {
          groupedAppointments.set(key, []);
        }
        groupedAppointments.get(key)!.push(appt);
      }
      
      // Process each group
      for (const [key, appts] of groupedAppointments) {
        const parts = key.split('_');
        const date = parts[0];
        const provider = parts.slice(1).join('_'); // Handle provider names with underscores
        
        // Try to find doctor info - check both provider code and full name
        let doctorInfo = PROVIDER_MAPPING[provider];
        
        // If not found by code, try by full name (handle variations)
        if (!doctorInfo && appts[0]?.appt_schdlng_prvdrfullnme) {
          const fullName = appts[0].appt_schdlng_prvdrfullnme.trim();
          doctorInfo = PROVIDER_MAPPING[fullName];
        }
        
        // Try to match by partial name
        if (!doctorInfo && provider && provider !== 'unknown') {
          // Try to find a match in our mapping
          for (const [mapKey, mapValue] of Object.entries(PROVIDER_MAPPING)) {
            if (mapKey.toLowerCase().includes(provider.toLowerCase()) || 
                provider.toLowerCase().includes(mapKey.toLowerCase())) {
              doctorInfo = mapValue;
              break;
            }
          }
        }
        
        if (!doctorInfo) {
          // Use a default doctor or skip
          if (provider && provider.trim() && provider !== 'unknown') {
            errors.push(`Unknown provider: ${provider} (first patient: ${appts[0]?.patient_firstname} ${appts[0]?.patient_lastname})`);
            failedCount += appts.length;
          } else {
            // If no provider specified, use a default
            doctorInfo = { email: 'tess@tshla.ai', name: 'Dr. Tess Chamakkala', id: 'doc_tess' };
            logDebug('scheduleImport', 'Debug message', {});
          }
          if (!doctorInfo) continue;
        }
        
        // Process appointments for this doctor on this date
        for (let i = 0; i < appts.length; i++) {
          const appt = appts[i];
          
          try {
            const appointmentData: AppointmentCreateData = {
              patient_name: `${appt.patient_firstname} ${appt.patient_lastname}`.trim(),
              patient_mrn: appt.patientid,
              patient_id: appt.patientid,
              patient_phone: appt.patient_homephone,
              patient_email: appt.patient_email,
              patient_dob: this.formatDate(appt.patientdob),
              appointment_date: this.formatDate(appt.apptdate),
              appointment_time: this.formatTimeSlot(appt.apptscheduletime, i, appts.length),
              duration_minutes: 30,
              visit_type: 'follow-up',
              location: 'Main Clinic'
            };
            
            // Create appointment in database if available
            let result: any;
            try {
              result = await appointmentService.createAppointment(
                doctorInfo.id,
                appointmentData,
                createdBy
              );
            } catch (dbError) {
              // If database fails, use in-memory service
              logDebug('scheduleImport', 'Debug message', {});
            }
            
            // Also create in the simple appointment service for calendar display
            await simpleAppointmentService.createAppointment({
              patientId: appt.patientid,
              patientName: `${appt.patient_firstname} ${appt.patient_lastname}`.trim(),
              patientPhone: appt.patient_homephone,
              patientEmail: appt.patient_email,
              doctorId: doctorInfo.id,
              doctorName: doctorInfo.name,
              date: this.formatDate(appt.apptdate),
              time: this.formatTimeSlot(appt.apptscheduletime, i, appts.length),
              duration: 30,
              visitType: 'follow-up',
              visitReason: 'Scheduled Visit',
              notes: `Imported from schedule - Provider: ${provider}`
            });
            
            imported.push({
              id: `import-${Date.now()}-${i}`,
              patient_name: `${appt.patient_firstname} ${appt.patient_lastname}`.trim(),
              doctor_name: doctorInfo.name,
              appointment_date: this.formatDate(appt.apptdate),
              appointment_time: this.formatTimeSlot(appt.apptscheduletime, i, appts.length)
            });
            
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to import ${appt.patient_firstname} ${appt.patient_lastname}: ${errorMsg}`);
            failedCount++;
          }
        }
      }
      
      return {
        success: imported.length > 0,
        imported: imported.length,
        failed: failedCount,
        duplicates: duplicateCount.count,
        errors,
        appointments: imported
      };
      
    } catch (error) {
      return {
        success: false,
        imported: 0,
        failed: appointments.length,
        errors: [error instanceof Error ? error.message : 'Failed to import appointments']
      };
    }
  }
  
  /**
   * Validate file format
   */
  validateFile(content: string): { valid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      return { valid: false, error: 'File must contain header and at least one appointment' };
    }
    
    // Check header - normalize spaces and special characters
    const header = lines[0].toLowerCase()
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/_/g, ''); // Remove underscores
    
    logDebug('scheduleImport', 'Debug message', {}); // Debug log
    
    // Check for date field variations
    const hasDateField = header.includes('apptdate') || 
                        header.includes('appointmentdate') ||
                        header.includes('date');
    
    // Check for name field variations (more flexible)
    const hasFirstName = header.includes('firstname') || 
                        header.includes('first') ||
                        header.includes('fname') ||
                        header.includes('patientfirstname');
                        
    const hasLastName = header.includes('lastname') || 
                       header.includes('last') ||
                       header.includes('lname') ||
                       header.includes('patientlastname');
    
    const hasNameFields = hasFirstName && hasLastName;
    
    // Check for ID field variations
    const hasIdField = header.includes('patientid') || 
                      header.includes('id') || 
                      header.includes('mrn') ||
                      header.includes('patientnumber') ||
                      header.includes('patientno');
    
    // Debug logging
    logDebug('scheduleImport', 'Debug message', {});
    
    if (!hasDateField || !hasNameFields || !hasIdField) {
      return { 
        valid: false, 
        error: `Missing required fields. File must contain: appointment date (found: ${hasDateField}), patient name first/last (found: ${hasNameFields}), and patient ID (found: ${hasIdField}). Header detected: "${lines[0].substring(0, 100)}..."` 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Get provider mapping for display
   */
  getProviderMapping() {
    return PROVIDER_MAPPING;
  }
  
  /**
   * Get sample file format
   */
  getSampleFormat(): string {
    return `SUPPORTED FORMATS:

FORMAT 1 (Tab or Comma Separated):
apptdate,patient firstname,patientid,patient lastname,patientdob,patient email,patient homephone,rndrng prvdr,apptscheduletime
09/09/2025,JOHN,12345678,DOE,01/15/1980,john.doe@email.com,(713) 555-0100,GC_EPC_Chamakkala_T,10:30 AM
09/09/2025,JANE,87654321,SMITH,05/20/1975,jane.smith@email.com,(713) 555-0200,GC_EPC_Watwe_V,11:00 AM

FORMAT 2 (Tab or Comma Separated):
apptdate,appt schdlng prvdrfullnme,patientdob,patient firstname,patient lastname,patientid,patient email,patient homephone,patient mobile no
09/09/2025,CHAMAKKALA TESS,01/15/1980,JOHN,DOE,12345678,john.doe@email.com,(713) 555-0100,(713) 555-0101
09/09/2025,WATWE VEENA,05/20/1975,JANE,SMITH,87654321,jane.smith@email.com,(713) 555-0200,(713) 555-0201

NOTES:
- Headers can have spaces (e.g., "patient firstname" or "patientfirstname")
- Tab or comma delimited both work
- Provider can be code (GC_EPC_xxx) or name (LASTNAME, FIRSTNAME)
- Required fields: date, patient name (first & last), patient ID`;
  }
}

export const scheduleImportService = new ScheduleImportService();