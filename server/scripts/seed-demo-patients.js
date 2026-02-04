/**
 * Seed Demo CGM Patients
 * Creates 3 demo patients with 14 days of realistic synthetic glucose data.
 *
 * Patients:
 *  - Peter Parker: Well-controlled T1D (avg ~140, TIR ~72%)
 *  - Clark Kent: Poorly controlled T2D (avg ~210, TIR ~35%, dawn phenomenon)
 *  - Bruce Banner: Variable/stressed (avg ~175, TIR ~55%, high CV, erratic)
 *
 * Usage: node server/scripts/seed-demo-patients.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_PATIENTS = [
  {
    phone10: '5551234001',
    phoneE164: '+15551234001',
    firstName: 'PETER',
    lastName: 'PARKER',
    fullName: 'PETER PARKER',
    dob: '1995-08-10',
    email: 'peter.parker@demo.test',
    profile: 'well_controlled',
  },
  {
    phone10: '5551234002',
    phoneE164: '+15551234002',
    firstName: 'CLARK',
    lastName: 'KENT',
    fullName: 'CLARK KENT',
    dob: '1978-06-18',
    email: 'clark.kent@demo.test',
    profile: 'poorly_controlled',
  },
  {
    phone10: '5551234003',
    phoneE164: '+15551234003',
    firstName: 'BRUCE',
    lastName: 'BANNER',
    fullName: 'BRUCE BANNER',
    dob: '1969-12-18',
    email: 'bruce.banner@demo.test',
    profile: 'variable',
  },
];

const DAYS = 14;
const READINGS_PER_DAY = 288; // every 5 min

// Gaussian random with mean and stdDev
function gaussian(mean, stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generate glucose readings for a given profile
 */
function generateReadings(profile, phoneE164, patientName, startDate) {
  const readings = [];
  let glucose;

  for (let day = 0; day < DAYS; day++) {
    // Reset daily base
    if (profile === 'well_controlled') glucose = gaussian(130, 10);
    else if (profile === 'poorly_controlled') glucose = gaussian(195, 15);
    else glucose = gaussian(160, 20);

    for (let i = 0; i < READINGS_PER_DAY; i++) {
      const ts = new Date(startDate.getTime() + (day * 24 * 60 + i * 5) * 60 * 1000);
      const hour = ts.getHours();
      const minuteOfDay = hour * 60 + ts.getMinutes();

      if (profile === 'well_controlled') {
        // Target: avg ~145, TIR ~72%, post-meal spikes to 200+, occasional lows
        glucose += gaussian(0, 6);
        glucose += (145 - glucose) * 0.025;
        // Post-meal spikes (push above 180 regularly)
        if (minuteOfDay >= 430 && minuteOfDay <= 480) glucose += gaussian(8, 3); // breakfast spike
        if (minuteOfDay >= 480 && minuteOfDay <= 560) glucose += gaussian(-4, 2); // recovery
        if (minuteOfDay >= 730 && minuteOfDay <= 780) glucose += gaussian(7, 3); // lunch spike
        if (minuteOfDay >= 780 && minuteOfDay <= 860) glucose += gaussian(-4, 2);
        if (minuteOfDay >= 1090 && minuteOfDay <= 1140) glucose += gaussian(10, 4); // dinner (biggest)
        if (minuteOfDay >= 1140 && minuteOfDay <= 1220) glucose += gaussian(-4, 2);
        // Overnight lows (some nights dip below 70)
        if (hour >= 2 && hour <= 5 && day % 3 === 0) glucose += gaussian(-4, 3);
        glucose = clamp(glucose, 50, 280);

      } else if (profile === 'poorly_controlled') {
        // Target: avg ~190, TIR ~35%, dawn phenomenon, frequent highs but some in-range
        glucose += gaussian(0, 3);
        glucose += (175 - glucose) * 0.03;
        // Dawn phenomenon: 4am-8am
        if (hour >= 4 && hour <= 7) glucose += gaussian(1.5, 1);
        if (hour >= 7 && hour <= 8) glucose += gaussian(0.5, 0.5);
        // Baseline already high, meals push higher
        if (minuteOfDay >= 430 && minuteOfDay <= 490) glucose += gaussian(4, 2);
        if (minuteOfDay >= 490 && minuteOfDay <= 570) glucose += gaussian(-1.5, 1);
        if (minuteOfDay >= 730 && minuteOfDay <= 790) glucose += gaussian(3.5, 2);
        if (minuteOfDay >= 790 && minuteOfDay <= 870) glucose += gaussian(-1.5, 1);
        if (minuteOfDay >= 1090 && minuteOfDay <= 1150) glucose += gaussian(5, 2.5);
        if (minuteOfDay >= 1150 && minuteOfDay <= 1230) glucose += gaussian(-2, 1);
        // Dips into range during late morning sometimes
        if (hour >= 10 && hour <= 11) glucose += gaussian(-0.5, 1);
        glucose = clamp(glucose, 65, 340);

      } else {
        // Variable/erratic (Bruce Banner)
        // Target: avg ~175, TIR ~55%, high CV, unpredictable swings
        glucose += gaussian(0, 5);
        glucose += (160 - glucose) * 0.03;
        // Random excursions
        if (Math.random() < 0.008) glucose += gaussian(45, 14); // sudden spike
        if (Math.random() < 0.005) glucose -= gaussian(30, 10); // sudden drop
        // Highly variable meal responses
        if (minuteOfDay >= 430 && minuteOfDay <= 490) glucose += gaussian(7, 5);
        if (minuteOfDay >= 490 && minuteOfDay <= 560) glucose += gaussian(-2, 3);
        if (minuteOfDay >= 730 && minuteOfDay <= 790) glucose += gaussian(6, 5);
        if (minuteOfDay >= 790 && minuteOfDay <= 860) glucose += gaussian(-2, 3);
        if (minuteOfDay >= 1090 && minuteOfDay <= 1150) glucose += gaussian(8, 5);
        if (minuteOfDay >= 1150 && minuteOfDay <= 1230) glucose += gaussian(-3, 3);
        // Exercise drops (afternoon some days)
        if (hour >= 15 && hour <= 16 && day % 3 === 0) glucose += gaussian(-5, 3);
        glucose = clamp(glucose, 40, 340);
      }

      const glucoseRounded = Math.round(glucose);
      const trend = getTrend(profile, hour, i);

      readings.push({
        patient_phone: phoneE164,
        patient_name: patientName,
        glucose_value: glucoseRounded,
        glucose_units: 'mg/dl',
        trend_direction: trend.direction,
        trend_arrow: trend.arrow,
        reading_timestamp: ts.toISOString(),
        device_name: 'Demo Sensor',
        nightscout_id: `demo_${phoneE164}_${ts.getTime()}`,
        nightscout_url: 'demo',
      });
    }
  }
  return readings;
}

