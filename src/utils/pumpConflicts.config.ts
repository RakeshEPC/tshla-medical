// Pump Conflict Detection Rules
import { ConflictRule, ConflictDetection } from '../types/context7.types';

export const CONFLICT_RULES: ConflictRule[] = [
  {
    name: 'tubeless_vs_tubing_preference',
    features: ['Tubing Preference'],
    conflictType: 'mutually_exclusive',
    severity: 'high',
    message: 'You indicated a strong preference for tubeless, but some selected features require tubed pumps',
    resolution: 'Which is more important: tubeless design or specific features that require tubing?',
    affectedPumps: ['Omnipod 5'],
  },
  {
    name: 'apple_watch_compatibility',
    features: ['App Control', 'Visibility'],
    conflictType: 'compatibility_issue',
    severity: 'medium',
    message: 'Apple Watch bolusing is only available on Twiist AID',
    resolution: 'Is Apple Watch control a must-have feature for you?',
    affectedPumps: ['Twiist'],
  },
  {
    name: 'dexcom_g7_compatibility',
    features: ['App Control', 'Tubing Preference'],
    conflictType: 'compatibility_issue',
    severity: 'high',
    message: 'Dexcom G7 integration is only available with Tandem pumps, which have tubing',
    resolution: 'Which is more important: Dexcom G7 integration or tubeless design?',
    affectedPumps: ['Tandem t:slim X2', 'Tandem Mobi'],
  },
  {
    name: 'smallest_weight_vs_features',
    features: ['Visibility', 'Control Preference'],
    conflictType: 'compatibility_issue',
    severity: 'medium',
    message: 'The lightest pump (Twiist at 2oz) may not have all advanced features you selected',
    resolution: 'Which is more important: smallest/lightest pump or maximum features?',
    affectedPumps: ['Twiist'],
  },
  {
    name: 'fully_automated_vs_manual_control',
    features: ['Control Preference', 'Automation Trust'],
    conflictType: 'mutually_exclusive',
    severity: 'medium',
    message: 'You want both full automation and manual control - these are opposite preferences',
    resolution: 'Do you prefer more automation or more manual control?',
    affectedPumps: [],
  },
  {
    name: 'low_tech_vs_advanced_features',
    features: ['Control Preference', 'Target Adjustability'],
    conflictType: 'compatibility_issue',
    severity: 'low',
    message: 'You indicated low tech comfort but selected advanced customization features',
    resolution: 'Are you comfortable learning advanced features, or prefer simplicity?',
    affectedPumps: [],
  },
  {
    name: 'exercise_mode_availability',
    features: ['Exercise Mode', 'Tubing Preference'],
    conflictType: 'compatibility_issue',
    severity: 'low',
    message: 'Dedicated exercise modes vary by pump - Omnipod 5 has Activity feature',
    resolution: 'How critical are dedicated exercise modes for your lifestyle?',
    affectedPumps: ['Omnipod 5'],
  },
  {
    name: 'clinic_support_vs_independence',
    features: ['Clinic Support', 'Control Preference'],
    conflictType: 'no_overlap',
    severity: 'low',
    message: 'You want strong clinic support but also high independence/control',
    resolution: 'Do you prefer more guidance from clinic or more independence?',
    affectedPumps: [],
  },
  {
    name: 'tight_control_algorithm',
    features: ['Control Preference', 'Automation Trust'],
    conflictType: 'compatibility_issue',
    severity: 'high',
    message: 'Tightest control algorithms (Tandem Control-IQ, Medtronic SmartGuard) are highly automated',
    resolution: 'For tight control, you need to trust automation. Are you comfortable with this?',
    affectedPumps: ['Tandem t:slim X2', 'Tandem Mobi', 'Medtronic 780G'],
  },
  {
    name: 'minimal_carb_counting_vs_accuracy',
    features: ['Carb Counting', 'Control Preference'],
    conflictType: 'compatibility_issue',
    severity: 'medium',
    message: 'You prefer minimal carb counting, but most advanced algorithms require accurate carb entries',
    resolution: 'Are you willing to count carbs for better control, or prefer simplicity?',
    affectedPumps: ['Beta Bionics iLet'],
  },
];

/**
 * Detect conflicts based on user responses
 */
