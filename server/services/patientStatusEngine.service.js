/**
 * Patient Status Engine Service
 *
 * Computes patient daily status for the portal HOME screen using AI.
 * Implements the "Single Headline Priority System":
 *   Priority Ladder: Safety → New Info → Trends → Stable
 *
 * Runs:
 * - Nightly for all portal-enabled patients
 * - After specific events (new labs, finalized dictations, CGM alerts)
 *
 * Created: 2026-02-06
 */

const { createClient } = require('@supabase/supabase-js');
const { generateCompletion } = require('./azureOpenAI.service');
const logger = require('../logger');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class PatientStatusEngine {
  constructor() {
    // Priority thresholds
    this.SAFETY_THRESHOLDS = {
      A1C_CRITICAL_HIGH: 12.0,
      A1C_HIGH: 10.0,
      GLUCOSE_VERY_LOW: 54,
      GLUCOSE_LOW: 70,
      GLUCOSE_VERY_HIGH: 300,
      POTASSIUM_LOW: 3.0,
      POTASSIUM_HIGH: 6.0,
      CREATININE_HIGH: 3.0,
      EGFR_CRITICAL: 15,
    };

    // Status types in priority order
    this.STATUS_TYPES = ['safety', 'new_info', 'trend', 'stable'];

    // Specialty mapping for council status
    this.SPECIALTIES = [
      'cardiology',
      'nephrology',
      'ophthalmology',
      'podiatry',
      'endocrinology',
      'neurology',
      'pcp'
    ];
  }

  /**
   * Compute status for all portal-enabled patients
   * Called by nightly job
   */
  async computeAllPatientStatuses() {
    logger.info('PatientStatusEngine', 'Starting batch status computation');
    const startTime = Date.now();

    try {
      // Get all patients needing status refresh
      const { data: patients, error } = await supabase
        .from('unified_patients')
        .select('id, tshla_id, first_name, last_name, phone_primary')
        .eq('has_portal_access', true)
        .eq('is_active', true);

      if (error) throw error;

      logger.info('PatientStatusEngine', `Processing ${patients.length} patients`);

      let successCount = 0;
      let errorCount = 0;

      // Process in batches to avoid overwhelming the system
      const BATCH_SIZE = 10;
      for (let i = 0; i < patients.length; i += BATCH_SIZE) {
        const batch = patients.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (patient) => {
            try {
              await this.computePatientStatus(patient.id);
              successCount++;
            } catch (err) {
              logger.error('PatientStatusEngine', `Failed for patient ${patient.tshla_id}`, {
                error: err.message
              });
              errorCount++;
            }
          })
        );

        // Small delay between batches
        if (i + BATCH_SIZE < patients.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const duration = Date.now() - startTime;
      logger.info('PatientStatusEngine', 'Batch computation complete', {
        total: patients.length,
        success: successCount,
        errors: errorCount,
        durationMs: duration
      });

      return { total: patients.length, success: successCount, errors: errorCount };

    } catch (error) {
      logger.error('PatientStatusEngine', 'Batch computation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Compute status for a single patient
   * @param {string} unifiedPatientId - UUID of the patient
   */
  async computePatientStatus(unifiedPatientId) {
    const startTime = Date.now();

    try {
      // Gather all patient context
      const context = await this.gatherContext(unifiedPatientId);

      if (!context.patient) {
        throw new Error('Patient not found');
      }

      // Determine status using priority ladder
      const status = await this.determineStatus(context);

      // Build council status from specialist notes
      const councilStatus = await this.buildCouncilStatus(context);

      // Build clinical snapshot
      const clinicalSnapshot = this.buildClinicalSnapshot(context);

      // Save to database
      const computationDuration = Date.now() - startTime;
      await this.saveStatus(unifiedPatientId, {
        ...status,
        council_status: councilStatus,
        clinical_snapshot: clinicalSnapshot,
        computation_duration_ms: computationDuration,
        model_version: 'gpt-4o-2026-02',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

      logger.info('PatientStatusEngine', 'Status computed', {
        patientId: unifiedPatientId,
        statusType: status.status_type,
        durationMs: computationDuration
      });

      return status;

    } catch (error) {
      logger.error('PatientStatusEngine', 'Failed to compute status', {
        patientId: unifiedPatientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Gather complete patient context for status computation
   */
  async gatherContext(unifiedPatientId) {
    // Parallel data fetching
    const [
      patientResult,
      chartResult,
      medsResult,
      cgmResult,
      dictationsResult,
      externalDocsResult
    ] = await Promise.all([
      // 1. Patient demographics
      supabase
        .from('unified_patients')
        .select('*')
        .eq('id', unifiedPatientId)
        .single(),

      // 2. Comprehensive chart (labs, diagnoses, allergies, vitals)
      supabase
        .from('patient_comprehensive_chart')
        .select('*')
        .eq('unified_patient_id', unifiedPatientId)
        .order('created_at', { ascending: false })
        .limit(1),

      // 3. Active medications
      supabase
        .from('patient_medications')
        .select('*')
        .eq('patient_id', unifiedPatientId)
        .order('status', { ascending: true }),

      // 4. CGM readings (last 24 hours)
      supabase
        .from('cgm_readings')
        .select('glucose_value, trend_arrow, trend_direction, reading_timestamp')
        .eq('unified_patient_id', unifiedPatientId)
        .gte('reading_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('reading_timestamp', { ascending: false })
        .limit(288),

      // 5. Recent dictations (our notes)
      supabase
        .from('dictated_notes')
        .select('visit_date, ai_summary, processed_note, provider_name, chief_complaint, status')
        .eq('unified_patient_id', unifiedPatientId)
        .eq('status', 'final')
        .order('visit_date', { ascending: false })
        .limit(5),

      // 6. External documents (specialist notes)
      supabase
        .from('external_documents')
        .select('document_type, specialty, provider_name, document_date, ai_summary, extracted_data')
        .eq('unified_patient_id', unifiedPatientId)
        .order('document_date', { ascending: false })
        .limit(10)
    ]);

    const chart = chartResult.data?.[0] || {};

    return {
      patient: patientResult.data || {},
      labs: chart.labs || {},
      diagnoses: chart.diagnoses || [],
      allergies: chart.allergies || [],
      vitals: chart.vitals || {},
      medications: medsResult.data || [],
      cgmReadings: cgmResult.data || [],
      dictations: dictationsResult.data || [],
      externalDocuments: externalDocsResult.data || [],
      hpNarrative: chart.full_hp_narrative || ''
    };
  }

  /**
   * Determine status using priority ladder
   * Priority: Safety → New Info → Trends → Stable
   */
  async determineStatus(context) {
    // 1. SAFETY - Critical values that need immediate attention
    const safetyStatus = this.checkSafetyIssues(context);
    if (safetyStatus) {
      return this.buildSafetyStatus(safetyStatus, context);
    }

    // 2. NEW INFO - Labs resulted, new specialist notes, etc.
    const newInfo = this.checkNewInfo(context);
    if (newInfo) {
      return this.buildNewInfoStatus(newInfo, context);
    }

    // 3. TRENDS - Directional changes (A1C improved, TIR worsened)
    const trendChange = this.checkTrendChanges(context);
    if (trendChange) {
      return this.buildTrendStatus(trendChange, context);
    }

    // 4. STABLE - Default when nothing else applies
    return this.buildStableStatus(context);
  }

  /**
   * Check for safety-level issues
   */
  checkSafetyIssues(context) {
    const issues = [];

    // Check CGM for hypo patterns
    if (context.cgmReadings.length > 0) {
      const veryLowCount = context.cgmReadings.filter(
        r => r.glucose_value < this.SAFETY_THRESHOLDS.GLUCOSE_VERY_LOW
      ).length;

      const veryHighCount = context.cgmReadings.filter(
        r => r.glucose_value > this.SAFETY_THRESHOLDS.GLUCOSE_VERY_HIGH
      ).length;

      if (veryLowCount >= 3) {
        issues.push({
          type: 'hypoglycemia_pattern',
          severity: 'critical',
          message: `${veryLowCount} severe low glucose readings in 24 hours`,
          value: veryLowCount
        });
      }

      if (veryHighCount >= 5) {
        issues.push({
          type: 'hyperglycemia_pattern',
          severity: 'high',
          message: 'Persistent high glucose over 300 mg/dL',
          value: veryHighCount
        });
      }
    }

    // Check labs for critical values
    if (context.labs && typeof context.labs === 'object') {
      for (const [labName, results] of Object.entries(context.labs)) {
        if (!Array.isArray(results) || results.length === 0) continue;

        const latest = results[0];
        const value = parseFloat(latest.value);

        // A1C critical
        if (labName.toLowerCase().includes('a1c') && value >= this.SAFETY_THRESHOLDS.A1C_CRITICAL_HIGH) {
          issues.push({
            type: 'critical_lab',
            severity: 'critical',
            message: `A1C is critically elevated at ${value}%`,
            lab: 'A1C',
            value
          });
        }

        // Potassium
        if (labName.toLowerCase().includes('potassium')) {
          if (value < this.SAFETY_THRESHOLDS.POTASSIUM_LOW) {
            issues.push({
              type: 'critical_lab',
              severity: 'critical',
              message: `Potassium is dangerously low at ${value}`,
              lab: 'Potassium',
              value
            });
          }
          if (value > this.SAFETY_THRESHOLDS.POTASSIUM_HIGH) {
            issues.push({
              type: 'critical_lab',
              severity: 'critical',
              message: `Potassium is dangerously high at ${value}`,
              lab: 'Potassium',
              value
            });
          }
        }

        // eGFR critical
        if (labName.toLowerCase().includes('egfr') && value <= this.SAFETY_THRESHOLDS.EGFR_CRITICAL) {
          issues.push({
            type: 'critical_lab',
            severity: 'critical',
            message: `Kidney function critically reduced (eGFR ${value})`,
            lab: 'eGFR',
            value
          });
        }
      }
    }

    return issues.length > 0 ? issues : null;
  }

  /**
   * Check for new information (labs, notes)
   */
  checkNewInfo(context) {
    const newItems = [];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Check for recent lab results
    if (context.labs && typeof context.labs === 'object') {
      for (const [labName, results] of Object.entries(context.labs)) {
        if (!Array.isArray(results) || results.length === 0) continue;

        const latest = results[0];
        const labDate = new Date(latest.date);

        if (labDate > threeDaysAgo) {
          newItems.push({
            type: 'lab',
            name: labName,
            value: latest.value,
            unit: latest.unit,
            date: latest.date
          });
        }
      }
    }

    // Check for recent dictations
    if (context.dictations.length > 0) {
      const recentDictation = context.dictations[0];
      const dictDate = new Date(recentDictation.visit_date);

      if (dictDate > threeDaysAgo) {
        newItems.push({
          type: 'visit_note',
          date: recentDictation.visit_date,
          summary: recentDictation.ai_summary,
          provider: recentDictation.provider_name
        });
      }
    }

    // Check for new specialist notes
    if (context.externalDocuments.length > 0) {
      const recentExternal = context.externalDocuments.filter(doc => {
        const docDate = new Date(doc.document_date);
        return docDate > threeDaysAgo;
      });

      for (const doc of recentExternal) {
        newItems.push({
          type: 'specialist_note',
          specialty: doc.specialty,
          provider: doc.provider_name,
          date: doc.document_date,
          summary: doc.ai_summary
        });
      }
    }

    return newItems.length > 0 ? newItems : null;
  }

  /**
   * Check for trend changes
   */
  checkTrendChanges(context) {
    const trends = [];

    // A1C trend
    if (context.labs?.['A1C'] || context.labs?.['HbA1c']) {
      const a1cResults = context.labs['A1C'] || context.labs['HbA1c'];
      if (Array.isArray(a1cResults) && a1cResults.length >= 2) {
        const current = parseFloat(a1cResults[0].value);
        const previous = parseFloat(a1cResults[1].value);
        const change = current - previous;

        if (Math.abs(change) >= 0.3) {
          trends.push({
            metric: 'A1C',
            direction: change < 0 ? 'improving' : 'worsening',
            current,
            previous,
            change: Math.abs(change).toFixed(1)
          });
        }
      }
    }

    // Time in range trend (CGM)
    if (context.cgmReadings.length >= 100) {
      const inRangeCount = context.cgmReadings.filter(
        r => r.glucose_value >= 70 && r.glucose_value <= 180
      ).length;
      const timeInRange = (inRangeCount / context.cgmReadings.length) * 100;

      // Check against previous status if available
      if (timeInRange >= 70) {
        trends.push({
          metric: 'Time in Range',
          direction: 'good',
          value: Math.round(timeInRange),
          message: `${Math.round(timeInRange)}% time in target range`
        });
      } else if (timeInRange < 50) {
        trends.push({
          metric: 'Time in Range',
          direction: 'attention_needed',
          value: Math.round(timeInRange),
          message: `Only ${Math.round(timeInRange)}% time in target range`
        });
      }
    }

    return trends.length > 0 ? trends : null;
  }

  /**
   * Build safety status response
   */
  buildSafetyStatus(issues, context) {
    const firstName = context.patient.first_name || 'there';
    const primaryIssue = issues[0]; // Most severe issue

    let headline, emoji;

    if (primaryIssue.type === 'hypoglycemia_pattern') {
      headline = `${firstName}, we noticed some low blood sugar readings that need attention`;
      emoji = '⚠️';
    } else if (primaryIssue.type === 'hyperglycemia_pattern') {
      headline = `${firstName}, your glucose has been running high - let's get this addressed`;
      emoji = '📊';
    } else if (primaryIssue.type === 'critical_lab') {
      headline = `${firstName}, your ${primaryIssue.lab} result needs follow-up`;
      emoji = '🔬';
    } else {
      headline = `${firstName}, there's something important we need to discuss`;
      emoji = '❗';
    }

    return {
      status_type: 'safety',
      status_headline: headline,
      status_emoji: emoji,
      priority_reason: primaryIssue.message,
      changes: issues.slice(0, 3).map(issue => ({
        type: issue.type,
        description: issue.message,
        trend: 'attention',
        date: new Date().toISOString().split('T')[0]
      })),
      focus_item: primaryIssue.message,
      focus_category: 'urgent',
      next_action: 'Message your care team about this',
      next_action_type: 'message',
      next_action_priority: 2,
      data_sources: ['labs', 'cgm']
    };
  }

  /**
   * Build new info status response
   */
  buildNewInfoStatus(newItems, context) {
    const firstName = context.patient.first_name || 'there';
    const primaryItem = newItems[0];

    let headline, emoji, focusItem;

    if (primaryItem.type === 'lab') {
      headline = `${firstName}, your ${primaryItem.name} results are in`;
      emoji = '🔬';
      focusItem = `${primaryItem.name}: ${primaryItem.value}${primaryItem.unit || ''}`;
    } else if (primaryItem.type === 'visit_note') {
      headline = `${firstName}, your visit summary is ready`;
      emoji = '📋';
      focusItem = primaryItem.summary?.slice(0, 100) || 'Visit summary available';
    } else if (primaryItem.type === 'specialist_note') {
      headline = `${firstName}, we received a note from ${primaryItem.specialty || 'your specialist'}`;
      emoji = '📨';
      focusItem = primaryItem.summary?.slice(0, 100) || 'Specialist note received';
    } else {
      headline = `${firstName}, there's new information about your health`;
      emoji = '📋';
      focusItem = 'New health information available';
    }

    return {
      status_type: 'new_info',
      status_headline: headline,
      status_emoji: emoji,
      priority_reason: `New ${primaryItem.type} from ${primaryItem.date}`,
      changes: newItems.slice(0, 3).map(item => ({
        type: item.type,
        description: item.type === 'lab'
          ? `${item.name}: ${item.value}${item.unit || ''}`
          : item.summary?.slice(0, 50) || 'New information',
        trend: 'new',
        date: item.date
      })),
      focus_item: focusItem,
      focus_category: primaryItem.type,
      next_action: 'Tap to see your results',
      next_action_type: 'none',
      next_action_priority: 1,
      data_sources: [...new Set(newItems.map(i => i.type))]
    };
  }

  /**
   * Build trend status response
   */
  buildTrendStatus(trends, context) {
    const firstName = context.patient.first_name || 'there';
    const primaryTrend = trends[0];

    let headline, emoji;

    if (primaryTrend.direction === 'improving') {
      headline = `${firstName}, your ${primaryTrend.metric} is improving - great work!`;
      emoji = '📈';
    } else if (primaryTrend.direction === 'good') {
      headline = `${firstName}, you're doing great - ${primaryTrend.message}`;
      emoji = '✅';
    } else if (primaryTrend.direction === 'worsening') {
      headline = `${firstName}, your ${primaryTrend.metric} has gone up - let's talk about it`;
      emoji = '📉';
    } else {
      headline = `${firstName}, let's look at how things are trending`;
      emoji = '📊';
    }

    return {
      status_type: 'trend',
      status_headline: headline,
      status_emoji: emoji,
      priority_reason: `${primaryTrend.metric} ${primaryTrend.direction}`,
      changes: trends.slice(0, 3).map(trend => ({
        type: 'trend',
        description: trend.metric === 'A1C'
          ? `A1C ${trend.direction === 'improving' ? 'down' : 'up'} ${trend.change}% to ${trend.current}%`
          : trend.message,
        trend: trend.direction,
        date: new Date().toISOString().split('T')[0]
      })),
      focus_item: primaryTrend.message || `${primaryTrend.metric} is ${primaryTrend.direction}`,
      focus_category: 'trends',
      next_action: primaryTrend.direction === 'improving'
        ? 'Keep up the good work!'
        : 'Let\'s discuss this at your next visit',
      next_action_type: 'none',
      next_action_priority: 0,
      data_sources: ['labs', 'cgm']
    };
  }

  /**
   * Build stable status response
   */
  buildStableStatus(context) {
    const firstName = context.patient.first_name || 'there';

    // Check for any pending actions
    const pendingRefills = context.medications.filter(m => m.need_refill).length;
    const nextAppointment = context.patient.next_appointment_date;

    let headline, focusItem, nextAction, nextActionType;

    if (pendingRefills > 0) {
      headline = `${firstName}, everything looks stable. You have ${pendingRefills} refill request${pendingRefills > 1 ? 's' : ''} pending.`;
      focusItem = 'Medication refills in process';
      nextAction = 'Check refill status';
      nextActionType = 'refill';
    } else if (nextAppointment) {
      headline = `${firstName}, you're on track. Your next visit is ${new Date(nextAppointment).toLocaleDateString()}.`;
      focusItem = 'Upcoming appointment scheduled';
      nextAction = 'View appointment details';
      nextActionType = 'schedule';
    } else {
      headline = `${firstName}, everything is looking good!`;
      focusItem = 'No action needed right now';
      nextAction = null;
      nextActionType = 'none';
    }

    return {
      status_type: 'stable',
      status_headline: headline,
      status_emoji: '✅',
      priority_reason: 'No urgent items',
      changes: [],
      focus_item: focusItem,
      focus_category: 'stable',
      next_action: nextAction,
      next_action_type: nextActionType,
      next_action_priority: 0,
      data_sources: ['medications', 'appointments']
    };
  }

  /**
   * Build specialist council status from external documents
   */
  async buildCouncilStatus(context) {
    const council = {};

    // Group external documents by specialty
    const docsBySpecialty = {};
    for (const doc of context.externalDocuments || []) {
      const specialty = (doc.specialty || 'other').toLowerCase();
      if (!docsBySpecialty[specialty]) {
        docsBySpecialty[specialty] = [];
      }
      docsBySpecialty[specialty].push(doc);
    }

    // Build status for each specialty we track
    for (const specialty of this.SPECIALTIES) {
      const docs = docsBySpecialty[specialty] || [];
      const latestDoc = docs[0];

      if (latestDoc) {
        const docDate = new Date(latestDoc.document_date);
        const daysSince = Math.floor((Date.now() - docDate.getTime()) / (1000 * 60 * 60 * 24));

        council[specialty] = {
          status: daysSince > 365 ? 'due' : daysSince > 180 ? 'monitoring' : 'stable',
          last_note_date: latestDoc.document_date,
          summary: latestDoc.ai_summary?.slice(0, 200) || 'Note on file',
          provider_name: latestDoc.provider_name || null,
          days_since_last: daysSince
        };
      } else {
        // Check if this specialty is relevant based on diagnoses
        const isRelevant = this.isSpecialtyRelevant(specialty, context.diagnoses);

        if (isRelevant) {
          council[specialty] = {
            status: 'due',
            last_note_date: null,
            summary: 'No recent notes on file',
            provider_name: null,
            days_since_last: null
          };
        }
      }
    }

    return council;
  }

  /**
   * Check if a specialty is relevant for this patient based on diagnoses
   */
  isSpecialtyRelevant(specialty, diagnoses) {
    const diagnosisText = JSON.stringify(diagnoses).toLowerCase();

    const relevanceMap = {
      cardiology: ['heart', 'cardiac', 'hypertension', 'chf', 'atrial', 'cad', 'coronary'],
      nephrology: ['kidney', 'renal', 'ckd', 'esrd', 'dialysis', 'nephropathy'],
      ophthalmology: ['diabetic retinopathy', 'eye', 'vision', 'glaucoma', 'cataract'],
      podiatry: ['foot', 'neuropathy', 'ulcer', 'amputation'],
      endocrinology: ['diabetes', 'thyroid', 'adrenal', 'pituitary'],
      neurology: ['neuropathy', 'stroke', 'seizure', 'parkinson'],
      pcp: [] // Always relevant
    };

    const keywords = relevanceMap[specialty] || [];

    if (specialty === 'pcp') return true;

    return keywords.some(keyword => diagnosisText.includes(keyword));
  }

  /**
   * Build clinical snapshot for context
   */
  buildClinicalSnapshot(context) {
    const snapshot = {};

    // Latest A1C
    const a1cResults = context.labs?.['A1C'] || context.labs?.['HbA1c'];
    if (Array.isArray(a1cResults) && a1cResults.length > 0) {
      const latest = a1cResults[0];
      const previous = a1cResults[1];

      snapshot.latest_a1c = {
        value: parseFloat(latest.value),
        date: latest.date,
        trend: previous
          ? (parseFloat(latest.value) < parseFloat(previous.value) ? 'improving' : 'worsening')
          : 'unknown'
      };
    }

    // Latest glucose from CGM
    if (context.cgmReadings.length > 0) {
      const latest = context.cgmReadings[0];
      snapshot.latest_glucose = {
        value: latest.glucose_value,
        trend: latest.trend_arrow || '→',
        timestamp: latest.reading_timestamp
      };

      // Time in range (24h)
      const inRangeCount = context.cgmReadings.filter(
        r => r.glucose_value >= 70 && r.glucose_value <= 180
      ).length;
      snapshot.time_in_range_24h = Math.round((inRangeCount / context.cgmReadings.length) * 100);
    }

    // Medication counts
    const activeMeds = context.medications.filter(m => m.status === 'active');
    snapshot.active_medications_count = activeMeds.length;
    snapshot.pending_refills = activeMeds.filter(m => m.need_refill).length;

    // Visit tracking
    if (context.dictations.length > 0) {
      const lastVisit = new Date(context.dictations[0].visit_date);
      snapshot.days_since_last_visit = Math.floor(
        (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Next appointment
    if (context.patient.next_appointment_date) {
      snapshot.next_appointment = context.patient.next_appointment_date;
    }

    return snapshot;
  }

  /**
   * Save computed status to database
   */
  async saveStatus(unifiedPatientId, status) {
    const { error } = await supabase
      .from('patient_daily_status')
      .upsert({
        unified_patient_id: unifiedPatientId,
        computed_at: new Date().toISOString(),
        status_type: status.status_type,
        status_headline: status.status_headline,
        status_emoji: status.status_emoji,
        priority_reason: status.priority_reason,
        changes: status.changes,
        focus_item: status.focus_item,
        focus_category: status.focus_category,
        next_action: status.next_action,
        next_action_type: status.next_action_type,
        next_action_priority: status.next_action_priority,
        council_status: status.council_status,
        clinical_snapshot: status.clinical_snapshot,
        data_sources: status.data_sources,
        computation_duration_ms: status.computation_duration_ms,
        model_version: status.model_version,
        expires_at: status.expires_at
      }, {
        onConflict: 'unified_patient_id,DATE(computed_at)',
        ignoreDuplicates: false
      });

    if (error) {
      logger.error('PatientStatusEngine', 'Failed to save status', { error: error.message });
      throw error;
    }
  }

  /**
   * Trigger status recomputation for specific events
   */
  async triggerRecompute(unifiedPatientId, reason) {
    logger.info('PatientStatusEngine', 'Triggered recompute', { patientId: unifiedPatientId, reason });

    // Mark existing status as expired
    await supabase
      .from('patient_daily_status')
      .update({ expires_at: new Date().toISOString() })
      .eq('unified_patient_id', unifiedPatientId)
      .is('expires_at', null);

    // Recompute
    return this.computePatientStatus(unifiedPatientId);
  }
}

module.exports = new PatientStatusEngine();
