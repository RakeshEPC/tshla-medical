// Pump Analytics Utility Functions
import { PumpAnalytics, PumpFeedback } from '../types/context7.types';

/**
 * Calculate overall recommendation accuracy
 */
export function calculateOverallAccuracy(feedback: PumpFeedback[]): number {
  const validFeedback = feedback.filter(f => f.accuracy !== -1);
  if (validFeedback.length === 0) return 0;

  const accurate = validFeedback.filter(f => f.accuracy === 1).length;
  return Math.round((accurate / validFeedback.length) * 100);
}

/**
 * Group feedback by pump
 */
export function groupFeedbackByPump(feedback: PumpFeedback[]) {
  const grouped: Record<string, { recommended: number; chosen: number; accuracy: number }> = {};

  feedback.forEach(f => {
    if (f.accuracy === -1) return; // Skip "still deciding"

    if (!grouped[f.recommendedPump]) {
      grouped[f.recommendedPump] = { recommended: 0, chosen: 0, accuracy: 0 };
    }

    grouped[f.recommendedPump].recommended++;

    if (f.actualPump === f.recommendedPump) {
      grouped[f.recommendedPump].chosen++;
    }
  });

  // Calculate accuracy percentage for each pump
  Object.keys(grouped).forEach(pump => {
    const data = grouped[pump];
    data.accuracy = data.recommended > 0 ? Math.round((data.chosen / data.recommended) * 100) : 0;
  });

  return grouped;
}

/**
 * Get top reasons for choosing different pump
 */
export function getTopReasons(feedback: PumpFeedback[], limit: number = 5) {
  const reasonCounts: Record<string, number> = {};
  const totalFeedback = feedback.filter(f => f.accuracy === 0).length;

  feedback
    .filter(f => f.accuracy === 0) // Only "different" choices
    .forEach(f => {
      const reason = f.reasonCategory || 'other';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

  return Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: totalFeedback > 0 ? Math.round((count / totalFeedback) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Filter feedback by date range
 */
export function filterFeedbackByDateRange(feedback: PumpFeedback[], days: number): PumpFeedback[] {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return feedback.filter(f => f.timestamp > cutoffTime);
}

/**
 * Calculate accuracy trend over time
 */
export function calculateAccuracyTrend(feedback: PumpFeedback[], intervalDays: number = 7) {
  const validFeedback = feedback.filter(f => f.accuracy !== -1).sort((a, b) => a.timestamp - b.timestamp);

  if (validFeedback.length === 0) return [];

  const firstTimestamp = validFeedback[0].timestamp;
  const lastTimestamp = validFeedback[validFeedback.length - 1].timestamp;
  const totalDays = Math.ceil((lastTimestamp - firstTimestamp) / (24 * 60 * 60 * 1000));
  const intervals = Math.ceil(totalDays / intervalDays);

  const trend: Array<{ date: string; accuracy: number; count: number }> = [];

  for (let i = 0; i < intervals; i++) {
    const intervalStart = firstTimestamp + i * intervalDays * 24 * 60 * 60 * 1000;
    const intervalEnd = intervalStart + intervalDays * 24 * 60 * 60 * 1000;

    const intervalFeedback = validFeedback.filter(
      f => f.timestamp >= intervalStart && f.timestamp < intervalEnd
    );

    if (intervalFeedback.length > 0) {
      const accurate = intervalFeedback.filter(f => f.accuracy === 1).length;
      const accuracy = Math.round((accurate / intervalFeedback.length) * 100);

      trend.push({
        date: new Date(intervalStart).toLocaleDateString(),
        accuracy,
        count: intervalFeedback.length,
      });
    }
  }

  return trend;
}

/**
 * Export feedback to CSV format
 */
export function exportFeedbackToCSV(feedback: PumpFeedback[]): string {
  const headers = [
    'Feedback ID',
    'Session ID',
    'User ID',
    'Recommended Pump',
    'Actual Pump',
    'Feedback Type',
    'Reason Category',
    'Reason',
    'Accuracy',
    'Timestamp',
    'Date',
  ];

  const rows = feedback.map(f => [
    f.feedbackId,
    f.sessionId,
    f.userId,
    f.recommendedPump,
    f.actualPump || 'N/A',
    f.feedbackType,
    f.reasonCategory || 'N/A',
    f.reason ? `"${f.reason.replace(/"/g, '""')}"` : 'N/A',
    f.accuracy === 1 ? 'Correct' : f.accuracy === 0 ? 'Incorrect' : 'Undecided',
    f.timestamp,
    new Date(f.timestamp).toLocaleString(),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string = 'pump-feedback.csv') {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get accuracy by user segment (based on responses)
 */
export function getAccuracyBySegment(
  feedback: PumpFeedback[],
  sessions: Map<string, any>
): Record<string, { count: number; accuracy: number }> {
  const segments: Record<string, { correct: number; total: number }> = {
    high_tech: { correct: 0, total: 0 },
    low_tech: { correct: 0, total: 0 },
    active: { correct: 0, total: 0 },
    sedentary: { correct: 0, total: 0 },
  };

  feedback
    .filter(f => f.accuracy !== -1)
    .forEach(f => {
      const session = sessions.get(f.sessionId);
      if (!session) return;

      const responses = session.responses || {};
      const techComfort = responses.techComfort || responses['Technology Love'] || 5;
      const activity = responses.activity || responses['Activity Level'] || 5;

      // Categorize by tech comfort
      if (techComfort >= 7) {
        segments.high_tech.total++;
        if (f.accuracy === 1) segments.high_tech.correct++;
      } else if (techComfort <= 3) {
        segments.low_tech.total++;
        if (f.accuracy === 1) segments.low_tech.correct++;
      }

      // Categorize by activity
      if (activity >= 7) {
        segments.active.total++;
        if (f.accuracy === 1) segments.active.correct++;
      } else if (activity <= 3) {
        segments.sedentary.total++;
        if (f.accuracy === 1) segments.sedentary.correct++;
      }
    });

  // Calculate accuracy percentages
  const result: Record<string, { count: number; accuracy: number }> = {};
  Object.entries(segments).forEach(([segment, data]) => {
    result[segment] = {
      count: data.total,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    };
  });

  return result;
}
