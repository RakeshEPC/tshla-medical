// Complete pump data extracted from PDF with all 23 dimensions
// Including new pump: Twiist (6 pumps total)

export interface PumpDetails {
  id: string;
  name: string;
  manufacturer: string;
  pros?: string[];
  cons?: string[];
  idealFor?: string[];
  dimensions: {
    // Simple fields for display
    battery?: string;
    batteryDetails?: string;
    phoneControl?: string;
    phoneControlDetails?: string;
    tubingStyle?: string;
    tubingDetails?: string;
    algorithm?: string;
    algorithmDetails?: string;
    cgmCompatibility?: string;
    cgmDetails?: string;
    targetAdjustability?: string;
    targetDetails?: string;
    exerciseMode?: string;
    exerciseDetails?: string;
    bolusWorkflow?: string;
    bolusDetails?: string;
    reservoirCapacity?: string;
    reservoirDetails?: string;
    adhesiveTolerance?: string;
    waterResistance?: string;
    waterDetails?: string;
    alertsCustomization?: string;
    alertsDetails?: string;
    userInterface?: string;
    uiDetails?: string;
    dataSharing?: string;
    dataSharingDetails?: string;
    clinicSupport?: string;
    travelLogistics?: string;
    travelDetails?: string;
    caregiverFeatures?: string;
    caregiverDetails?: string;
    wearability?: string;
    wearabilityDetails?: string;
    ecosystem?: string;
    ecosystemDetails?: string;
    occlusionHandling?: string;
    occlusionDetails?: string;
    costInsurance?: string;
    costDetails?: string;
    updates?: string;
    updatesDetails?: string;

    // Detailed fields (keeping for future use)
    batteryInfo?: {
      type: 'AA' | 'rechargeable' | 'pod-integrated' | 'replaceable';
      details: string;
      chargingMethod?: string;
      batteryLife?: string;
    };

    // #2 Phone control & app
    phoneControl: {
      bolusFromPhone: boolean;
      viewOnly: boolean;
      phoneRequired: boolean;
      appleWatch?: boolean;
      details: string;
    };

    // #3 Tubing preference & wear style
    tubing: {
      type: 'tubed' | 'short-tube' | 'tubeless';
      details: string;
      wearOptions?: string;
    };

    // #4 Automation behavior (algorithm)
    algorithm: {
      type: string;
      adjustmentFrequency: string;
      aggressiveness: 'conservative' | 'moderate' | 'aggressive';
      carbCounting: boolean;
      details: string;
    };

    // #5 CGM compatibility & gaps
    cgmCompatibility: {
      compatible: string[];
      future?: string[];
      phoneAppRequired?: boolean;
      details: string;
    };

    // #6 Target adjustability
    targetAdjustability: {
      customizable: boolean;
      ranges: string;
      exerciseMode?: string;
      sleepMode?: boolean;
      details: string;
    };

    // #7 Exercise modes
    exerciseMode: {
      available: boolean;
      targetRange?: string;
      type?: string;
      details: string;
    };

    // #8 Manual bolus workflow
    bolusWorkflow: {
      carbCounting: 'required' | 'optional' | 'not-required';
      mealAnnouncement?: boolean;
      customFoods?: boolean;
      emojiBased?: boolean;
      details: string;
    };

    // #9 Reservoir/pod capacity
    capacity: {
      units: number;
      changeFrequency: string;
      details: string;
    };

    // #10 Adhesive & site tolerance
    adhesive: {
      type: 'separate-set' | 'pod-integrated';
      wearTime?: string;
      details: string;
    };

    // #11 Water resistance
    waterResistance: {
      rating: string;
      submersible: boolean;
      depth?: string;
      duration?: string;
      details: string;
    };

    // #12 Alerts & alarms customization
    alerts: {
      customizable: boolean;
      silenceable: boolean;
      vibrate?: boolean;
      details: string;
    };

    // #13 User interface & screen
    interface: {
      type: 'touchscreen' | 'buttons' | 'phone-only';
      onPumpControl: boolean;
      details: string;
    };

    // #14 Data sharing & reports
    dataSharing: {
      platform: string;
      app?: string;
      shareWithCaregivers: boolean;
      details: string;
    };

    // #15 Clinic support & training
    clinicSupport: {
      established: 'large' | 'broad' | 'growing' | 'new';
      trainingAvailable: boolean;
      details: string;
    };

    // #16 Travel & airport logistics
    travel: {
      supplies: string;
      loanerProgram?: boolean;
      details: string;
    };

    // #17 Pediatric & caregiver features
    pediatric: {
      remoteMonitoring: boolean;
      remoteBolus: boolean;
      app?: string;
      details: string;
    };

    // #18 Visual discretion & wearability
    discretion: {
      size: 'compact' | 'standard' | 'small';
      visibility: 'low' | 'moderate' | 'visible';
      details: string;
    };

    // #19 Ecosystem & accessories
    ecosystem: {
      watchSupport: boolean;
      watchBolus?: boolean;
      integrations: string[];
      details: string;
    };

    // #20 Reliability & occlusion handling
    reliability: {
      occlusionDetection: boolean;
      alertMethod: string;
      details: string;
    };

    // #21 Cost & insurance fit
    cost: {
      coverage: 'DME' | 'pharmacy' | 'both';
      financialAssistance?: string;
      details: string;
    };

    // #22 On-body visibility & comfort (duplicate of #18, merged)
    // #23 Support apps & updates
    updates: {
      automatic: boolean;
      method: string;
      details: string;
    };
  };
}