function getTrend(profile, hour, readingIndex) {
  // Simplified trend based on time of day
  const trends = [
    { direction: 'Flat', arrow: '\u2192' },
    { direction: 'SingleUp', arrow: '\u2191' },
    { direction: 'FortyFiveUp', arrow: '\u2197' },
    { direction: 'SingleDown', arrow: '\u2193' },
    { direction: 'FortyFiveDown', arrow: '\u2198' },
  ];

  if (profile === 'poorly_controlled' && hour >= 4 && hour <= 8) return trends[1]; // rising morning
  if (hour >= 7 && hour <= 8) return trends[2]; // breakfast rise
  if (hour >= 9 && hour <= 10) return trends[3]; // post-breakfast drop
  if (hour >= 12 && hour <= 13) return trends[2]; // lunch rise
  if (hour >= 18 && hour <= 19) return trends[2]; // dinner rise
  return trends[0]; // flat
}

/**
 * Generate sample events
 */
function generateEvents(phoneE164, startDate) {
  const events = [];

  for (let day = 0; day < DAYS; day++) {
    const dayStart = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);

    // Breakfast
    events.push({
      patient_phone: phoneE164,
      event_type: 'meal',
      event_timestamp: new Date(dayStart.getTime() + (7 * 60 + Math.floor(Math.random() * 30)) * 60 * 1000).toISOString(),
      carbs_grams: 30 + Math.floor(Math.random() * 25),
      meal_label: 'Breakfast',
      recorded_by: 'patient',
    });

    // Lunch
    events.push({
      patient_phone: phoneE164,
      event_type: 'meal',
      event_timestamp: new Date(dayStart.getTime() + (12 * 60 + Math.floor(Math.random() * 30)) * 60 * 1000).toISOString(),
      carbs_grams: 40 + Math.floor(Math.random() * 30),
      meal_label: 'Lunch',
      recorded_by: 'patient',
    });

    // Dinner
    events.push({
      patient_phone: phoneE164,
      event_type: 'meal',
      event_timestamp: new Date(dayStart.getTime() + (18 * 60 + Math.floor(Math.random() * 30)) * 60 * 1000).toISOString(),
      carbs_grams: 45 + Math.floor(Math.random() * 35),
      meal_label: 'Dinner',
      recorded_by: 'patient',
    });

    // Insulin (rapid at meals, long-acting at bedtime)
    events.push({
      patient_phone: phoneE164,
      event_type: 'insulin',
      event_timestamp: new Date(dayStart.getTime() + (7 * 60 + 5) * 60 * 1000).toISOString(),
      insulin_units: 4 + Math.round(Math.random() * 4),
      insulin_type: 'rapid',
      recorded_by: 'patient',
    });
    events.push({
      patient_phone: phoneE164,
      event_type: 'insulin',
      event_timestamp: new Date(dayStart.getTime() + (22 * 60) * 60 * 1000).toISOString(),
      insulin_units: 18 + Math.round(Math.random() * 6),
      insulin_type: 'long-acting',
      recorded_by: 'patient',
    });

    // Exercise (every other day)
    if (day % 2 === 0) {
      events.push({
        patient_phone: phoneE164,
        event_type: 'exercise',
        event_timestamp: new Date(dayStart.getTime() + (15 * 60 + 30) * 60 * 1000).toISOString(),
        exercise_minutes: 20 + Math.floor(Math.random() * 25),
        exercise_type: ['walk', 'run', 'gym'][Math.floor(Math.random() * 3)],
        exercise_intensity: ['light', 'moderate', 'vigorous'][Math.floor(Math.random() * 3)],
        recorded_by: 'patient',
      });
    }
  }

  return events;
}

