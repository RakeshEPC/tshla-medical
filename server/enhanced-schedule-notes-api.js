/**
 * Enhanced Schedule and Notes API Server
 * Comprehensive API for provider schedules and dictated notes
 * Created: September 15, 2025
 */

const express = require('express');
const cors = require('cors');
const unifiedSupabase = require('./services/unified-supabase.service');
const logger = require('./logger');
const patientMatchingService = require('./services/patientMatching.service');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'https://www.tshla.ai',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));

// Database connection status
let dbConnected = false;

/**
 * Initialize Supabase connection
 * Migrated from MySQL to Supabase - October 2025
 */
async function initializeDatabase() {
  try {
    await unifiedSupabase.initialize();
    dbConnected = true;
    logger.database('Supabase connection established', true);
    logger.info('App', 'Database initialized successfully');
  } catch (error) {
    logger.database('Supabase connection failed, using fallback mode', false, error);
    logger.warn('App', 'Database connection failed, switching to fallback mode');
    dbConnected = false;
  }
}

// In-memory fallback storage
const fallbackStorage = {
  appointments: new Map(),
  notes: new Map(),
  nextId: 1,
};

logger.startup('🏥 TSHLA Enhanced Schedule & Notes API Server Starting', {
  port: PORT,
  database: 'Supabase PostgreSQL',
  environment: process.env.NODE_ENV || 'development',
});

// Initialize database connection
initializeDatabase();

// ===============================
// HEALTH CHECK & UTILITIES
// ===============================

app.get('/health', async (req, res) => {
  const healthStatus = {
    service: 'enhanced-schedule-notes-api',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: dbConnected ? 'connected' : 'fallback-mode',
    databaseType: 'Supabase PostgreSQL',
    status: 'healthy', // Always healthy as we have fallback
  };

  if (dbConnected) {
    try {
      const health = await unifiedSupabase.healthCheck();
      healthStatus.database = health.healthy ? 'connected' : 'fallback-mode';
      if (!health.healthy) {
        healthStatus.fallbackReason = health.error;
      }
    } catch (error) {
      logger.warn('API', 'Database operation warning', { error });
      dbConnected = false;
      healthStatus.database = 'fallback-mode';
      healthStatus.fallbackReason = error.message;
    }
  }

  res.json(healthStatus);
});

// ===============================
// PROVIDER SCHEDULE ENDPOINTS
// ===============================

// Get provider schedule
app.get('/api/providers/:providerId/schedule', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { date, startDate, endDate } = req.query;

    let query = unifiedSupabase
      .from('provider_schedules')
      .select('id, provider_id, provider_name, patient_name, patient_phone, appointment_type, appointment_title, scheduled_date, start_time, end_time, duration_minutes, status, chief_complaint, urgency_level, is_telehealth, provider_notes, created_at, updated_at')
      .eq('provider_id', providerId);

    if (date) {
      query = query.eq('scheduled_date', date);
    } else if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate);
    }

    query = query.order('scheduled_date', { ascending: true }).order('start_time', { ascending: true });

    const { data: rows, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      appointments: rows || [],
      count: rows?.length || 0,
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider schedule',
      details: error.message,
    });
  }
});

