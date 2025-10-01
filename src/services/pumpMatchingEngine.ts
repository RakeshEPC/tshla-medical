// 23-Dimension Insulin Pump Matching Engine
export interface PumpProfile {
  name: string;
  manufacturer: string;
  ideal_for: string[];
  features: string[];
  controllable_features: string[];
  fixed_limitations: string[];
  dimensions: PumpDimensions;
}

export interface PumpDimensions {
  // Device characteristics (1-6)
  tubeless: boolean;
  touchscreen: boolean;
  smartphone_control: boolean;
  cgm_integration: string[];
  rechargeable: boolean;
  waterproof: boolean;

  // Algorithm capabilities (7-12)
  automated_delivery: boolean;
  predictive_low_suspend: boolean;
  automatic_corrections: boolean;
  customizable_targets: boolean;
  exercise_mode: boolean;
  sleep_mode: boolean;

  // User interface (13-17)
  ease_of_use: number; // 1-10
  data_visibility: number; // 1-10
  remote_monitoring: boolean;
  caregiver_access: boolean;
  reports_quality: number; // 1-10

  // Clinical parameters (18-23)
  basal_increment: number; // minimum basal increment
  bolus_increment: number; // minimum bolus increment
  max_basal_rate: number; // units per hour
  max_bolus: number; // units
  insulin_duration: number; // hours (2-8)
  target_range_customization: boolean;
}

export interface PatientProfile {
  // Demographics
  age: number;
  diabetes_type: 'type1' | 'type2' | 'gestational' | 'other';
  years_since_diagnosis: number;

  // Clinical factors
  a1c: number;
  daily_insulin_dose: number;
  hypoglycemia_frequency: 'rare' | 'occasional' | 'frequent';
  hypoglycemia_awareness: 'normal' | 'impaired' | 'unaware';
  glucose_variability: 'low' | 'moderate' | 'high';

  // Lifestyle factors
  tech_comfort: number; // 1-10
  activity_level: 'sedentary' | 'moderate' | 'active' | 'very_active';
  work_schedule: 'regular' | 'shift_work' | 'irregular';
  travel_frequency: 'never' | 'occasional' | 'frequent';

  // Preferences
  priorities: string[]; // ['simplicity', 'control', 'automation', 'discretion']
  cgm_use: 'none' | 'dexcom' | 'freestyle' | 'guardian';
  smartphone_preference: 'ios' | 'android' | 'both' | 'none';

  // Insurance/Cost
  insurance_coverage: 'excellent' | 'good' | 'limited' | 'none';
  cost_sensitivity: 'low' | 'moderate' | 'high';
}