export const PUMP_DATABASE: PumpDetails[] = [
  {
    id: 'medtronic-780g',
    name: 'Medtronic 780G',
    manufacturer: 'Medtronic',
    pros: [
      'AA battery - swap anywhere',
      'Most aggressive algorithm',
      'Large capacity (300 units)',
      'Submersible 12 feet',
    ],
    cons: ['Phone viewing only', 'Complex menu system', 'Changing CGM system', 'No remote bolus'],
    idealFor: ['Heavy insulin users', 'Aggressive control seekers', 'Established pump users'],
    dimensions: {
      battery: {
        type: 'AA',
        details: 'AA battery; swap anywhere; Lithium preferred',
        batteryLife: 'Varies with usage',
      },
      phoneControl: {
        bolusFromPhone: false,
        viewOnly: true,
        phoneRequired: false,
        appleWatch: false,
        details: 'Phone app for viewing; bolus on pump only',
      },
      tubing: {
        type: 'tubed',
        details:
          'Tubed pump with set. Option 1: 7 day infusion set holds 600 units. Option 2: 5 different sets plus 2 different tubing lengths',
        wearOptions: 'Clip/holster',
      },
      algorithm: {
        type: 'SmartGuard - MOST AGGRESSIVE',
        adjustmentFrequency: 'Every 5 minutes',
        aggressiveness: 'most aggressive',
        carbCounting: true,
        details: 'MOST AGGRESSIVE algorithm: 100% correction amount versus 60% like other pumps - unmatched aggressiveness',
      },
      cgmCompatibility: {
        compatible: ['Guardian 4'],
        future: ['Libre Instinct (Abbott) - coming in 2-3 months'],
        details: 'Guardian 4 (phasing out in 2-3 months), will change to Libre Instinct',
      },
      targetAdjustability: {
        customizable: false,
        ranges: 'Target 100, 110, 120 - auto mode',
        exerciseMode: '150',
        sleepMode: false,
        details: 'Limited adjustment. Exercise target 150 - can be switched on or off anytime',
      },
      exerciseMode: {
        available: true,
        targetRange: '150',
        details: 'Exercise target 150 - can be switched on or off anytime',
      },
      bolusWorkflow: {
        carbCounting: 'optional',
        details: 'Can set carbs, exact carbs, or rely on autocorrect',
      },
      capacity: {
        units: 300,
        changeFrequency: 'Every 7 days or 2-3 days depending on dosage',
        details:
          '300 units; 2 diff sets. Option 1: set change every 7 days or another set every 2-3 days',
      },
      adhesive: {
        type: 'separate-set',
        wearTime: '7 days',
        details: '1 click insertion; Guardian 4 overlay tape - Libre will be 15 day wear in future',
      },
      waterResistance: {
        rating: 'IPX8',
        submersible: true,
        depth: '12 feet',
        duration: '24 hours',
        details: 'Submersible 12 feet for 24 hours as long as pump does not have a crack',
      },
      alerts: {
        customizable: true,
        silenceable: false,
        details:
          'Set high alerts on 30 minutes increments; can adjust during sleep; alert before lows occur',
      },
      interface: {
        type: 'buttons',
        onPumpControl: true,
        details: 'Buttons; onboard screen; MiniMed Mobile App on phone',
      },
      dataSharing: {
        platform: 'CareLink',
        shareWithCaregivers: true,
        details: 'CareLink cloud',
      },
      clinicSupport: {
        established: 'large',
        trainingAvailable: true,
        details: 'Large installed base',
      },
      travel: {
        supplies: 'AA spares; DME supplies - insulin',
        details: 'AA spares; DME supplies',
      },
      pediatric: {
        remoteMonitoring: true,
        remoteBolus: false,
        app: 'Care Partner',
        details:
          'Care partner app - caregiver/parents can get alarms; parents can get notified when child boluses, but cannot give remote bolus',
      },
      discretion: {
        size: 'standard',
        visibility: 'visible',
        details: 'Visible when clipped',
      },
      ecosystem: {
        watchSupport: true,
        watchBolus: false,
        integrations: ['Apple Watch (view only)'],
        details:
          'MiniMed mobile: can view on phone and sync to Apple Watch but cannot bolus - have to bolus thru pump',
      },
      reliability: {
        occlusionDetection: true,
        alertMethod: 'On-pump alerts/logs',
        details:
          'When occlusion occurs patient changes site - insulin does not have to be changed. Unplug from site and start again',
      },
      cost: {
        coverage: 'DME',
        financialAssistance: '90% if qualified',
        details: 'DME; plan dependent - Financial assistance 90% if qualified',
      },
      updates: {
        automatic: false,
        method: 'App updates; software update if changing pumps',
        details: 'Updates on app - software update if user changing pumps',
      },
    },
  },
  {
    id: 't-slim-x2',
    name: 't:slim X2',
    manufacturer: 'Tandem',
    pros: [
      'Touchscreen interface',
      'Rechargeable battery',
      'Control-IQ algorithm',
      'Multiple CGM options',
      'Loaner program for travel',
    ],
    cons: ['Not fully waterproof', 'Daily charging needed', 'Tubing required'],
    idealFor: ['Tech-comfortable users', 'Data-focused patients', 'Tight control seekers'],
    dimensions: {
      battery: {
        type: 'rechargeable',
        details:
          'Rechargeable; multi-day. Can last up to 3 weeks; charges 1% per min - recommend to charge daily',
        chargingMethod: 'Cord plug in to wall like cellphone; USB',
        batteryLife: 'Up to 3 weeks',
      },
      phoneControl: {
        bolusFromPhone: true,
        viewOnly: false,
        phoneRequired: false,
        appleWatch: false,
        details: 'Can bolus from phone app and the pump - also quick bolus on pump',
      },
      tubing: {
        type: 'tubed',
        details: 'Slim tubed pump; clip/case option',
        wearOptions: 'Clip/case options',
      },
      algorithm: {
        type: 'Control-IQ',
        adjustmentFrequency: 'Every 5 minutes',
        aggressiveness: 'moderate',
        carbCounting: true,
        details:
          'Control-IQ basal + auto-corr; automatically adjusts basal insulin every 5 minutes based on real-time and predicted glucose data from CGM',
      },
      cgmCompatibility: {
        compatible: ['Dexcom G6', 'Dexcom G7', 'Libre 2 Plus'],
        future: ['Libre 3 Plus (limited launch coming soon)'],
        details: 'Dexcom G6/G7, Libre 2 Plus, Libre 3 Plus (limited launch coming soon)',
      },
      targetAdjustability: {
        customizable: true,
        ranges: 'Target range: 112.5-160 mg/dL',
        exerciseMode: '140-160 mg/dL',
        sleepMode: true,
        details:
          'Profiles, temp targets. Correction boluses triggered if glucose predicted >180 mg/dL, aim for 110 mg/dL, but only give 60% of full correction dose. Sleep mode to keep target lower',
      },
      exerciseMode: {
        available: true,
        targetRange: '140-160 mg/dL',
        details: 'Exercise raises target 140-160 mg/dL',
      },
      bolusWorkflow: {
        carbCounting: 'optional',
        details: 'Actual carb counting, set carbs, or rely on autocorrect',
      },
      capacity: {
        units: 300,
        changeFrequency: 'Every 2-3 days',
        details: 'Up to 300 units',
      },
      adhesive: {
        type: 'separate-set',
        details: 'Set + separate CGM',
      },
      waterResistance: {
        rating: 'IP27',
        submersible: false,
        depth: '3 feet',
        duration: '30 mins',
        details:
          'Not submersible - water rating IP27 - not waterproof but adapt up to 3 feet for 30 mins',
      },
      alerts: {
        customizable: true,
        silenceable: true,
        details: 'Multiple options of alerts',
      },
      interface: {
        type: 'touchscreen',
        onPumpControl: true,
        details: 'Touchscreen UI; quick bolus button',
      },
      dataSharing: {
        platform: 't:connect',
        app: 'Tandem Source',
        shareWithCaregivers: true,
        details: 't:connect web/app; Tslim app Platform: Tandem Source',
      },
      clinicSupport: {
        established: 'broad',
        trainingAvailable: true,
        details: 'Broad familiarity',
      },
      travel: {
        supplies: 'Charger; DME supplies',
        loanerProgram: true,
        details:
          'Charging cable, all supplies - option of having a pump loaner program: can get pump to take when traveling outside US 48 states as backup - have to sign up for program - no cost',
      },
      pediatric: {
        remoteMonitoring: true,
        remoteBolus: true,
        app: 'Tandem Source',
        details: 'Remote bolus (compat) - Tandem Source',
      },
      discretion: {
        size: 'compact',
        visibility: 'moderate',
        details: 'Slim profile; tubing',
      },
      ecosystem: {
        watchSupport: true,
        watchBolus: false,
        integrations: ['Apple Watch (view only)'],
        details:
          'Apps + watch. View on phone only - can get notified on watch but have to bolus from pump',
      },
      reliability: {
        occlusionDetection: true,
        alertMethod: 'Detection + t:connect',
        details: 'App or pump notifies',
      },
      cost: {
        coverage: 'both',
        details: 'DME/pharmacy varies',
      },
      updates: {
        automatic: false,
        method: 'App and pump updates',
        details:
          'App updates and pump updates - sent notifications via email or on app - rep can help',
      },
    },
  },
  {
    id: 'tandem-mobi',
    name: 'Tandem Mobi',
    manufacturer: 'Tandem',
    pros: [
      'Very small size',
      'Short tubing',
      'Phone control (iPhone)',
      'Waterproof IP28',
      'Wireless charging plate',
    ],
    cons: ['iPhone only currently', 'Smaller capacity (200 units)', 'Dexcom only'],
    idealFor: ['Discreet wearing', 'Active lifestyles', 'iPhone users'],
    dimensions: {
      battery: {
        type: 'rechargeable',
        details:
          'Rechargeable micro; pad charging. Can last up to 3 weeks; charges 1% per min - recommend to charge daily',
        chargingMethod: 'Charging plate',
        batteryLife: 'Up to 3 weeks',
      },
      phoneControl: {
        bolusFromPhone: true,
        viewOnly: false,
        phoneRequired: true,
        details: 'App on phone (iPhone only for now) - quick bolus on pump',
      },
      tubing: {
        type: 'short-tube',
        details:
          'Very short tube near site. Option of short or long tubing sizes vary depending on patient preference: clip it on belt, slip in pocket, or adhesive sleeve patch to wear on body',
        wearOptions: 'Belt buckle, clip it, slip it in pocket',
      },
      algorithm: {
        type: 'Control-IQ',
        adjustmentFrequency: 'Every 5 minutes',
        aggressiveness: 'moderate',
        carbCounting: true,
        details: 'Runs Control-IQ like t:slim',
      },
      cgmCompatibility: {
        compatible: ['Dexcom G6', 'Dexcom G7'],
        details: 'Dexcom G6/G7 only',
      },
      targetAdjustability: {
        customizable: true,
        ranges: 'Standard (Default): 112.5-160 mg/dL',
        exerciseMode: '140-160 mg/dL',
        sleepMode: true,
        details:
          'CIQ targets via app. Sleep Mode: 112.5-120 mg/dL. AutoBolus triggers if glucose predicted >180 mg/dL, aiming for ~110 mg/dL with 60% of calculated dose',
      },
      exerciseMode: {
        available: true,
        targetRange: '140-160 mg/dL',
        details: 'CIQ exercise mode 140-160 mg/dL',
      },
      bolusWorkflow: {
        carbCounting: 'optional',
        details: 'App-based carb entry; actual carb counting, set carbs, or rely on autocorrect',
      },
      capacity: {
        units: 200,
        changeFrequency: 'Every 2-3 days',
        details: 'Smaller reservoir: up to 200 units',
      },
      adhesive: {
        type: 'separate-set',
        details: 'Small device near site',
      },
      waterResistance: {
        rating: 'IP28',
        submersible: true,
        depth: '8 feet',
        duration: '60 mins',
        details: 'Water rating IP28: submersible up to 8 feet for up to 60 mins',
      },
      alerts: {
        customizable: true,
        silenceable: true,
        details: 'Multiple options of alerts',
      },
      interface: {
        type: 'phone-only',
        onPumpControl: false,
        details: 'Phone-first UI; quick bolus button on pump - rest control thru iPhone app',
      },
      dataSharing: {
        platform: 't:connect',
        app: 'Mobi app',
        shareWithCaregivers: true,
        details: 't:connect (Mobi); Mobi app',
      },
      clinicSupport: {
        established: 'growing',
        trainingAvailable: true,
        details: 'Newer; Tandem support',
      },
      travel: {
        supplies: 'Pad charger; micro-supplies',
        details: 'Pad charger; micro-supplies',
      },
      pediatric: {
        remoteMonitoring: true,
        remoteBolus: true,
        app: 'Tandem Source',
        details: 'Phone control helps; Tandem Source',
      },
      discretion: {
        size: 'small',
        visibility: 'low',
        details: 'Very small on body',
      },
      ecosystem: {
        watchSupport: false,
        integrations: ['iPhone app'],
        details: 'Accessory-friendly. Everything done thru phone',
      },
      reliability: {
        occlusionDetection: true,
        alertMethod: 'App notifications',
        details: 'App or pump notifies',
      },
      cost: {
        coverage: 'both',
        details: 'DME/Pharmacy; Confirm coverage',
      },
      updates: {
        automatic: false,
        method: 'Phone-first updates',
        details:
          'App updates and pump updates - sent notifications via email or on app - rep can help',
      },
    },
  },
  {
    id: 'omnipod-5',
    name: 'Omnipod 5',
    manufacturer: 'Insulet',
    pros: [
      'No tubing',
      'Waterproof',
      'Phone or controller',
      'Automated delivery',
      'Discreet wearing',
    ],
    cons: ['Pod changes every 3 days', 'Limited capacity (200 units)', 'Larger profile on body'],
    idealFor: ['Active lifestyles', 'Water activities', 'Needle phobic', 'Kids'],
    dimensions: {
      battery: {
        type: 'pod-integrated',
        details: 'Pod battery lasts wear cycle',
        batteryLife: '3 days (pod wear time)',
      },
      phoneControl: {
        bolusFromPhone: true,
        viewOnly: false,
        phoneRequired: false,
        details: 'Phone or provided controller',
      },
      tubing: {
        type: 'tubeless',
        details: 'Tubeless pod',
        wearOptions: 'Upper arm, thighs, stomach',
      },
      algorithm: {
        type: 'On-pod adapting algorithm',
        adjustmentFrequency: 'Every 5 minutes',
        aggressiveness: 'moderate',
        carbCounting: true,
        details:
          'Continuously learns how your body responds to insulin, adjusts basal insulin delivery every 5 minutes, uses CGM data to predict future glucose trends',
      },
      cgmCompatibility: {
        compatible: ['Dexcom G6', 'Dexcom G7', 'Libre 2 Plus'],
        phoneAppRequired: true,
        details:
          'Dexcom G6/G7 - need compatible phone app updated iOS/Android, Libre 2 Plus (can use Omnipod PDM if phone app for Libre 2 Plus not compatible)',
      },
      targetAdjustability: {
        customizable: true,
        ranges: 'Target 110-150',
        exerciseMode: '150',
        details: 'Adjustable ranges; activity. Target 110-150 with exercise mode of 150',
      },
      exerciseMode: {
        available: true,
        targetRange: '150',
        details: 'Activity feature 150',
      },
      bolusWorkflow: {
        carbCounting: 'required',
        customFoods: true,
        details: 'Carb dosing + automation; actual carb counting, set carbs (custom foods)',
      },
      capacity: {
        units: 200,
        changeFrequency: 'Every 3 days',
        details: 'Fixed pod capacity. Up to 200 units',
      },
      adhesive: {
        type: 'pod-integrated',
        wearTime: '3 days',
        details: 'Pod + CGM patch',
      },
      waterResistance: {
        rating: 'IP28',
        submersible: true,
        depth: '8 feet',
        duration: '60 mins',
        details: 'Water rating IP28: submersible up to 8 feet for up to 60 mins',
      },
      alerts: {
        customizable: true,
        silenceable: false,
        details:
          'High and low alert alarms - Sound control but not alerts can be silenced - especially urgent lows',
      },
      interface: {
        type: 'phone-only',
        onPumpControl: false,
        details: 'Phone or controller - phone APP or PDM only',
      },
      dataSharing: {
        platform: 'Glooko',
        shareWithCaregivers: true,
        details: 'App/cloud reports. Glooko',
      },
      clinicSupport: {
        established: 'broad',
        trainingAvailable: true,
        details: 'Widely used',
      },
      travel: {
        supplies: 'Extra pods; no charger',
        details: 'Extra pods; no charger. Insulin, CGM extra',
      },
      pediatric: {
        remoteMonitoring: true,
        remoteBolus: false,
        app: 'Omnipod View',
        details: 'Controller/phone + share. Omnipod view app',
      },
      discretion: {
        size: 'compact',
        visibility: 'low',
        details: 'Low pod profile - Upper arm, thighs, on stomach',
      },
      ecosystem: {
        watchSupport: false,
        integrations: ['Phone app', 'PDM controller'],
        details: 'Mobile + controller. Everything done thru phone or PDM',
      },
      reliability: {
        occlusionDetection: true,
        alertMethod: 'Pod alerts',
        details: 'Replace pod if needed',
      },
      cost: {
        coverage: 'pharmacy',
        details: 'Often pharmacy - pharmacy benefits',
      },
      updates: {
        automatic: false,
        method: 'App/controller updates',
        details: 'App/controller updates',
      },
    },
  },
  {
    id: 'beta-bionics-ilet',
    name: 'Beta Bionics iLet',
    manufacturer: 'Beta Bionics',
    pros: ['No carb counting', 'Simple meal announcements', 'Minimal alerts', 'Inductive charging'],
    cons: ['No phone bolusing', 'Limited customization', 'Fixed tubing length (10mm)'],
    idealFor: ['Simplicity seekers', 'No carb counting desired', 'Minimal interaction'],
    dimensions: {
      battery: {
        type: 'rechargeable',
        details: 'Rechargeable; top-offs - charge 15 mins a day/can go 3 days without charge',
        chargingMethod: 'Inductive charging plate: place pump on top of charging plate',
        batteryLife: '3 days',
      },
      phoneControl: {
        bolusFromPhone: false,
        viewOnly: true,
        phoneRequired: false,
        details:
          'View/share on phone; dose on pump. Cannot bolus from phone - have to use pump only',
      },
      tubing: {
        type: 'tubed',
        details: 'Tubed, simple sets. 10 mm length only',
        wearOptions: 'Size of business card - can slip in pocket',
      },
      algorithm: {
        type: 'Meal-announce simplicity',
        adjustmentFrequency: 'Every 5 minutes',
        aggressiveness: 'moderate',
        carbCounting: false,
        details:
          'No carb counting required: carb awareness required - non-user autocorrections every 5 mins. "2 glucose readings predictions initiated" - analyzes current and recent CGM readings and trends to forecast glucose levels',
      },
      cgmCompatibility: {
        compatible: ['Dexcom G6', 'Dexcom G7', 'Libre 3 Plus'],
        details: 'Dexcom G6/G7/Libre 3 Plus',
      },
      targetAdjustability: {
        customizable: false,
        ranges: 'Multiple targets: low usual: 70-120, high usual: 80-130, lower than usual: 60-110',
        details: 'Simplified targets. Multiple targets but no fine-tuning',
      },
      exerciseMode: {
        available: true,
        type: 'aerobic/anaerobic',
        details:
          'Simple activity toggle: No target options: aerobic exercise: disconnect - take pump off; anaerobic: stay connected to pump',
      },
      bolusWorkflow: {
        carbCounting: 'not-required',
        mealAnnouncement: true,
        details:
          'Meal announcements instead - no carb counting - announce meals with preset carbs - ex: small, medium, or large meals',
      },
      capacity: {
        units: 180,
        changeFrequency: 'Every 2-3 days',
        details: 'Standard capacity. 1. 160 prefilled Fiasp 2. 180 standard',
      },
      adhesive: {
        type: 'separate-set',
        details: 'Set + separate CGM; same as other pumps, same infusion set as Tandem',
      },
      waterResistance: {
        rating: 'IPX8',
        submersible: true,
        depth: '12 feet',
        duration: '30 mins',
        details: 'Water-resistant. Water submersible 12 feet up to 30 mins',
      },
      alerts: {
        customizable: false,
        silenceable: false,
        details: 'Essential alerts. Alerts less - only 4 minimal essential alerts',
      },
      interface: {
        type: 'touchscreen',
        onPumpControl: true,
        details: 'Minimalist prompts. Touchscreen pump',
      },
      dataSharing: {
        platform: 'Beta Bionics',
        app: 'Bionic Circle',
        shareWithCaregivers: true,
        details: 'BB reporting. Bionic circle app',
      },
      clinicSupport: {
        established: 'growing',
        trainingAvailable: true,
        details: 'Growing support',
      },
      travel: {
        supplies: 'Charger; DME supplies',
        details: 'Charger; DME supplies',
      },
      pediatric: {
        remoteMonitoring: true,
        remoteBolus: false,
        app: 'Bionic Circle',
        details: 'Simplified interaction. Bionic circle app',
      },
      discretion: {
        size: 'standard',
        visibility: 'moderate',
        details: 'Traditional profile. Size of business card - can slip in pocket',
      },
      ecosystem: {
        watchSupport: false,
        watchBolus: false,
        integrations: ['Bionic Circle app'],
        details: 'Growing ecosystem. No watch or phone bolus - only on pump',
      },
      reliability: {
        occlusionDetection: true,
        alertMethod: 'Device alerts',
        details:
          'Occlusion suspected if high glucose has been alerted for 90 mins - then pump advises to change tubing',
      },
      cost: {
        coverage: 'both',
        financialAssistance: 'Fully covered if qualified',
        details:
          'Check plan specifics. 1. Pharmacy benefits if patient qualifies fully covered with shipments and supplies 2. DME/traditional insurance 3. Pharmacy benefits for medicare patients - no labs required',
      },
      updates: {
        automatic: false,
        method: 'BB tools - patient initiated',
        details: 'Not automatic - patient has to initiate when notified',
      },
    },
  },
  {
    id: 'twiist',
    name: 'Twiist',
    manufacturer: 'Sequel Med Tech',
    pros: [
      'Apple Watch bolusing',
      'Multiple battery system',
      'Emoji-based bolusing',
      'Very lightweight (2 oz)',
    ],
    cons: ['New platform', 'Not submersible', 'Limited availability'],
    idealFor: ['Tech enthusiasts', 'Apple Watch users', 'Modern interface seekers'],
    dimensions: {
      weight: '2 oz',
      battery: {
        type: 'replaceable',
        details:
          'Rechargeable (new platform). 4 replaceable batteries come with pump plus a charging station that charges 2 batteries at same time',
        chargingMethod: 'Charging station for 2 batteries',
        batteryLife: 'Replaceable batteries',
      },
      phoneControl: {
        bolusFromPhone: true,
        viewOnly: false,
        phoneRequired: true,
        appleWatch: true,
        details: 'Phone-centric controls. Can bolus from APPLE watch and pump as well',
      },
      tubing: {
        type: 'tubed',
        details: 'Tubed (compact). Weighs 2 ounces',
        wearOptions: 'Circular shape - discreet under clothes',
      },
      algorithm: {
        type: 'Most aggressive with microbolusing',
        adjustmentFrequency: 'Every 5 minutes',
        aggressiveness: 'most aggressive',
        carbCounting: true,
        details: 'Adjusts every 5 mins: MOST AGGRESSIVE with basal modulations similar to microboluses - aggressive insulin delivery',
      },
      cgmCompatibility: {
        compatible: ['Libre 3 Plus'],
        future: ['Eversense (soon)', 'Dexcom (in future)'],
        details: 'Libre 3 Plus, Eversense (soon), Dexcom (in future)',
      },
      targetAdjustability: {
        customizable: true,
        ranges: '87-180',
        exerciseMode: '87-250',
        details: 'LOWEST TARGET: 87 mg/dL - most aggressive targeting available. Flexible targets 87-180',
      },
      exerciseMode: {
        available: true,
        targetRange: '87-250',
        details: 'Exercise modes (planned). 87-250',
      },
      bolusWorkflow: {
        carbCounting: 'optional',
        emojiBased: true,
        details:
          'Streamlined bolus. Exact carb number or can use emojis with pics which can be used based on absorption time of the specific meal',
      },
      capacity: {
        units: 300,
        changeFrequency: 'Every 2-3 days',
        details: 'Competitive capacity. 300 units',
      },
      adhesive: {
        type: 'separate-set',
        details: 'Set + separate CGM',
      },
      waterResistance: {
        rating: 'Splash proof',
        submersible: false,
        details: 'Water-resistant. Splash proof/water resistance/ No submersible',
      },
      alerts: {
        customizable: true,
        silenceable: false,
        vibrate: true,
        details:
          'Modern alert set. Vibrate mode can be active most of the time but urgent alerts will ring',
      },
      interface: {
        type: 'phone-only',
        onPumpControl: false,
        details: 'Phone-forward UI. Phone app control only',
      },
      dataSharing: {
        platform: 'Tidepool',
        shareWithCaregivers: true,
        details: 'Cloud/app pipeline. Tidepool - up to 15 family/friends can follow',
      },
      clinicSupport: {
        established: 'new',
        trainingAvailable: false,
        details: 'New platform',
      },
      travel: {
        supplies: 'Charger; DME supplies',
        details: 'Charger; DME supplies - insulin, extra cassettes, pump itself with tubes',
      },
      pediatric: {
        remoteMonitoring: true,
        remoteBolus: false,
        app: 'Twiist Insight',
        details: 'Caregiver app planned. Twiist insight app',
      },
      discretion: {
        size: 'compact',
        visibility: 'low',
        details: 'Compact design. Circular shape - discreet under clothes',
      },
      ecosystem: {
        watchSupport: true,
        watchBolus: true,
        integrations: ['Apple Watch', 'Tidepool'],
        details: 'Modern APIs planned. Can bolus on Apple watch',
      },
      reliability: {
        occlusionDetection: true,
        alertMethod: 'On-device + app alerts',
        details: 'On-device + app alerts',
      },
      cost: {
        coverage: 'pharmacy',
        details: 'Confirm coverage. Pharmacy benefits',
      },
      updates: {
        automatic: true,
        method: 'OTA app support',
        details: 'OTA app support. Updates during cassette changes if need to update firmware',
      },
    },
  },
];

// Export pump names for easy reference
export const PUMP_NAMES = PUMP_DATABASE.map(p => p.name);

// Export contacts from PDF
export const PUMP_CONTACTS = {
  'Beta Bionics iLet': 'Katherine',
  Twiist: 'Brittney B',
  'Omnipod 5': 'Celeste',
  't:slim X2': 'Meghan',
  'Tandem Mobi': 'Meghan',
  'Medtronic 780G': 'Bobby/Laura',
};
