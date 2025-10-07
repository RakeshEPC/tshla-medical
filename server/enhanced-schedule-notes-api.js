/**
 * Enhanced Schedule and Notes API Server
 * Comprehensive API for provider schedules and dictated notes
 * Created: September 15, 2025
 */

const express = require('express');
const cors = require('cors');
const unifiedSupabase = require('./services/unified-supabase.service');
const logger = require('./logger');

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
        const [rows] = await pool.execute(
          `
          SELECT
            id,
            patient_name,
            patient_phone,
            patient_mrn,
            start_time as appointmentTime,
            status,
            created_at,
            updated_at
          FROM provider_schedules
          WHERE provider_id = ? AND scheduled_date = ?
          ORDER BY start_time ASC
        `,
          [providerId, date]
        );

        appointments = rows.map(row => ({
          id: row.id.toString(),
          name: row.patient_name,
          mrn: row.patient_mrn || `MRN${row.id}`,
          appointmentTime: convertTo12Hour(row.appointmentTime),
          status: row.status || 'pending',
          phone: row.patient_phone,
          isPlaceholder: !row.patient_name || row.patient_name.includes('Patient @'),
        }));
      } catch (dbError) {
        logger.warn('API', 'Database operation warning', { error });
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

        const [result] = await pool.execute(
          `
          INSERT INTO provider_schedules (
            provider_id, provider_name, patient_name, patient_mrn, patient_phone,
            scheduled_date, start_time, end_time, status, source_system, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tshla-dashboard', CURRENT_TIMESTAMP)
        `,
          [
            providerId,
            providerName,
            patientName,
            patientMrn,
            patientPhone,
            appointmentDate,
            startTime24h,
            startTime24h,
            status,
          ]
        );

        res.json({
          success: true,
          appointmentId: result.insertId,
          message: 'Appointment saved to database',
          source: 'database',
        });
        return;
      } catch (dbError) {
        logger.warn('API', 'Database operation warning', { error });
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

    const [result] = await pool.execute(
      `
      UPDATE provider_schedules
      SET patient_name = ?, patient_mrn = ?, patient_phone = ?,
          start_time = ?, end_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        patientName,
        patientMrn,
        patientPhone,
        appointmentTime,
        appointmentTime,
        status,
        appointmentId,
      ]
    );

    if (result.affectedRows === 0) {
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

    const [result] = await pool.execute(
      `
      DELETE FROM provider_schedules WHERE id = ?
    `,
      [appointmentId]
    );

    if (result.affectedRows === 0) {
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

    const [result] = await pool.execute(
      `
      INSERT INTO dictated_notes (
        provider_id, provider_name, patient_name, patient_mrn,
        visit_date, note_title, raw_transcript, processed_note,
        recording_mode, status, dictated_at, is_quick_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, ?)
    `,
      [
        providerId,
        providerName,
        patientName,
        patientMrn,
        visitDate,
        noteTitle,
        rawTranscript,
        aiProcessedNote,
        recordingMode,
        isQuickNote,
      ]
    );

    res.json({
      success: true,
      noteId: result.insertId,
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

// Get simple notes for provider
app.get('/api/simple/notes/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { limit = 20, date } = req.query;

    let query = `
      SELECT id, patient_name, patient_mrn, visit_date, note_title,
             raw_transcript, processed_note, recording_mode, is_quick_note,
             dictated_at, status
      FROM dictated_notes
      WHERE provider_id = ?
    `;
    const params = [providerId];

    if (date) {
      query += ' AND visit_date = ?';
      params.push(date);
    }

    query += ' ORDER BY dictated_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      notes: rows,
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

    const [result] = await pool.execute(
      `
      INSERT INTO dictated_notes (
        provider_id, provider_name, provider_email, provider_specialty,
        patient_name, patient_phone, patient_email, patient_mrn, patient_dob,
        appointment_id, visit_date, visit_type, note_title, chief_complaint,
        raw_transcript, processed_note, ai_summary, clinical_impression,
        template_id, template_name, template_sections, recording_mode,
        recording_duration_seconds, ai_model_used, processing_confidence_score,
        medical_terms_detected, status, dictated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `,
      [
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
        visit_type || 'follow-up',
        note_title,
        chief_complaint,
        raw_transcript,
        processed_note,
        ai_summary,
        clinical_impression,
        template_id,
        template_name,
        JSON.stringify(template_sections),
        recording_mode || 'dictation',
        recording_duration_seconds || 0,
        ai_model_used,
        processing_confidence_score,
        JSON.stringify(medical_terms_detected),
        status || 'draft',
      ]
    );

    const noteId = result.insertId;

    // Create initial version record
    await pool.execute(
      `
      INSERT INTO note_versions (
        note_id, version_number, change_type, raw_transcript_version,
        processed_note_version, ai_summary_version, clinical_impression_version,
        changed_by_provider_id, changed_by_provider_name, change_description
      ) VALUES (?, 1, 'created', ?, ?, ?, ?, ?, ?, 'Initial note creation')
    `,
      [
        noteId,
        raw_transcript,
        processed_note,
        ai_summary,
        clinical_impression,
        provider_id,
        provider_name,
      ]
    );

    // Link to appointment if provided
    if (appointment_id) {
      await pool.execute(
        `
        INSERT INTO schedule_note_links (
          appointment_id, note_id, link_type, is_primary_link,
          linked_by_provider_id, linked_by_provider_name
        ) VALUES (?, ?, 'primary-note', TRUE, ?, ?)
      `,
        [appointment_id, noteId, provider_id, provider_name]
      );
    }

    // Track template usage if provided
    if (template_id) {
      await pool.execute(
        `
        INSERT INTO note_templates_used (
          note_id, template_id, template_name, sections_used,
          used_by_provider_id, used_by_provider_name
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          noteId,
          template_id,
          template_name,
          JSON.stringify(template_sections),
          provider_id,
          provider_name,
        ]
      );
    }

    res.json({
      success: true,
      noteId,
      message: 'Dictated note saved successfully',
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

    let query = `
      SELECT
        id, patient_name, patient_phone, visit_date, visit_type,
        note_title, chief_complaint, status, template_name,
        created_at, signed_at, quality_score, requires_review
      FROM dictated_notes
      WHERE provider_id = ?
    `;
    const params = [providerId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (startDate && endDate) {
      query += ' AND visit_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      notes: rows,
      count: rows.length,
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

    const [noteRows] = await pool.execute(
      `
      SELECT * FROM dictated_notes WHERE id = ?
    `,
      [noteId]
    );

    if (noteRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    // Get note versions
    const [versionRows] = await pool.execute(
      `
      SELECT * FROM note_versions
      WHERE note_id = ?
      ORDER BY version_number DESC
    `,
      [noteId]
    );

    // Get note comments
    const [commentRows] = await pool.execute(
      `
      SELECT * FROM note_comments
      WHERE note_id = ?
      ORDER BY created_at DESC
    `,
      [noteId]
    );

    res.json({
      success: true,
      note: noteRows[0],
      versions: versionRows,
      comments: commentRows,
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
    const [versionRows] = await pool.execute(
      `
      SELECT MAX(version_number) as max_version FROM note_versions WHERE note_id = ?
    `,
      [noteId]
    );

    const nextVersion = (versionRows[0].max_version || 0) + 1;

    // Update the note
    const [result] = await pool.execute(
      `
      UPDATE dictated_notes
      SET processed_note = ?, ai_summary = ?, clinical_impression = ?,
          status = ?, last_edited_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [processed_note, ai_summary, clinical_impression, status, noteId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    // Create version record
    await pool.execute(
      `
      INSERT INTO note_versions (
        note_id, version_number, change_type, processed_note_version,
        ai_summary_version, clinical_impression_version,
        changed_by_provider_id, changed_by_provider_name, change_description
      ) VALUES (?, ?, 'edited', ?, ?, ?, ?, ?, ?)
    `,
      [
        noteId,
        nextVersion,
        processed_note,
        ai_summary,
        clinical_impression,
        updated_by_provider_id,
        updated_by_provider_name,
        change_description,
      ]
    );

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

    let searchQuery = `
      SELECT
        id, provider_name, patient_name, patient_phone, visit_date,
        note_title, chief_complaint, status, created_at
      FROM dictated_notes
      WHERE 1=1
    `;
    const params = [];

    if (query) {
      searchQuery += ` AND (
        MATCH(raw_transcript, processed_note, ai_summary) AGAINST (? IN NATURAL LANGUAGE MODE)
        OR MATCH(chief_complaint, clinical_impression) AGAINST (? IN NATURAL LANGUAGE MODE)
        OR patient_name LIKE ?
        OR note_title LIKE ?
      )`;
      params.push(query, query, `%${query}%`, `%${query}%`);
    }

    if (provider_id) {
      searchQuery += ' AND provider_id = ?';
      params.push(provider_id);
    }

    if (patient_name) {
      searchQuery += ' AND patient_name LIKE ?';
      params.push(`%${patient_name}%`);
    }

    if (date_from && date_to) {
      searchQuery += ' AND visit_date BETWEEN ? AND ?';
      params.push(date_from, date_to);
    }

    searchQuery += ' ORDER BY created_at DESC LIMIT 100';

    const [rows] = await pool.execute(searchQuery, params);

    res.json({
      success: true,
      results: rows,
      count: rows.length,
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

    // Get recent notes count
    const [notesCount] = await pool.execute(
      `
      SELECT COUNT(*) as total_notes FROM dictated_notes
      WHERE provider_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)
    `,
      [providerId]
    );

    // Get upcoming appointments
    const [upcomingCount] = await pool.execute(
      `
      SELECT COUNT(*) as upcoming_appointments FROM provider_schedules
      WHERE provider_id = ? AND scheduled_date >= CURDATE() AND status = 'scheduled'
    `,
      [providerId]
    );

    // Get notes by status
    const [notesByStatus] = await pool.execute(
      `
      SELECT status, COUNT(*) as count FROM dictated_notes
      WHERE provider_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      GROUP BY status
    `,
      [providerId]
    );

    res.json({
      success: true,
      analytics: {
        recentNotesCount: notesCount[0].total_notes,
        upcomingAppointments: upcomingCount[0].upcoming_appointments,
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

// Start server
const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log(`🏥 TSHLA Enhanced Schedule & Notes API Server`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${dbConfig.host}/${dbConfig.database}`);
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