async function run() {
  logger.startup('Seeding Demo CGM Patients');
  const startDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  for (const p of DEMO_PATIENTS) {
    logger.info('DemoSeed', 'Processing patient', { name: p.fullName, phone: p.phoneE164 });

    // 1. Check if patient exists
    const { data: existing } = await supabase
      .from('unified_patients')
      .select('id')
      .eq('phone_primary', p.phone10)
      .single();

    let patientId;
    if (existing) {
      patientId = existing.id;
      logger.info('DemoSeed', 'Patient exists', { id: patientId });
    } else {
      const { data: newPatient, error: insertErr } = await supabase
        .from('unified_patients')
        .insert({
          phone_primary: p.phone10,
          phone_display: `(${p.phone10.slice(0, 3)}) ${p.phone10.slice(3, 6)}-${p.phone10.slice(6)}`,
          first_name: p.firstName,
          last_name: p.lastName,
          full_name: p.fullName,
          date_of_birth: p.dob,
          email: p.email,
          created_from: 'demo-seed',
          data_sources: ['demo'],
          is_active: true,
          patient_status: 'active',
        })
        .select('id')
        .single();

      if (insertErr) {
        logger.error('DemoSeed', 'Failed to create patient', { error: insertErr.message });
        continue;
      }
      patientId = newPatient.id;
      logger.info('DemoSeed', 'Created patient', { id: patientId });
    }

    // 2. Upsert CGM config
    const { data: existingConfig } = await supabase
      .from('patient_nightscout_config')
      .select('id')
      .eq('patient_phone', p.phoneE164)
      .single();

    const configRecord = {
      patient_phone: p.phoneE164,
      patient_name: p.fullName,
      data_source: 'demo',
      sync_enabled: false,
      connection_status: 'active',
      unified_patient_id: patientId,
      last_sync_at: new Date().toISOString(),
      last_successful_sync_at: new Date().toISOString(),
    };

    if (existingConfig) {
      await supabase.from('patient_nightscout_config').update(configRecord).eq('id', existingConfig.id);
      logger.info('DemoSeed', 'Updated CGM config');
    } else {
      const { error: cfgErr } = await supabase.from('patient_nightscout_config').insert(configRecord);
      if (cfgErr) logger.error('DemoSeed', 'Config insert error', { error: cfgErr.message });
      else logger.info('DemoSeed', 'Created CGM config');
    }

    // 3. Delete existing demo readings for this patient (for idempotency)
    await supabase.from('cgm_readings').delete().eq('patient_phone', p.phoneE164);
    logger.info('DemoSeed', 'Cleared old demo readings');

    // 4. Generate and insert readings
    const readings = generateReadings(p.profile, p.phoneE164, p.fullName, startDate);
    logger.info('DemoSeed', 'Generated readings', { count: readings.length, days: DAYS });

    // Add unified_patient_id to all readings
    readings.forEach(r => { r.unified_patient_id = patientId; });

    // Insert in batches of 500
    let inserted = 0;
    for (let i = 0; i < readings.length; i += 500) {
      const batch = readings.slice(i, i + 500);
      const { error } = await supabase.from('cgm_readings').insert(batch);
      if (error) {
        logger.error('DemoSeed', 'Batch insert error', { offset: i, error: error.message });
        break;
      }
      inserted += batch.length;
    }
    logger.info('DemoSeed', 'Inserted readings', { count: inserted });

    // 5. Generate and insert events (only if table exists)
    try {
      await supabase.from('cgm_events').delete().eq('patient_phone', p.phoneE164);
      const events = generateEvents(p.phoneE164, startDate);
      events.forEach(e => { e.unified_patient_id = patientId; });
      const { error: evtErr } = await supabase.from('cgm_events').insert(events);
      if (evtErr) {
        logger.warn('DemoSeed', 'Events table not ready, skipping events', { error: evtErr.message });
      } else {
        logger.info('DemoSeed', 'Inserted events', { count: events.length });
      }
    } catch (e) {
      logger.warn('DemoSeed', 'Events table not available, will seed events later');
    }

    // 6. Quick stats
    const values = readings.map(r => r.glucose_value);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const inRange = values.filter(v => v >= 70 && v <= 180).length;
    const tir = Math.round((inRange / values.length) * 100);
    const below = values.filter(v => v < 70).length;
    const above = values.filter(v => v > 180).length;
    logger.info('DemoSeed', 'Patient stats', { avg, tir: `${tir}%`, below70: below, above180: above });
  }

  logger.info('DemoSeed', 'Demo seed complete');
}

run().catch(err => {
  logger.error('DemoSeed', 'Fatal error', { error: err.message });
  process.exit(1);
});