class PumpMatchingEngine {
  private pumps: PumpProfile[] = [
    {
      name: 'Omnipod 5',
      manufacturer: 'Insulet',
      ideal_for: ['tech-savvy', 'kids', 'needle phobic', 'active lifestyle'],
      features: ['Tubeless', 'Automated insulin delivery', 'Smartphone control', 'No separate PDM'],
      controllable_features: [
        'Carb ratio',
        'Glucose targets',
        'Insulin sensitivity factor',
        'Basal rate',
        'Correction factor',
      ],
      fixed_limitations: [
        'No manual mode override',
        'No screen on pod',
        'Must use Dexcom G6/G7 CGM',
      ],
      dimensions: {
        tubeless: true,
        touchscreen: false,
        smartphone_control: true,
        cgm_integration: ['dexcom'],
        rechargeable: false,
        waterproof: true,
        automated_delivery: true,
        predictive_low_suspend: true,
        automatic_corrections: true,
        customizable_targets: true,
        exercise_mode: true,
        sleep_mode: false,
        ease_of_use: 9,
        data_visibility: 8,
        remote_monitoring: true,
        caregiver_access: true,
        reports_quality: 8,
        basal_increment: 0.05,
        bolus_increment: 0.05,
        max_basal_rate: 30,
        max_bolus: 30,
        insulin_duration: 4,
        target_range_customization: true,
      },
    },
    {
      name: 'Tandem t:slim X2 with Control-IQ',
      manufacturer: 'Tandem',
      ideal_for: ['tight control', 'tech-comfortable', 'adults', 'data focused'],
      features: ['Touchscreen', 'Control-IQ algorithm', 'Dexcom integration', 'Rechargeable'],
      controllable_features: [
        'Carb ratio',
        'Glucose targets',
        'Duration of insulin action',
        'Basal rates',
        'Correction factor',
      ],
      fixed_limitations: ['Tubing required', 'Daily charging needed', 'Limited smartphone control'],
      dimensions: {
        tubeless: false,
        touchscreen: true,
        smartphone_control: false,
        cgm_integration: ['dexcom'],
        rechargeable: true,
        waterproof: true,
        automated_delivery: true,
        predictive_low_suspend: true,
        automatic_corrections: true,
        customizable_targets: true,
        exercise_mode: true,
        sleep_mode: true,
        ease_of_use: 7,
        data_visibility: 9,
        remote_monitoring: true,
        caregiver_access: true,
        reports_quality: 9,
        basal_increment: 0.001,
        bolus_increment: 0.01,
        max_basal_rate: 15,
        max_bolus: 25,
        insulin_duration: 5,
        target_range_customization: true,
      },
    },
    {
      name: 'Medtronic 780G',
      manufacturer: 'Medtronic',
      ideal_for: ['frequent lows', 'poor control', 'high variability'],
      features: ['SmartGuard', 'Automatic corrections every 5 min', 'Meal detection', 'Auto Mode'],
      controllable_features: ['Carb ratio', 'Glucose targets', 'Active insulin time'],
      fixed_limitations: ['Requires Guardian 4 CGM', 'Less accurate CGM', 'Complex menu system'],
      dimensions: {
        tubeless: false,
        touchscreen: false,
        smartphone_control: true,
        cgm_integration: ['guardian'],
        rechargeable: false,
        waterproof: true,
        automated_delivery: true,
        predictive_low_suspend: true,
        automatic_corrections: true,
        customizable_targets: false,
        exercise_mode: true,
        sleep_mode: false,
        ease_of_use: 6,
        data_visibility: 7,
        remote_monitoring: true,
        caregiver_access: true,
        reports_quality: 8,
        basal_increment: 0.025,
        bolus_increment: 0.025,
        max_basal_rate: 35,
        max_bolus: 25,
        insulin_duration: 4,
        target_range_customization: false,
      },
    },
    {
      name: 'DIY Loop',
      manufacturer: 'Open Source',
      ideal_for: ['engineers', 'high control', 'open source advocates', 'customization'],
      features: [
        'Fully customizable',
        'OpenAPS algorithm',
        'iPhone control',
        'Multiple CGM options',
      ],
      controllable_features: ['All pump settings', 'Algorithm parameters', 'Custom automation'],
      fixed_limitations: ['Not FDA approved', 'Requires technical setup', 'No official support'],
      dimensions: {
        tubeless: false,
        touchscreen: false,
        smartphone_control: true,
        cgm_integration: ['dexcom', 'freestyle', 'guardian'],
        rechargeable: false,
        waterproof: false,
        automated_delivery: true,
        predictive_low_suspend: true,
        automatic_corrections: true,
        customizable_targets: true,
        exercise_mode: true,
        sleep_mode: true,
        ease_of_use: 3,
        data_visibility: 10,
        remote_monitoring: true,
        caregiver_access: true,
        reports_quality: 10,
        basal_increment: 0.01,
        bolus_increment: 0.01,
        max_basal_rate: 30,
        max_bolus: 30,
        insulin_duration: 6,
        target_range_customization: true,
      },
    },
    {
      name: 'Ypsomed YpsoPump',
      manufacturer: 'Ypsomed',
      ideal_for: ['simplicity seekers', 'icon-based interface', 'small size'],
      features: ['Compact size', 'Icon-based menu', 'Bluetooth connectivity'],
      controllable_features: ['Basal rates', 'Bolus calculator', 'Temporary basal'],
      fixed_limitations: [
        'No automated delivery',
        'Limited CGM integration',
        'Basic features only',
      ],
      dimensions: {
        tubeless: false,
        touchscreen: true,
        smartphone_control: true,
        cgm_integration: ['dexcom'],
        rechargeable: false,
        waterproof: true,
        automated_delivery: false,
        predictive_low_suspend: false,
        automatic_corrections: false,
        customizable_targets: true,
        exercise_mode: false,
        sleep_mode: false,
        ease_of_use: 8,
        data_visibility: 6,
        remote_monitoring: false,
        caregiver_access: false,
        reports_quality: 5,
        basal_increment: 0.01,
        bolus_increment: 0.1,
        max_basal_rate: 40,
        max_bolus: 30,
        insulin_duration: 4,
        target_range_customization: true,
      },
    },
  ];