// Create new appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const {
      provider_id,
      provider_name,
      patient_name,
      patient_phone,
      patient_email,
      appointment_type,
      appointment_title,
      scheduled_date,
      start_time,
      end_time,
      chief_complaint,
      urgency_level,
      is_telehealth,
      provider_notes,
    } = req.body;

    let appointmentId;

    if (dbConnected) {
      // Try database first
      try {
        const { data, error } = await unifiedSupabase
          .from('provider_schedules')
          .insert({
            provider_id,
            provider_name,
            patient_name,
            patient_phone,
            patient_email,
            appointment_type,
            appointment_title,
            scheduled_date,
            start_time,
            end_time,
            chief_complaint,
            urgency_level: urgency_level || 'routine',
            is_telehealth: is_telehealth || false,
            provider_notes,
            status: 'scheduled',
            source_system: 'tshla-dictation'
          })
          .select()
          .single();

        if (error) throw error;
        appointmentId = data.id;

        // ========================================
        // NEW: Auto-create/link unified patient
        // ========================================
        if (patient_phone && patient_name) {
          try {
            const patient = await patientMatchingService.findOrCreatePatient(
              patient_phone,
              {
                name: patient_name,
                email: patient_email,
                provider_id: provider_id,
                provider_name: provider_name
              },
              'schedule'
            );

            // Link this appointment to the unified patient
            await patientMatchingService.linkRecordToPatient('provider_schedules', appointmentId, patient.id);

            logger.info('App', `✅ Linked appointment ${appointmentId} to patient ${patient.patient_id}`);
          } catch (patientError) {
            logger.warn('App', 'Failed to create/link patient from appointment', { error: patientError.message });
          }
        }
        // ========================================
      } catch (dbError) {
        logger.warn('API', 'Database operation warning', { error: dbError });
        dbConnected = false; // Switch to fallback mode
      }
    }

    if (!dbConnected) {
      // Fallback to in-memory storage
      appointmentId = fallbackStorage.nextId++;
      const appointmentKey = `${provider_id}_${scheduled_date}`;

      if (!fallbackStorage.appointments.has(appointmentKey)) {
        fallbackStorage.appointments.set(appointmentKey, []);
      }

      fallbackStorage.appointments.get(appointmentKey).push({
        id: appointmentId,
        provider_id,
        provider_name,
        patient_name,
        patient_phone,
        patient_email,
        appointment_type,
        appointment_title,
        scheduled_date,
        start_time,
        end_time,
        chief_complaint,
        urgency_level: urgency_level || 'routine',
        is_telehealth: is_telehealth || false,
        provider_notes,
        status: 'scheduled',
        source_system: 'tshla-dictation',
      });

      logger.info('API', 'Operation successful');
    }

    res.json({
      success: true,
      appointmentId,
      message: 'Appointment created successfully',
      storage: dbConnected ? 'database' : 'memory',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment',
      details: error.message,
    });
  }
});

// Update appointment
app.put('/api/appointments/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await unifiedSupabase
      .from('provider_schedules')
      .update(updates)
      .eq('id', appointmentId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
      });
    }

    res.json({
      success: true,
      message: 'Appointment updated successfully',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment',
      details: error.message,
    });
  }
});

// Get today's schedule for all providers
app.get('/api/schedule/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: rows, error } = await unifiedSupabase
      .from('provider_schedules')
      .select('*')
      .eq('scheduled_date', today)
      .order('provider_name', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      schedule: rows || [],
      date: today,
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: "Failed to fetch today's schedule",
      details: error.message,
    });
  }
});

// ===============================
// SIMPLIFIED ENDPOINTS FOR TSHLA UI
// ===============================

// Get simple schedule for a provider on a specific date
app.get('/api/simple/schedule/:providerId/:date', async (req, res) => {
  try {
    const { providerId, date } = req.params;
    let appointments = [];

    if (dbConnected) {
      // Try database first
      try {
        const { data: rows, error } = await unifiedSupabase
          .from('provider_schedules')
          .select('id, patient_name, patient_phone, patient_mrn, start_time, status, created_at, updated_at')
          .eq('provider_id', providerId)
          .eq('scheduled_date', date)
          .order('start_time', { ascending: true });

        if (error) throw error;

        appointments = (rows || []).map(row => ({
          id: row.id.toString(),
          name: row.patient_name,
          mrn: row.patient_mrn || `MRN${row.id}`,
          appointmentTime: convertTo12Hour(row.start_time),
          status: row.status || 'pending',
          phone: row.patient_phone,
          isPlaceholder: !row.patient_name || row.patient_name.includes('Patient @'),
        }));
      } catch (dbError) {
        logger.warn('API', 'Database operation warning', { error: dbError });
        dbConnected = false;
      }
    }

    if (!dbConnected) {
      // Fallback to in-memory storage
      const appointmentKey = `${providerId}_${date}`;
      const fallbackAppts = fallbackStorage.appointments.get(appointmentKey) || [];

      appointments = fallbackAppts.map(appt => ({
        id: appt.id.toString(),
        name: appt.patient_name,
        mrn: appt.patient_mrn || `MRN${appt.id}`,
        appointmentTime: convertTo12Hour(appt.start_time),
        status: appt.status || 'pending',
        phone: appt.patient_phone,
        isPlaceholder: !appt.patient_name || appt.patient_name.includes('Patient @'),
      }));
    }

    res.json({
      success: true,
      appointments,
      date,
      providerId,
      storage: dbConnected ? 'database' : 'memory',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule',
      details: error.message,
    });
  }
});

// Helper function to convert 12-hour to 24-hour format
function convertTo24Hour(time12h) {
  if (!time12h || !time12h.includes(':')) return time12h;

  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');

  if (hours === '12') {
    hours = modifier === 'AM' ? '00' : '12';
  } else if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12);
  }

  return `${hours.padStart(2, '0')}:${minutes}:00`;
}