export function detectConflicts(
  responses: Record<string, number>,
  selectedFeatures: any[] = []
): ConflictDetection {
  const conflicts: ConflictDetection['conflicts'] = [];

  // Tubeless vs Tubing preference conflict
  const tubingPref = responses['Tubing Preference'];
  if (tubingPref && tubingPref <= 3) {
    // User prefers tubeless (low score)
    const controlPref = responses['Control Preference'];
    const appControl = responses['App Control'];

    // Check if they want features that might conflict
    if (controlPref && controlPref >= 8 && appControl && appControl >= 8) {
      const rule = CONFLICT_RULES.find(r => r.name === 'dexcom_g7_compatibility');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['Tubeless preference (low tubing score)', 'High app control demand'],
          suggestion: 'Consider Omnipod 5 for tubeless with good app control, or Tandem if G7 integration is critical',
        });
      }
    }
  }

  // Fully automated vs Manual control conflict
  const controlPref = responses['Control Preference'];
  const automationTrust = responses['Automation Trust'];
  if (controlPref && automationTrust) {
    if (controlPref <= 3 && automationTrust >= 8) {
      // Wants manual control but high automation trust - conflicting
      const rule = CONFLICT_RULES.find(r => r.name === 'fully_automated_vs_manual_control');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['Low control preference (manual)', 'High automation trust'],
          suggestion: 'If you trust automation, consider allowing more automated control for better outcomes',
        });
      }
    } else if (controlPref >= 8 && automationTrust <= 3) {
      // Wants automation but doesn't trust it
      const rule = CONFLICT_RULES.find(r => r.name === 'fully_automated_vs_manual_control');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['High control preference (automated)', 'Low automation trust'],
          suggestion: 'Building trust in automation takes time. Consider starting with semi-automated pumps',
        });
      }
    }
  }

  // Low tech comfort vs Advanced features conflict
  const appControl = responses['App Control'];
  const targetAdjust = responses['Target Adjustability'];
  if (appControl && targetAdjust) {
    // Check if user wants advanced features (high scores) but...
    // We'd need to check their "tech comfort" from a different source
    // For now, detect if they want high customization
    if (targetAdjust >= 8 && appControl >= 8) {
      const rule = CONFLICT_RULES.find(r => r.name === 'low_tech_vs_advanced_features');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['High target adjustability', 'High app control'],
          suggestion: 'These features require tech comfort. Consider starting simple and adding features gradually',
        });
      }
    }
  }

  // Tight control algorithm conflict
  const carbCounting = responses['Carb Counting'];
  if (controlPref && automationTrust && carbCounting) {
    // User wants automation (high control pref) but cautious automation trust
    if (controlPref >= 8 && automationTrust <= 4) {
      const rule = CONFLICT_RULES.find(r => r.name === 'tight_control_algorithm');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['Wants automated control', 'Low automation trust'],
          suggestion: 'Tandem Control-IQ and Medtronic SmartGuard are highly automated. Building trust is key',
        });
      }
    }
  }

  // Minimal carb counting vs accuracy conflict
  if (carbCounting && controlPref) {
    if (carbCounting <= 3 && controlPref >= 7) {
      // Wants good control but minimal carb counting
      const rule = CONFLICT_RULES.find(r => r.name === 'minimal_carb_counting_vs_accuracy');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['Prefers minimal carb counting', 'Wants good control'],
          suggestion: 'Consider Beta Bionics iLet which requires minimal carb counting (meal announcements only)',
        });
      }
    }
  }

  // Exercise mode importance conflict
  const exerciseMode = responses['Exercise Mode'];
  if (exerciseMode && exerciseMode >= 8 && tubingPref && tubingPref <= 3) {
    const rule = CONFLICT_RULES.find(r => r.name === 'exercise_mode_availability');
    if (rule) {
      conflicts.push({
        rule,
        detectedFeatures: ['High exercise mode importance', 'Tubeless preference'],
        suggestion: 'Omnipod 5 has Activity feature and is tubeless - good match for active lifestyle',
      });
    }
  }

  // Clinic support vs independence conflict
  const clinicSupport = responses['Clinic Support'];
  if (clinicSupport && controlPref) {
    if (clinicSupport >= 8 && controlPref <= 3) {
      // Wants clinic support AND manual control
      const rule = CONFLICT_RULES.find(r => r.name === 'clinic_support_vs_independence');
      if (rule) {
        conflicts.push({
          rule,
          detectedFeatures: ['High clinic support need', 'Manual control preference'],
          suggestion: 'Work with your clinic to find balance between guidance and independence',
        });
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Get conflict severity color
 */
export function getConflictSeverityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-blue-600 bg-blue-50 border-blue-200';
  }
}

/**
 * Get conflict severity icon
 */
export function getConflictSeverityIcon(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return '🚨';
    case 'medium':
      return '⚠️';
    case 'low':
      return 'ℹ️';
  }
}
