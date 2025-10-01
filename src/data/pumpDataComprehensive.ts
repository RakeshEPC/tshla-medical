/**
 * Comprehensive Insulin Pump Database - 23 Dimensions
 * Based on detailed specifications document
 */

export interface ComprehensivePumpData {
  name: string;
  brand: string;
  weight: string;
  batteryLife: {
    type: string;
    details: string;
    chargingMethod: string;
  };
  phoneControl: {
    capability: string;
    details: string;
  };
  tubingStyle: {
    type: string;
    details: string;
  };
  automation: {
    algorithm: string;
    frequency: string;
    aggressiveness: string;
  };
  cgmCompatibility: string[];
  targetAdjustability: {
    flexibility: string;
    ranges: string;
  };
  exerciseModes: string;
  reservoirCapacity: string;
  waterResistance: {
    rating: string;
    details: string;
  };
  userInterface: string;
  discretion: {
    visibility: string;
    wearability: string;
  };
  cost: {
    coverage: string;
    type: string;
  };
  uniqueFeatures: string[];
}

export const COMPREHENSIVE_PUMP_DATABASE: ComprehensivePumpData[] = [
  {
    name: 'Twiist',
    brand: 'Beta Bionics',
    weight: '2 ounces', // LIGHTEST - Key differentiator
    batteryLife: {
      type: 'Rechargeable (new platform)',
      details: '4 replaceable batteries come with pump',
      chargingMethod: 'Charging station that charges 2 batteries at same time',
    },
    phoneControl: {
      capability: 'Phone-centric controls',
      details: 'Can bolus from APPLE watch and pump as well',
    },
    tubingStyle: {
      type: 'Tubed (compact)',
      details: 'Weighs 2 ounces - ultra-lightweight',
    },
    automation: {
      algorithm: 'Modern adaptive logic',
      frequency: 'Adjusts every 5 mins',
      aggressiveness: 'More aggressive: basal modulations similar to microboluses',
    },
    cgmCompatibility: ['Libre 3 Plus', 'Eversense (soon)', 'Dexcom (in future)'],
    targetAdjustability: {
      flexibility: 'Flexible targets (planned)',
      ranges: '87-180 mg/dL',
    },
    exerciseModes: 'Exercise modes (planned) 87-250 mg/dL',
    reservoirCapacity: '300 units',
    waterResistance: {
      rating: 'Water-resistant',
      details: 'Splash proof/water resistance - No submersible',
    },
    userInterface: 'Phone-forward UI - Phone app control only',
    discretion: {
      visibility: 'Compact design',
      wearability: 'Circular shape - discreet under clothes',
    },
    cost: {
      coverage: 'Pharmacy benefits',
      type: 'Confirm coverage',
    },
    uniqueFeatures: [
      'Apple Watch bolusing',
      'Only 2 ounces - lightest pump',
      'Emoji-based bolusing with food pictures',
      'Modern APIs planned',
      'Tidepool integration - up to 15 family/friends can follow',
    ],
  },
  {
    name: 'Omnipod 5',
    brand: 'Insulet',
    weight: 'Pod weight not specified',
    batteryLife: {
      type: 'Pod battery',
      details: 'Pod battery lasts wear cycle',
      chargingMethod: 'Disposable - no charging',
    },
    phoneControl: {
      capability: 'Phone or provided controller',
      details: 'Everything done through phone or PDM',
    },
    tubingStyle: {
      type: 'Tubeless pod',
      details: 'Low pod profile - Upper arm, thighs, on stomach',
    },
    automation: {
      algorithm: 'On-pod adapting algorithm',
      frequency: 'Adjusts basal insulin delivery every 5 minutes',
      aggressiveness: 'Continuously learns, uses CGM data to predict trends',
    },
    cgmCompatibility: ['Dexcom G6/G7', 'Libre 2 Plus'],
    targetAdjustability: {
      flexibility: 'Adjustable ranges; activity',
      ranges: 'Target 110-150 with exercise mode of 150',
    },
    exerciseModes: 'Activity feature - 150 mg/dL',
    reservoirCapacity: 'Up to 200 units',
    waterResistance: {
      rating: 'IP28',
      details: 'Submersible up to 8 feet for up to 60 mins',
    },
    userInterface: 'Phone APP or PDM only',
    discretion: {
      visibility: 'Single pod',
      wearability: 'Low pod profile',
    },
    cost: {
      coverage: 'Often pharmacy',
      type: 'Pharmacy benefits',
    },
    uniqueFeatures: [
      'Tubeless convenience',
      'Automated insulin delivery',
      'Waterproof for swimming',
      'No daily charging needed',
    ],
  },
  {
    name: 'Medtronic 780G',
    brand: 'Medtronic',
    weight: 'Standard pump weight (not specified)',
    batteryLife: {
      type: 'AA battery',
      details: 'Swap anywhere: Lithium preferred',
      chargingMethod: 'AA battery replacement',
    },
    phoneControl: {
      capability: 'App viewing; bolus on pump',
      details: 'Phone app for viewing: bolus on pump',
    },
    tubingStyle: {
      type: 'Tubed pump with set',
      details: '7-day or 2-3 day infusion sets, 2 different tubing lengths',
    },
    automation: {
      algorithm: 'SmartGuard + auto-corrections',
      frequency: 'More aggressive, every 5 mins',
      aggressiveness: '100% correction amount versus 60% like other pumps',
    },
    cgmCompatibility: ['Guardian 4 (phasing out)', 'Libre Instinct (Abbott integration coming)'],
    targetAdjustability: {
      flexibility: 'Limited adjustment',
      ranges: 'Target 100, 110, 120 - auto mode. Exercise target 150',
    },
    exerciseModes: 'Activity temp target - Exercise target 150',
    reservoirCapacity: '300 units - 2 different sets',
    waterResistance: {
      rating: 'Water-resistant',
      details: 'Submersible 12 feet for 24 hours (no cracks)',
    },
    userInterface: 'Buttons; onboard screen + MiniMed Mobile App',
    discretion: {
      visibility: 'Visible when clipped',
      wearability: 'Clip/holster; tubing',
    },
    cost: {
      coverage: 'DME; plan dependent',
      type: 'Financial assistance 90% if qualified',
    },
    uniqueFeatures: [
      'Most aggressive auto-corrections',
      'AA battery convenience',
      'High capacity reservoir',
      'Established ecosystem',
    ],
  },
  {
    name: 'Tandem t:slim X2',
    brand: 'Tandem',
    weight: 'Standard pump weight (not specified)',
    batteryLife: {
      type: 'Rechargeable; multi-day',
      details: 'Can last up to 3 weeks: charges 1% per min',
      chargingMethod: 'USB cord plug in to wall like cellphone',
    },
    phoneControl: {
      capability: 'Mobile bolus (compatibility varies)',
      details: 'Can bolus from phone app and pump - also quick bolus on pump',
    },
    tubingStyle: {
      type: 'Slim tubed pump',
      details: 'Clip/case option',
    },
    automation: {
      algorithm: 'Control-IQ basal + auto-correction',
      frequency: 'Automatically adjusts every 5 minutes',
      aggressiveness: '60% correction doses, aims for 110 mg/dL',
    },
    cgmCompatibility: ['Dexcom G6/G7', 'Libre 2 Plus', 'Libre 3 Plus (limited launch)'],
    targetAdjustability: {
      flexibility: 'Profiles, temp targets',
      ranges: '112.5-160 mg/dL with sleep mode 112.5-120 mg/dL',
    },
    exerciseModes: 'Exercise raises target - 140-160 mg/dL',
    reservoirCapacity: 'Up to 300 units',
    waterResistance: {
      rating: 'IP27',
      details: 'Not waterproof but adapt up to 3 feet for 30 mins',
    },
    userInterface: 'Touchscreen UI with quick bolus button',
    discretion: {
      visibility: 'Slim profile; tubing',
      wearability: 'Slim; tubing',
    },
    cost: {
      coverage: 'DME/pharmacy varies',
      type: 'DME/Pharmacy',
    },
    uniqueFeatures: [
      'Touchscreen interface',
      'Long battery life',
      'Broad CGM compatibility',
      'Pump loaner program for travel',
    ],
  },
  {
    name: 'Tandem Mobi',
    brand: 'Tandem',
    weight: 'Very small form factor',
    batteryLife: {
      type: 'Rechargeable micro; pad charging',
      details: 'Can last up to 3 weeks: charges 1% per min',
      chargingMethod: 'Charging plate',
    },
    phoneControl: {
      capability: 'App on phone (iPhone only for now)',
      details: 'Quick bolus on pump - everything done through phone',
    },
    tubingStyle: {
      type: 'Very short tube near site',
      details: 'Short or long tubing - clip on belt, slip in pocket, or adhesive sleeve',
    },
    automation: {
      algorithm: 'Runs Control-IQ like t:slim',
      frequency: 'Every 5 minutes',
      aggressiveness: 'Standard Control-IQ behavior',
    },
    cgmCompatibility: ['Dexcom G6/G7 only'],
    targetAdjustability: {
      flexibility: 'CIQ targets via app',
      ranges: '112.5-160 mg/dL standard, 112.5-120 sleep, 140-160 exercise',
    },
    exerciseModes: 'CIQ exercise mode - 140-160 mg/dL',
    reservoirCapacity: 'Up to 200 units',
    waterResistance: {
      rating: 'IP28',
      details: 'Submersible up to 8 feet for up to 60 mins',
    },
    userInterface: 'Phone-first UI with quick bolus button on pump',
    discretion: {
      visibility: 'Very small on body',
      wearability: 'Belt buckle size - clip it, slip in pocket',
    },
    cost: {
      coverage: 'Confirm coverage',
      type: 'DME/Pharmacy',
    },
    uniqueFeatures: [
      'Smallest tubed pump form factor',
      'Phone-centric control',
      'Ultra-discreet wearing',
      'Improved water resistance',
    ],
  },
  {
    name: 'Beta Bionics iLet',
    brand: 'Beta Bionics',
    weight: 'Business card size',
    batteryLife: {
      type: 'Rechargeable; top-offs',
      details: 'Charge 15 mins a day / can go 3 days without charge',
      chargingMethod: 'Inductive charging plate: place pump on top',
    },
    phoneControl: {
      capability: 'View/share on phone; dose on pump',
      details: 'Cannot bolus from phone - have to use pump only',
    },
    tubingStyle: {
      type: 'Tubed, simple sets',
      details: '10 mm length only',
    },
    automation: {
      algorithm: 'Meal-announce simplicity',
      frequency: 'Auto-corrections every 5 mins',
      aggressiveness: 'No carb counting - 2 glucose readings predictions',
    },
    cgmCompatibility: ['Dexcom G6/G7', 'Libre 3 Plus'],
    targetAdjustability: {
      flexibility: 'Simplified targets',
      ranges: 'Low usual: 70-120, High usual: 80-130, Lower: 60-110',
    },
    exerciseModes: 'Simple activity toggle - disconnect for aerobic, stay connected for anaerobic',
    reservoirCapacity: '160 prefilled Fiasp or 180 standard',
    waterResistance: {
      rating: 'Water-resistant',
      details: 'Water submersible 12 feet up to 30 mins',
    },
    userInterface: 'Minimalist prompts - Touchscreen pump',
    discretion: {
      visibility: 'Traditional profile',
      wearability: 'Size of business card - can slip in pocket',
    },
    cost: {
      coverage: 'Check plan specifics',
      type: 'Pharmacy benefits if qualified, DME/traditional, Medicare pharmacy',
    },
    uniqueFeatures: [
      'No carb counting required',
      'Meal announcement system',
      'Simplified operation',
      'Multiple coverage options',
    ],
  },
];

// Helper function to find pump by name
export const findPumpByName = (name: string): ComprehensivePumpData | undefined => {
  return COMPREHENSIVE_PUMP_DATABASE.find(pump =>
    pump.name.toLowerCase().includes(name.toLowerCase())
  );
};

// Weight comparison helper
export const getPumpsByWeight = (): ComprehensivePumpData[] => {
  return COMPREHENSIVE_PUMP_DATABASE.sort((a, b) => {
    // Twiist has specific weight, others don't
    if (a.name === 'Twiist') return -1;
    if (b.name === 'Twiist') return 1;
    return 0;
  });
};