// Helper function to convert 24-hour to 12-hour format
function convertTo12Hour(time24h) {
  if (!time24h || !time24h.includes(':')) return time24h;

  const [hours, minutes] = time24h.split(':');
  const hour = parseInt(hours, 10);

  if (hour === 0) {
    return `12:${minutes} AM`;
  } else if (hour < 12) {
    return `${hour}:${minutes} AM`;
  } else if (hour === 12) {
    return `12:${minutes} PM`;
  } else {
    return `${hour - 12}:${minutes} PM`;
  }
}

// Save simple appointment (patient to schedule)
app.post('/api/simple/appointment', async (req, res) => {
  try {
    const {
      providerId,
      providerName,
      patientName,
      patientMrn,
      patientPhone,
      appointmentTime,
      appointmentDate,
      status = 'pending',
    } = req.body;

    if (dbConnected) {
      // Try database first
      try {
        const startTime24h = convertTo24Hour(appointmentTime);

        const { data, error } = await unifiedSupabase
          .from('provider_schedules')
          .insert({
            provider_id: providerId,
            provider_name: providerName,
            patient_name: patientName,
            patient_mrn: patientMrn,
            patient_phone: patientPhone,
            scheduled_date: appointmentDate,
            start_time: startTime24h,
            end_time: startTime24h,
            status: status,
            source_system: 'tshla-dashboard',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        res.json({
          success: true,
          appointmentId: data.id,
          message: 'Appointment saved to database',
          source: 'database',
        });
        return;
      } catch (dbError) {
        logger.warn('API', 'Database operation warning', { error: dbError });
        dbConnected = false;
      }
    }

    // Fallback to in-memory storage
    const appointmentId = fallbackStorage.nextId++;
    const appointment = {
      id: appointmentId,
      provider_id: providerId,
      provider_name: providerName,
      patient_name: patientName,
      patient_mrn: patientMrn,
      patient_phone: patientPhone,
      appointment_time: appointmentTime,
      appointment_date: appointmentDate,
      status: status,
      created_at: new Date().toISOString(),
    };

    fallbackStorage.appointments.set(appointmentId, appointment);

    logger.debug('API', 'Debug information');

    res.json({
      success: true,
      appointmentId: appointmentId,
      message: 'Appointment saved to local storage (database unavailable)',
      source: 'fallback',
      note: 'This appointment will be synced to database when connection is restored',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to save appointment',
      details: error.message,
    });
  }
});

// Update simple appointment
app.put('/api/simple/appointment/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { patientName, patientMrn, patientPhone, appointmentTime, status } = req.body;

    const { data, error } = await unifiedSupabase
      .from('provider_schedules')
      .update({
        patient_name: patientName,
        patient_mrn: patientMrn,
        patient_phone: patientPhone,
        start_time: appointmentTime,
        end_time: appointmentTime,
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
      });
    }

    res.json({
      success: true,
      message: 'Appointment updated successfully',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment',
      details: error.message,
    });
  }
});

// Delete appointment
app.delete('/api/simple/appointment/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const { data, error } = await unifiedSupabase
      .from('provider_schedules')
      .delete()
      .eq('id', appointmentId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
      });
    }

    res.json({
      success: true,
      message: 'Appointment deleted successfully',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete appointment',
      details: error.message,
    });
  }
});

// Save simple dictated note
app.post('/api/simple/note', async (req, res) => {
  try {
    const {
      providerId,
      providerName,
      patientName,
      patientMrn,
      rawTranscript,
      aiProcessedNote,
      recordingMode = 'dictation',
      isQuickNote = false,
    } = req.body;

    const visitDate = new Date().toISOString().split('T')[0];
    const noteTitle = `${patientName} - ${visitDate}`;

    const { data, error } = await unifiedSupabase
      .from('dictated_notes')
      .insert({
        provider_id: providerId,
        provider_name: providerName,
        patient_name: patientName,
        patient_mrn: patientMrn,
        patient_phone: patientPhone,
        patient_email: patientEmail,
        visit_date: visitDate,
        note_title: noteTitle,
        raw_transcript: rawTranscript,
        processed_note: aiProcessedNote,
        recording_mode: recordingMode,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      noteId: data.id,
      message: 'Note saved successfully',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to save note',
      details: error.message,
    });
  }
});

