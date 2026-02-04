/**
 * CGM Pattern Detection Service
 * Analyzes glucose readings by time-of-day windows to flag recurring problems.
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../logger');
const { allFormats } = require('../utils/phoneNormalize');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TIME_WINDOWS = [
  { name: 'overnight', label: 'Overnight', startHour: 0, endHour: 6 },
  { name: 'morning', label: 'Morning/Fasting', startHour: 6, endHour: 9 },
  { name: 'daytime', label: 'Daytime', startHour: 9, endHour: 17 },
  { name: 'evening', label: 'Evening', startHour: 17, endHour: 24 },
];

/**
 * Detect patterns in CGM data for a patient
 * @param {string} patientPhone - Patient phone in any format
 * @param {number} days - Number of days to analyze (default 14)
 * @returns {Array} Array of detected pattern objects
 */
async function detectPatterns(patientPhone, days = 14) {
  const phones = allFormats(patientPhone);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: readings, error } = await supabase
    .from('cgm_readings')
    .select('glucose_value, reading_timestamp')
    .or(phones.map(p => `patient_phone.eq.${p}`).join(','))
    .gte('reading_timestamp', since)
    .order('reading_timestamp', { ascending: true });

  if (error || !readings || readings.length === 0) {
    logger.debug('CGMPatterns', 'No readings for pattern detection', { patientPhone });
    return [];
  }

  // Group readings by day and time window
  const dayWindows = {}; // { 'YYYY-MM-DD': { overnight: [], morning: [], ... } }

  for (const r of readings) {
    const d = new Date(r.reading_timestamp);
    const dateKey = d.toISOString().split('T')[0];
    const hour = d.getHours();

    if (!dayWindows[dateKey]) {
      dayWindows[dateKey] = {};
      for (const w of TIME_WINDOWS) dayWindows[dateKey][w.name] = [];
    }

    for (const w of TIME_WINDOWS) {
      if (hour >= w.startHour && hour < w.endHour) {
        dayWindows[dateKey][w.name].push(r.glucose_value);
        break;
      }
    }
  }

  const patterns = [];
  const dayKeys = Object.keys(dayWindows).sort();
  const recentDays = dayKeys.slice(-7); // Last 7 days for frequency

  for (const window of TIME_WINDOWS) {
    // Compute per-day stats for this window
    const dailyAvgs = [];
    const dailyHasLow = [];
    const allValues = [];

    for (const dayKey of recentDays) {
      const values = dayWindows[dayKey]?.[window.name] || [];
      if (values.length === 0) continue;

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      dailyAvgs.push({ dayKey, avg });
      dailyHasLow.push(values.some(v => v < 70));
      allValues.push(...values);
    }

    if (allValues.length === 0) continue;

    const windowAvg = Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length);

    // Pattern: Recurring highs (avg > 180 on >= 3 of last 7 days)
    const highDays = dailyAvgs.filter(d => d.avg > 180).length;
    if (highDays >= 3) {
      patterns.push({
        type: 'recurring_highs',
        window: window.name,
        windowLabel: window.label,
        severity: highDays >= 5 ? 'significant' : 'moderate',
        frequency: `${highDays} of ${recentDays.length} days`,
        avgValue: windowAvg,
        detail: `Avg ${window.label.toLowerCase()} glucose ${windowAvg} mg/dl on ${highDays} of last ${recentDays.length} days`,
      });
    }

    // Pattern: Recurring lows (any reading < 70 on >= 2 of last 7 days)
    const lowDays = dailyHasLow.filter(Boolean).length;
    if (lowDays >= 2) {
      patterns.push({
        type: 'recurring_lows',
        window: window.name,
        windowLabel: window.label,
        severity: lowDays >= 4 ? 'significant' : 'moderate',
        frequency: `${lowDays} of ${recentDays.length} days`,
        avgValue: windowAvg,
        detail: `Low glucose events ${window.label.toLowerCase()} on ${lowDays} of last ${recentDays.length} days`,
      });
    }

    // Pattern: High variability (CV > 36%)
    if (allValues.length >= 10) {
      const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
      const variance = allValues.reduce((s, v) => s + (v - mean) ** 2, 0) / allValues.length;
      const cv = Math.round((Math.sqrt(variance) / mean) * 100);

      if (cv > 36) {
        patterns.push({
          type: 'high_variability',
          window: window.name,
          windowLabel: window.label,
          severity: cv > 45 ? 'significant' : 'moderate',
          frequency: `CV ${cv}%`,
          avgValue: windowAvg,
          detail: `High glucose variability ${window.label.toLowerCase()} (CV ${cv}%, target <36%)`,
        });
      }
    }
  }

  // Pattern: Dawn phenomenon (morning avg >= 30 higher than overnight on >= 3 days)
  let dawnCount = 0;
  let dawnDelta = 0;
  for (const dayKey of recentDays) {
    const overnight = dayWindows[dayKey]?.overnight || [];
    const morning = dayWindows[dayKey]?.morning || [];
    if (overnight.length === 0 || morning.length === 0) continue;

    const overnightAvg = overnight.reduce((a, b) => a + b, 0) / overnight.length;
    const morningAvg = morning.reduce((a, b) => a + b, 0) / morning.length;
    const delta = morningAvg - overnightAvg;

    if (delta >= 30) {
      dawnCount++;
      dawnDelta += delta;
    }
  }

  if (dawnCount >= 3) {
    const avgDelta = Math.round(dawnDelta / dawnCount);
    patterns.push({
      type: 'dawn_phenomenon',
      window: 'morning',
      windowLabel: 'Morning/Fasting',
      severity: avgDelta > 50 ? 'significant' : 'moderate',
      frequency: `${dawnCount} of ${recentDays.length} days`,
      avgValue: avgDelta,
      detail: `Morning glucose rises ${avgDelta} mg/dl above overnight on ${dawnCount} of last ${recentDays.length} days`,
    });
  }

  logger.debug('CGMPatterns', `Detected ${patterns.length} patterns`, { patientPhone });
  return patterns;
}

module.exports = { detectPatterns };