  // Calculate match score between patient and pump (0-100)
  calculateMatchScore(patient: PatientProfile, pump: PumpProfile): number {
    let score = 0;
    const weights = {
      critical: 20,
      important: 10,
      moderate: 5,
      minor: 2,
    };

    // Critical factors (20 points each)
    // CGM compatibility
    if (patient.cgm_use !== 'none' && pump.dimensions.cgm_integration.includes(patient.cgm_use)) {
      score += weights.critical;
    }

    // Age appropriateness
    if (patient.age < 18 && pump.ideal_for.includes('kids')) {
      score += weights.critical;
    } else if (patient.age >= 18 && pump.ideal_for.includes('adults')) {
      score += weights.critical;
    }

    // Hypoglycemia management
    if (patient.hypoglycemia_frequency === 'frequent' && pump.dimensions.predictive_low_suspend) {
      score += weights.critical;
    }

    // Important factors (10 points each)
    // Tech comfort match
    const techMatch = Math.abs(patient.tech_comfort - pump.dimensions.ease_of_use);
    score += weights.important * (1 - techMatch / 10);

    // Activity level
    if (patient.activity_level === 'very_active' && pump.dimensions.tubeless) {
      score += weights.important;
    }

    // Automation preference
    if (patient.priorities.includes('automation') && pump.dimensions.automated_delivery) {
      score += weights.important;
    }

    // Control preference
    if (patient.priorities.includes('control') && pump.dimensions.target_range_customization) {
      score += weights.important;
    }

    // Moderate factors (5 points each)
    // Smartphone preference
    if (pump.dimensions.smartphone_control) {
      score += weights.moderate;
    }

    // Waterproof for active users
    if (patient.activity_level !== 'sedentary' && pump.dimensions.waterproof) {
      score += weights.moderate;
    }

    // Exercise mode for active users
    if (patient.activity_level === 'active' || patient.activity_level === 'very_active') {
      if (pump.dimensions.exercise_mode) {
        score += weights.moderate;
      }
    }

    // Data visibility for engaged users
    if (patient.tech_comfort > 7) {
      score += weights.moderate * (pump.dimensions.data_visibility / 10);
    }

    // Minor factors (2 points each)
    // Sleep mode for shift workers
    if (patient.work_schedule === 'shift_work' && pump.dimensions.sleep_mode) {
      score += weights.minor;
    }

    // Remote monitoring for caregivers
    if (pump.dimensions.caregiver_access) {
      score += weights.minor;
    }

    // Normalize score to 0-100
    return Math.min(100, Math.round(score));
  }

  // Get pump recommendations for a patient
  recommendPumps(
    patient: PatientProfile
  ): Array<{ pump: PumpProfile; score: number; reasons: string[] }> {
    const recommendations = this.pumps.map(pump => {
      const score = this.calculateMatchScore(patient, pump);
      const reasons = this.getMatchReasons(patient, pump);
      return { pump, score, reasons };
    });

    // Sort by score (highest first)
    return recommendations.sort((a, b) => b.score - a.score);
  }

  // Get specific reasons why a pump matches
  private getMatchReasons(patient: PatientProfile, pump: PumpProfile): string[] {
    const reasons: string[] = [];

    if (patient.cgm_use !== 'none' && pump.dimensions.cgm_integration.includes(patient.cgm_use)) {
      reasons.push(`Compatible with your ${patient.cgm_use.toUpperCase()} CGM`);
    }

    if (patient.hypoglycemia_frequency === 'frequent' && pump.dimensions.predictive_low_suspend) {
      reasons.push('Excellent hypoglycemia prevention features');
    }

    if (patient.activity_level === 'very_active' && pump.dimensions.tubeless) {
      reasons.push('Tubeless design ideal for active lifestyle');
    }

    if (patient.priorities.includes('automation') && pump.dimensions.automated_delivery) {
      reasons.push('Advanced automation reduces daily management burden');
    }

    if (patient.priorities.includes('simplicity') && pump.dimensions.ease_of_use >= 8) {
      reasons.push('User-friendly interface');
    }

    if (pump.dimensions.smartphone_control && patient.smartphone_preference !== 'none') {
      reasons.push('Smartphone control available');
    }

    if (patient.diabetes_type === 'type1' && pump.dimensions.automatic_corrections) {
      reasons.push('Automatic correction boluses for better control');
    }

    return reasons;
  }

  // Compare two pumps
  comparePumps(pump1Name: string, pump2Name: string): any {
    const pump1 = this.pumps.find(p => p.name === pump1Name);
    const pump2 = this.pumps.find(p => p.name === pump2Name);

    if (!pump1 || !pump2) return null;

    return {
      pump1: pump1.name,
      pump2: pump2.name,
      comparison: {
        tubeless: {
          [pump1.name]: pump1.dimensions.tubeless,
          [pump2.name]: pump2.dimensions.tubeless,
        },
        automated_delivery: {
          [pump1.name]: pump1.dimensions.automated_delivery,
          [pump2.name]: pump2.dimensions.automated_delivery,
        },
        smartphone_control: {
          [pump1.name]: pump1.dimensions.smartphone_control,
          [pump2.name]: pump2.dimensions.smartphone_control,
        },
        ease_of_use: {
          [pump1.name]: pump1.dimensions.ease_of_use,
          [pump2.name]: pump2.dimensions.ease_of_use,
        },
        cgm_integration: {
          [pump1.name]: pump1.dimensions.cgm_integration,
          [pump2.name]: pump2.dimensions.cgm_integration,
        },
        max_basal_rate: {
          [pump1.name]: pump1.dimensions.max_basal_rate,
          [pump2.name]: pump2.dimensions.max_basal_rate,
        },
        exercise_mode: {
          [pump1.name]: pump1.dimensions.exercise_mode,
          [pump2.name]: pump2.dimensions.exercise_mode,
        },
      },
    };
  }

  // Get all available pumps
  getAllPumps(): PumpProfile[] {
    return this.pumps;
  }

  // Get pump by name
  getPumpByName(name: string): PumpProfile | undefined {
    return this.pumps.find(p => p.name === name);
  }
}

export const pumpMatchingEngine = new PumpMatchingEngine();