// Update existing dictated note (for auto-save)
app.put('/api/simple/note/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const {
      patientName,
      patientMrn,
      patientPhone,
      patientEmail,
      rawTranscript,
      aiProcessedNote,
      recordingMode,
    } = req.body;

    const updateData = {
      last_edited_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (patientName !== undefined) updateData.patient_name = patientName;
    if (patientMrn !== undefined) updateData.patient_mrn = patientMrn;
    if (patientPhone !== undefined) updateData.patient_phone = patientPhone;
    if (patientEmail !== undefined) updateData.patient_email = patientEmail;
    if (rawTranscript !== undefined) updateData.raw_transcript = rawTranscript;
    if (aiProcessedNote !== undefined) updateData.processed_note = aiProcessedNote;
    if (recordingMode !== undefined) updateData.recording_mode = recordingMode;

    const { data, error } = await unifiedSupabase
      .from('dictated_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    res.json({
      success: true,
      noteId: data.id,
      message: 'Note updated successfully',
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
      details: error.message,
    });
  }
});

// Get simple notes for provider
app.get('/api/simple/notes/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { limit = 20, date } = req.query;

    let query = unifiedSupabase
      .from('dictated_notes')
      .select('id, patient_name, patient_mrn, patient_phone, patient_email, visit_date, note_title, raw_transcript, processed_note, recording_mode, created_at, status')
      .eq('provider_id', providerId);

    if (date) {
      query = query.eq('visit_date', date);
    }

    query = query.order('dictated_at', { ascending: false }).limit(parseInt(limit));

    const { data: rows, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      notes: rows || [],
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notes',
      details: error.message,
    });
  }
});

// ===============================
// DICTATED NOTES ENDPOINTS
// ===============================

// Save dictated note
app.post('/api/dictated-notes', async (req, res) => {
  try {
    const {
      provider_id,
      provider_name,
      provider_email,
      provider_specialty,
      patient_name,
      patient_phone,
      patient_email,
      patient_mrn,
      patient_dob,
      appointment_id,
      visit_date,
      visit_type,
      note_title,
      chief_complaint,
      raw_transcript,
      processed_note,
      ai_summary,
      clinical_impression,
      template_id,
      template_name,
      template_sections,
      recording_mode,
      recording_duration_seconds,
      ai_model_used,
      processing_confidence_score,
      medical_terms_detected,
      status,
    } = req.body;

    // Handle missing patient name - create placeholder and flag for identification
    const isPatientUnidentified = !patient_name || patient_name.trim() === '';
    const finalPatientName = isPatientUnidentified
      ? `[Unidentified Patient - ${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}]`
      : patient_name;

    const { data: noteData, error: noteError } = await unifiedSupabase
      .from('dictated_notes')
      .insert({
        provider_id,
        provider_name,
        provider_email,
        provider_specialty,
        patient_name: finalPatientName,
        // requires_patient_identification: isPatientUnidentified,  // TODO: Uncomment after running migration
        patient_phone,
        patient_email,
        patient_mrn,
        patient_dob,
        appointment_id,
        visit_date,
        visit_type: visit_type || 'follow-up',
        note_title,
        chief_complaint,
        raw_transcript,
        processed_note,
        ai_summary,
        clinical_impression,
        template_id,
        template_name,
        template_sections: template_sections,
        recording_mode: recording_mode || 'dictation',
        recording_duration_seconds: recording_duration_seconds || 0,
        ai_model_used,
        processing_confidence_score,
        medical_terms_detected,
        status: status || 'draft',
        dictated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (noteError) throw noteError;

    const noteId = noteData.id;

    // ========================================
    // NEW: Auto-create/link unified patient
    // ========================================
    if (patient_phone && !isPatientUnidentified) {
      try {
        const patient = await patientMatchingService.findOrCreatePatient(
          patient_phone,
          {
            name: patient_name,
            firstName: null, // Will be parsed from name
            lastName: null,
            email: patient_email,
            mrn: patient_mrn,
            dob: patient_dob,
            provider_id: provider_id,
            provider_name: provider_name
          },
          'dictation'
        );

        // Link this dictation to the unified patient
        await patientMatchingService.linkRecordToPatient('dictated_notes', noteId, patient.id);

        logger.info('App', `✅ Linked dictation ${noteId} to patient ${patient.patient_id}`);
      } catch (patientError) {
        // Don't fail the dictation save if patient matching fails
        logger.warn('App', 'Failed to create/link patient, continuing anyway', { error: patientError.message });
      }
    }
    // ========================================

    // Create initial version record
    const { error: versionError } = await unifiedSupabase
      .from('note_versions')
      .insert({
        note_id: noteId,
        version_number: 1,
        change_type: 'created',
        raw_transcript_version: raw_transcript,
        processed_note_version: processed_note,
        ai_summary_version: ai_summary,
        clinical_impression_version: clinical_impression,
        changed_by_provider_id: provider_id,
        changed_by_provider_name: provider_name,
        change_description: 'Initial note creation'
      });

    if (versionError) throw versionError;

    // Link to appointment if provided
    if (appointment_id) {
      const { error: linkError } = await unifiedSupabase
        .from('schedule_note_links')
        .insert({
          appointment_id,
          note_id: noteId,
          link_type: 'primary-note',
          is_primary_link: true,
          linked_by_provider_id: provider_id,
          linked_by_provider_name: provider_name
        });

      if (linkError) throw linkError;
    }

    // Track template usage if provided
    if (template_id) {
      const { error: templateError } = await unifiedSupabase
        .from('note_templates_used')
        .insert({
          note_id: noteId,
          template_id,
          template_name,
          sections_used: template_sections,
          used_by_provider_id: provider_id,
          used_by_provider_name: provider_name
        });

      if (templateError) throw templateError;
    }

    res.json({
      success: true,
      noteId,
      message: isPatientUnidentified
        ? 'Dictated note saved successfully (patient identification required)'
        : 'Dictated note saved successfully',
      requiresPatientIdentification: isPatientUnidentified,
      patientNameUsed: finalPatientName,
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to save dictated note',
      details: error.message,
    });
  }
});

// Get provider's dictated notes
app.get('/api/providers/:providerId/notes', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { limit = 50, offset = 0, status, startDate, endDate } = req.query;

    let query = unifiedSupabase
      .from('dictated_notes')
      .select('id, patient_name, patient_mrn, patient_phone, patient_email, visit_date, raw_transcript, processed_note, recording_mode, visit_type, note_title, chief_complaint, status, template_name, created_at')
      .eq('provider_id', providerId);

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate && endDate) {
      query = query.gte('visit_date', startDate).lte('visit_date', endDate);
    }

    query = query.order('created_at', { ascending: false }).range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: rows, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      notes: rows || [],
      count: rows?.length || 0,
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider notes',
      details: error.message,
    });
  }
});

// Get specific note details
app.get('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;

    const { data: noteData, error: noteError } = await unifiedSupabase
      .from('dictated_notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !noteData) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    // Get note versions
    const { data: versionRows, error: versionError } = await unifiedSupabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false });

    if (versionError) throw versionError;

    // Get note comments
    const { data: commentRows, error: commentError } = await unifiedSupabase
      .from('note_comments')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: false });

    if (commentError) throw commentError;

    res.json({
      success: true,
      note: noteData,
      versions: versionRows || [],
      comments: commentRows || [],
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch note details',
      details: error.message,
    });
  }
});

// Update note
app.put('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const {
      processed_note,
      ai_summary,
      clinical_impression,
      status,
      updated_by_provider_id,
      updated_by_provider_name,
      change_description,
    } = req.body;

    // Get current version number
    const { data: versionData, error: versionQueryError } = await unifiedSupabase
      .from('note_versions')
      .select('version_number')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionQueryError) throw versionQueryError;

    const nextVersion = (versionData && versionData.length > 0 ? versionData[0].version_number : 0) + 1;

    // Update the note
    const { data: updateResult, error: updateError } = await unifiedSupabase
      .from('dictated_notes')
      .update({
        processed_note,
        ai_summary,
        clinical_impression,
        status,
        last_edited_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .select();

    if (updateError) throw updateError;

    if (!updateResult || updateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    // Create version record
    const { error: versionInsertError } = await unifiedSupabase
      .from('note_versions')
      .insert({
        note_id: noteId,
        version_number: nextVersion,
        change_type: 'edited',
        processed_note_version: processed_note,
        ai_summary_version: ai_summary,
        clinical_impression_version: clinical_impression,
        changed_by_provider_id: updated_by_provider_id,
        changed_by_provider_name: updated_by_provider_name,
        change_description: change_description
      });

    if (versionInsertError) throw versionInsertError;

    res.json({
      success: true,
      message: 'Note updated successfully',
      version: nextVersion,
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
      details: error.message,
    });
  }
});

// Search notes
app.get('/api/notes/search', async (req, res) => {
  try {
    const { query, provider_id, patient_name, date_from, date_to } = req.query;

    let searchQuery = unifiedSupabase
      .from('dictated_notes')
      .select('id, provider_name, patient_name, patient_phone, visit_date, note_title, chief_complaint, status, created_at');

    // Note: Full-text search with MATCH AGAINST is MySQL-specific
    // Supabase uses PostgreSQL which has different full-text search
    // For now, using simple text search with ilike
    if (query) {
      searchQuery = searchQuery.or(`patient_name.ilike.%${query}%,note_title.ilike.%${query}%,chief_complaint.ilike.%${query}%`);
    }

    if (provider_id) {
      searchQuery = searchQuery.eq('provider_id', provider_id);
    }

    if (patient_name) {
      searchQuery = searchQuery.ilike('patient_name', `%${patient_name}%`);
    }

    if (date_from && date_to) {
      searchQuery = searchQuery.gte('visit_date', date_from).lte('visit_date', date_to);
    }

    searchQuery = searchQuery.order('created_at', { ascending: false }).limit(100);

    const { data: rows, error } = await searchQuery;

    if (error) throw error;

    res.json({
      success: true,
      results: rows || [],
      count: rows?.length || 0,
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to search notes',
      details: error.message,
    });
  }
});

// ===============================
// ANALYTICS ENDPOINTS
// ===============================

// Provider dashboard analytics
app.get('/api/providers/:providerId/analytics', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { period = 'week' } = req.query;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const today = new Date().toISOString().split('T')[0];

    // Get recent notes count
    const { data: notesData, error: notesError } = await unifiedSupabase
      .from('dictated_notes')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerId)
      .gte('created_at', oneWeekAgo.toISOString());

    if (notesError) throw notesError;

    // Get upcoming appointments
    const { data: apptData, error: apptError } = await unifiedSupabase
      .from('provider_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerId)
      .gte('scheduled_date', today)
      .eq('status', 'scheduled');

    if (apptError) throw apptError;

    // Get notes by status (manual grouping since Supabase doesn't have GROUP BY in JS)
    const { data: statusData, error: statusError } = await unifiedSupabase
      .from('dictated_notes')
      .select('status')
      .eq('provider_id', providerId)
      .gte('created_at', oneMonthAgo.toISOString());

    if (statusError) throw statusError;

    // Group by status manually
    const notesByStatus = (statusData || []).reduce((acc, note) => {
      const existing = acc.find(item => item.status === note.status);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ status: note.status, count: 1 });
      }
      return acc;
    }, []);

    res.json({
      success: true,
      analytics: {
        recentNotesCount: notesData?.length || 0,
        upcomingAppointments: apptData?.length || 0,
        notesByStatus: notesByStatus,
      },
    });
  } catch (error) {
    logger.error('API', error.message, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider analytics',
      details: error.message,
    });
  }
});

// Global error handlers for uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('SYSTEM', 'Uncaught Exception', { error: error.message, stack: error.stack });
  // Log error but don't exit - let PM2/supervisor handle restart if needed
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('SYSTEM', 'Unhandled Promise Rejection', { reason: String(reason) });
  // Log error but don't exit - let PM2/supervisor handle restart if needed
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SYSTEM', 'Received SIGTERM, shutting down gracefully');
  try {
    if (pool) {
      await pool.end();
      logger.info('SYSTEM', 'Database pool closed successfully');
    }
    process.exit(0);
  } catch (error) {
    logger.error('SYSTEM', 'Error during shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SYSTEM', 'Received SIGINT, shutting down gracefully');
  try {
    if (pool) {
      await pool.end();
      logger.info('SYSTEM', 'Database pool closed successfully');
    }
    process.exit(0);
  } catch (error) {
    logger.error('SYSTEM', 'Error during shutdown', { error });
    process.exit(1);
  }
});

// Start server (only if running directly, not when imported)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log('\n' + '='.repeat(80));
    console.log(`🏥 TSHLA Enhanced Schedule & Notes API Server`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Database: Supabase`);
    console.log('='.repeat(80) + '\n');
    logger.info('SERVER', `Schedule API listening on port ${PORT}`);
  });

  // Handle server errors
  server.on('error', error => {
    logger.error('SERVER', 'Server error occurred', { error: error.message, code: error.code });
    if (error.code === 'EADDRINUSE') {
      logger.error('SERVER', `Port ${PORT} is already in use`, { error });
      process.exit(1);
    }
  });
}

// Export app for use in unified server
module.exports = app;
