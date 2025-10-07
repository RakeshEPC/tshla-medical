const PUMP_DIMENSIONS = [
  {
    dimension_number: 1,
    dimension_name: 'Battery life & power',
    dimension_description: 'Battery strategy changes daily life: some rely on AA swaps, others on quick top-offs or wireless pads, and pod systems bundle a battery into each disposable. Think about your routine—long days, travel, sports—and whether carrying a spare battery or keeping a charger nearby feels easier.',
    importance_scale: '1-10',
    category: 'Power & Charging',
    display_order: 1,
    pump_details: {
      'Medtronic 780G': {
        title: 'AA battery; swap anywhere',
        details: 'Lithium preferred. Easy to swap anytime, anywhere.',
        pros: ['No charging needed', 'Easy to find replacement batteries', 'Great for travel'],
        cons: ['Need to carry spare batteries', 'Environmental waste']
      },
      'Tandem t:slim X2': {
        title: 'Rechargeable; multi-day',
        details: 'Can last up to 3 weeks. Charges 1% per minute. USB cord plug in to wall like cellphone. Recommend to charge daily.',
        pros: ['Long battery life', 'Fast charging', 'Standard USB cable'],
        cons: ['Must remember to charge', 'Need charger when traveling']
      },
      'Tandem Mobi': {
        title: 'Rechargeable micro; pad charging',
        details: 'Can last up to 3 weeks. Charges 1% per minute. Recommend to charge daily. Wireless charging plate.',
        pros: ['Wireless charging', 'Long battery life', 'Fast charging'],
        cons: ['Need charging plate', 'Smaller capacity than t:slim']
      },
      'Omnipod 5': {
        title: 'Pod battery lasts wear cycle',
        details: 'Battery integrated into disposable pod. No charging needed.',
        pros: ['No charging ever', 'No cables or chargers', 'Always fresh battery'],
        cons: ['Cannot extend battery life', 'Waste with each pod']
      },
      'Beta Bionics iLet': {
        title: 'Rechargeable; top-offs',
        details: 'Charge 15 mins a day or can go 3 days without charge. Inductive charging plate - place pump on top of charging plate.',
        pros: ['Quick 15-min top-offs', '3-day battery life', 'Wireless charging'],
        cons: ['Need charging plate', 'Proprietary charger']
      },
      'Twiist': {
        title: 'Rechargeable (new platform)',
        details: '4 replaceable batteries come with pump plus a charging station that charges 2 batteries at same time.',
        pros: ['Replaceable battery system', 'Charges 2 batteries simultaneously', 'Never without power'],
        cons: ['Need to manage multiple batteries', 'More parts to track']
      }
    }
  },
  {
    dimension_number: 2,
    dimension_name: 'Phone control & app',
    dimension_description: 'Some pumps let you bolus entirely from your phone; others use the phone for viewing and keep dosing on the pump. Consider how often your phone is with you, whether you want full app control, and what happens if the phone is left behind—does automation continue the same way?',
    importance_scale: '1-10',
    category: 'Controls & Interface',
    display_order: 2,
    pump_details: {
      'Medtronic 780G': {
        title: 'App viewing; bolus on pump',
        details: 'Phone app for viewing only. Must bolus on pump itself.',
        pros: ['View data on phone', 'Automation continues without phone'],
        cons: ['Cannot bolus from phone', 'Limited app functionality']
      },
      'Tandem t:slim X2': {
        title: 'Mobile bolus (compat varies)',
        details: 'Can bolus from phone app and the pump. Also quick bolus button on pump.',
        pros: ['Bolus from phone or pump', 'Quick bolus button', 'Flexible control'],
        cons: ['Phone compatibility varies', 'App required for phone bolusing']
      },
      'Tandem Mobi': {
        title: 'App on phone (iPhone only for now)',
        details: 'Full app control on iPhone. Quick bolus button on pump.',
        pros: ['Complete phone control', 'Quick bolus on pump', 'Modern app interface'],
        cons: ['iPhone only currently', 'Requires phone nearby for full control']
      },
      'Omnipod 5': {
        title: 'Phone or provided controller',
        details: 'Can use phone app OR dedicated PDM controller.',
        pros: ['Choice of phone or controller', 'Works without phone', 'Both iOS and Android'],
        cons: ['Two devices to manage', 'PDM may feel outdated']
      },
      'Beta Bionics iLet': {
        title: 'View/share on phone; dose on pump',
        details: 'Cannot bolus from phone - have to use pump only. Phone for viewing and sharing data.',
        pros: ['View and share data', 'Simple pump-only dosing'],
        cons: ['Cannot dose from phone', 'Limited app functionality']
      },
      'Twiist': {
        title: 'Phone-centric controls',
        details: 'Can bolus from Apple Watch and pump as well. Full phone integration.',
        pros: ['Apple Watch bolusing', 'Pump and phone control', 'Modern ecosystem'],
        cons: ['Requires iPhone and potentially Apple Watch', 'More complex setup']
      }
    }
  },
  {
    dimension_number: 3,
    dimension_name: 'Tubing preference & wear style',
    dimension_description: 'Pick what fits your wardrobe and activities: traditional tubed pumps (clip/holster), a very short-tube micro-pump near the site, or a tubeless pod adhered to the skin. Picture sleep, workouts, and clothing—what will feel invisible vs. annoying?',
    importance_scale: '1-10',
    category: 'Design & Wearability',
    display_order: 3,
    pump_details: {
      'Medtronic 780G': {
        title: 'Tubed pump with set',
        details: 'Option 1: 7 day infusion set holds 600 units depending on dosage. Option 2: 5 different sets plus 2 different tubing lengths.',
        pros: ['Multiple infusion set options', '7-day wear time', 'High capacity'],
        cons: ['Tubing can catch on things', 'Bulkier design', 'Visible when clipped']
      },
      'Tandem t:slim X2': {
        title: 'Slim tubed pump',
        details: 'Clip or case option. Slim profile compared to other tubed pumps.',
        pros: ['Slimmer design', 'Clip options', 'Familiar tubed format'],
        cons: ['Still has tubing', 'Needs clip or holster', 'Visible']
      },
      'Tandem Mobi': {
        title: 'Very short tube near site',
        details: 'Option of short or long tubing sizes depending on preference. Clip it on belt, slip in pocket, or adhesive sleeve patch to wear on body.',
        pros: ['Very small pump', 'Short tubing option', 'Wear on body patch', 'Pocket-friendly'],
        cons: ['Still has tubing', 'Smaller than tubeless']
      },
      'Omnipod 5': {
        title: 'Tubeless pod',
        details: 'No tubing at all. Pod adheres to upper arm, thighs, or stomach.',
        pros: ['Zero tubing', 'Complete freedom', 'Multiple wear sites', 'Invisible under clothes'],
        cons: ['Pod is visible when placed', 'Adhesive sensitivity', 'Larger than Mobi']
      },
      'Beta Bionics iLet': {
        title: 'Tubed, simple sets',
        details: '10mm length only. Standard tubed design.',
        pros: ['Simple infusion set', 'Traditional format'],
        cons: ['Limited length options', 'Has tubing', 'Size of business card']
      },
      'Twiist': {
        title: 'Tubed (compact)',
        details: 'Weighs only 2 ounces. Circular shape - discreet under clothes.',
        pros: ['Lightest pump', 'Compact circular design', 'Discreet'],
        cons: ['Still has tubing', 'Newer design may feel unfamiliar']
      }
    }
  }
];

// Add remaining 20 dimensions (4-23) - continuing from dimension 3
const REMAINING_DIMENSIONS = [
  {
    dimension_number: 4,
    dimension_name: 'Automation behavior (algorithm)',
    dimension_description: 'Automation ranges from aggressive auto-corrections to simpler, guided styles. Decide whether you want a system that constantly nudges numbers or one that keeps things steady with fewer moves. "More active" isn\'t always "better"—it should match your comfort and goals.',
    importance_scale: '1-10',
    category: 'Smart Automation',
    display_order: 4,
    pump_details: {
      'Medtronic 780G': {
        title: 'SmartGuard + auto-corrections',
        details: 'More aggressive, every 5 mins. 100% correction amount versus 60% like other pumps.',
        pros: ['Most aggressive control', 'Frequent adjustments', 'Tight glucose management'],
        cons: ['Can feel like too much intervention', 'More active algorithm']
      },
      'Tandem t:slim X2': {
        title: 'Control-IQ basal + auto-corr',
        details: 'Automatically adjusts basal insulin every 5 minutes based on real-time and predicted glucose data from CGM.',
        pros: ['Predictive adjustments', 'Balanced approach', 'Well-tested algorithm'],
        cons: ['60% correction doses (less aggressive)', 'Requires CGM']
      },
      'Tandem Mobi': {
        title: 'Runs Control-IQ like t:slim',
        details: 'Same Control-IQ algorithm as t:slim X2.',
        pros: ['Same proven algorithm', '5-minute adjustments', 'Predictive'],
        cons: ['Same 60% corrections', 'Less aggressive than Medtronic']
      },
      'Omnipod 5': {
        title: 'On-pod adapting algorithm',
        details: 'Continuously learns how your body responds to insulin. Adjusts basal every 5 minutes. Uses CGM data to predict future glucose trends.',
        pros: ['Learns your patterns', 'Adaptive algorithm', '5-min adjustments'],
        cons: ['Learning period required', 'Prediction dependent on CGM']
      },
      'Beta Bionics iLet': {
        title: 'Meal-announce simplicity',
        details: 'No carb counting required - carb awareness required. Auto-corrections every 5 mins. 2 glucose readings predictions initiated.',
        pros: ['No carb counting', 'Simple meal announcements', 'Automated dosing'],
        cons: ['Less precise than carb counting', 'Requires meal awareness']
      },
      'Twiist': {
        title: 'Modern adaptive logic',
        details: 'Adjusts every 5 mins. More aggressive. Basal modulations similar to microboluses.',
        pros: ['Modern algorithm', 'Aggressive control', 'Micro-dosing approach'],
        cons: ['Newer algorithm with less real-world data', 'Very active']
      }
    }
  },
  {
    dimension_number: 5,
    dimension_name: 'CGM compatibility & gaps',
    dimension_description: 'Integration varies by model/region. Consider the CGM you use, pairing reliability, warm-up periods, and how the pump behaves during brief signal loss—does it hold steady or change behavior?',
    importance_scale: '1-10',
    category: 'Integration',
    display_order: 5,
    pump_details: {
      'Medtronic 780G': {
        title: 'Medtronic CGM',
        details: 'Guardian 4 (will be phasing out in 2-3 months) - will change to Libre Instinct (Abbott will make for Medtronic integration).',
        pros: ['Integrated ecosystem', 'Future Libre compatibility'],
        cons: ['Guardian 4 being discontinued', 'Limited CGM options currently']
      },
      'Tandem t:slim X2': {
        title: 'Dexcom (model/region)',
        details: 'Dexcom G6/G7, Libre 2 Plus, Libre 3 Plus (limited launch coming soon).',
        pros: ['Multiple CGM options', 'Dexcom G7 compatible', 'Libre coming'],
        cons: ['Region-specific compatibility', 'Not all Libre models yet']
      },
      'Tandem Mobi': {
        title: 'Dexcom (model/region)',
        details: 'Dexcom G6/G7 only.',
        pros: ['Works with latest Dexcom', 'Reliable pairing'],
        cons: ['Dexcom only', 'No Libre compatibility']
      },
      'Omnipod 5': {
        title: 'Dexcom',
        details: 'Dexcom G6/G7 - need compatible phone app (updated iOS/Android). Libre 2 Plus (can use Omnipod PDM if phone app for Libre 2 Plus not compatible).',
        pros: ['Dexcom and Libre options', 'PDM fallback option'],
        cons: ['Phone compatibility matters', 'App requirements']
      },
      'Beta Bionics iLet': {
        title: 'Dexcom (model/region)',
        details: 'Dexcom G6/G7/Libre 3 Plus.',
        pros: ['Multiple CGM options', 'Latest Dexcom and Libre'],
        cons: ['Regional variations', 'Specific models only']
      },
      'Twiist': {
        title: 'Dexcom plans (anticipated)',
        details: 'Libre 3 Plus, Eversense (soon), Dexcom (in future).',
        pros: ['Future Dexcom planned', 'Eversense compatibility coming', 'Libre 3 Plus'],
        cons: ['Dexcom not available yet', 'Limited current options']
      }
    }
  }
];

// Complete the array by adding dimensions 6-23
const ALL_DIMENSIONS = [...PUMP_DIMENSIONS, ...REMAINING_DIMENSIONS, ...[
  {
    dimension_number: 6,
    dimension_name: 'Target adjustability',
    dimension_description: 'How much do you like to tweak? Some systems keep targets simple; others let you fine-tune profiles and temporary goals. If your routine is variable, flexibility might matter more.',
    importance_scale: '1-10',
    category: 'Customization',
    display_order: 6,
    pump_details: {
      'Medtronic 780G': {
        title: 'Limited adjustment',
        details: 'Target 100, 110, 120 in auto mode. Exercise target 150 - can be switched on or off anytime.',
        pros: ['Simple options', 'Exercise mode', 'Easy to understand'],
        cons: ['Limited target choices', 'Less customizable']
      },
      'Tandem t:slim X2': {
        title: 'Profiles, temp targets',
        details: 'Target range: 112.5-160 mg/dL. Correction boluses triggered if glucose predicted >180. Aims for 110, but only 60% dose. Sleep mode to keep target lower.',
        pros: ['Multiple profiles', 'Sleep mode', 'Temporary targets'],
        cons: ['Complex to set up initially']
      },
      'Tandem Mobi': {
        title: 'CIQ targets via app',
        details: 'Standard: 112.5-160. Sleep Mode: 112.5-120. Exercise Mode: 140-160. AutoBolus triggers if >180, aiming for ~110 with 60% dose.',
        pros: ['App-based control', 'Multiple modes', 'Easy switching'],
        cons: ['Requires phone for adjustments']
      },
      'Omnipod 5': {
        title: 'Adjustable ranges; activity',
        details: 'Target 110-150 with exercise mode of 150.',
        pros: ['Adjustable ranges', 'Exercise mode', 'Simple interface'],
        cons: ['Fewer options than Tandem']
      },
      'Beta Bionics iLet': {
        title: 'Simplified targets',
        details: 'Multiple targets: low usual (70-120), high usual (80-130), lower than usual (60-110).',
        pros: ['Simple naming', 'Multiple preset ranges', 'Easy to understand'],
        cons: ['Cannot set custom targets', 'Less precise']
      },
      'Twiist': {
        title: 'Flexible targets (planned)',
        details: 'Range: 87-180 mg/dL.',
        pros: ['Wide range flexibility', 'Modern approach'],
        cons: ['May be too flexible for some', 'Newer system']
      }
    }
  },
  {
    dimension_number: 7,
    dimension_name: 'Exercise modes',
    dimension_description: 'Active people benefit from easy pre-exercise targets and smarter behavior during and after workouts. Think about how quickly you can toggle into activity mode and whether it fits your sports.',
    importance_scale: '1-10',
    category: 'Lifestyle Features',
    display_order: 7,
    pump_details: {
      'Medtronic 780G': {
        title: 'Activity temp target',
        details: 'Exercise target 150 - can be switched on or off anytime.',
        pros: ['Quick toggle', '150 target', 'Easy on/off'],
        cons: ['Only one exercise target option']
      },
      'Tandem t:slim X2': {
        title: 'Exercise raises target',
        details: '140-160 mg/dL.',
        pros: ['Dedicated exercise mode', 'Range targeting'],
        cons: ['Manual activation required']
      },
      'Tandem Mobi': {
        title: 'CIQ exercise mode',
        details: '140-160 mg/dL.',
        pros: ['Same as t:slim', 'App-based activation'],
        cons: ['Need phone to activate']
      },
      'Omnipod 5': {
        title: 'Activity feature',
        details: 'Target 150.',
        pros: ['Simple 150 target', 'Easy activation'],
        cons: ['Single target only']
      },
      'Beta Bionics iLet': {
        title: 'Simple activity toggle',
        details: 'No target options. Aerobic exercise: disconnect/take pump off. Anaerobic: stay connected to pump.',
        pros: ['Simple approach', 'Guidance provided'],
        cons: ['May need to disconnect pump', 'No target customization']
      },
      'Twiist': {
        title: 'Exercise modes (planned)',
        details: 'Range: 87-250 mg/dL.',
        pros: ['Wide range', 'Flexible'],
        cons: ['Very new feature', 'Wide range may not suit everyone']
      }
    }
  },
  {
    dimension_number: 8,
    dimension_name: 'Manual bolus workflow',
    dimension_description: 'Do you prefer classic carb counting and precise math—or a simpler, guided style with fewer steps? Pick what you\'ll actually use under pressure (restaurants, meetings, practice).',
    importance_scale: '1-10',
    category: 'Daily Convenience',
    display_order: 8,
    pump_details: {
      'Medtronic 780G': {
        title: 'Carb + auto-corr support',
        details: 'Can set carbs, exact carbs, or rely on autocorrect.',
        pros: ['Flexible options', 'Carb counting or auto', 'Simple'],
        cons: ['Buttons-based entry']
      },
      'Tandem t:slim X2': {
        title: 'Carb + auto-corr bolus',
        details: 'Actual carb counting, set carbs, or rely on autocorrect.',
        pros: ['Touchscreen entry', 'Calculator', 'Quick bolus button'],
        cons: ['Requires carb knowledge']
      },
      'Tandem Mobi': {
        title: 'App-based carb entry',
        details: 'Actual carb counting, set carbs, or rely on autocorrect.',
        pros: ['Phone entry', 'Calculator', 'Quick bolus on pump'],
        cons: ['Need phone for detailed entry']
      },
      'Omnipod 5': {
        title: 'Carb dosing + automation',
        details: 'Actual carb counting, set carbs (custom foods).',
        pros: ['Custom food library', 'Flexible entry'],
        cons: ['Requires carb counting']
      },
      'Beta Bionics iLet': {
        title: 'Meal announcements instead',
        details: 'No carb counting - announce meals with preset carbs - ex: small, medium, or large meals.',
        pros: ['No carb counting', 'Simple meal sizes', 'Less mental math'],
        cons: ['Less precise', 'Meal awareness still needed']
      },
      'Twiist': {
        title: 'Streamlined bolus',
        details: 'Exact carb number or can use emojis with pics which can be used based on absorption time of specific meal.',
        pros: ['Emoji interface', 'Fun and simple', 'Absorption time aware'],
        cons: ['Newer approach', 'May feel less precise']
      }
    }
  },
  {
    dimension_number: 9,
    dimension_name: 'Reservoir/pod capacity',
    dimension_description: 'Higher capacity means fewer changes; smaller can be lighter but needs more frequent refills. Match typical insulin use with how often you want to swap pods/sets.',
    importance_scale: '1-10',
    category: 'Maintenance',
    display_order: 9,
    pump_details: {
      'Medtronic 780G': {
        title: 'High capacity',
        details: '300 units. 2 different sets. Options: 1 set change every 7 days or another set every 2-3 days depending on dosage.',
        pros: ['High capacity', '7-day option', 'Less frequent changes'],
        cons: ['Insulin waste if changed early']
      },
      'Tandem t:slim X2': {
        title: 'High capacity',
        details: 'Up to 300 units.',
        pros: ['300 unit capacity', 'Fewer refills'],
        cons: ['Standard reservoir changes']
      },
      'Tandem Mobi': {
        title: 'Smaller reservoir',
        details: 'Up to 200 units.',
        pros: ['Smaller size enables compact pump', 'Sufficient for most'],
        cons: ['More frequent refills for high insulin needs']
      },
      'Omnipod 5': {
        title: 'Fixed pod capacity',
        details: 'Up to 200 units.',
        pros: ['Pre-filled', 'Integrated design'],
        cons: ['Cannot extend beyond 200', 'Waste if changed early']
      },
      'Beta Bionics iLet': {
        title: 'Standard capacity',
        details: '1. 160 prefilled Fiasp, 2. 180 standard.',
        pros: ['Prefilled option', 'Two sizes'],
        cons: ['Lower capacity than others', 'More frequent changes']
      },
      'Twiist': {
        title: 'Competitive capacity',
        details: '300 units.',
        pros: ['High capacity', 'Fewer changes'],
        cons: ['Cartridge-based system']
      }
    }
  },
  {
    dimension_number: 10,
    dimension_name: 'Adhesive & site tolerance',
    dimension_description: 'Skin sensitivity, sweat, and climate can affect adhesion and comfort. Tubed pumps use a set plus CGM adhesive; pods combine pump + infusion into one patch.',
    importance_scale: '1-10',
    category: 'Comfort',
    display_order: 10,
    pump_details: {
      'Medtronic 780G': {
        title: 'Set + separate CGM',
        details: '1 click insertion. Guardian 4 overlay tape - Libre will be 15 day wear in future.',
        pros: ['1-click insertion', 'Separate adhesives', 'Future 15-day wear'],
        cons: ['Two adhesive sites']
      },
      'Tandem t:slim X2': {
        title: 'Set + separate CGM',
        details: 'Standard infusion set with separate CGM.',
        pros: ['Choice of infusion sets', 'Separate from CGM'],
        cons: ['Two adhesive sites']
      },
      'Tandem Mobi': {
        title: 'Small device near site',
        details: 'Mini pump near infusion site.',
        pros: ['Small adhesive area', 'Less skin contact than pod'],
        cons: ['Still need infusion set adhesive']
      },
      'Omnipod 5': {
        title: 'Pod + CGM patch',
        details: 'Pod adhesive plus separate CGM adhesive.',
        pros: ['Integrated pod design'],
        cons: ['Larger pod adhesive', 'Two separate adhesive areas']
      },
      'Beta Bionics iLet': {
        title: 'Set + separate CGM',
        details: 'Same as other pumps, same infusion set as Tandem.',
        pros: ['Standard infusion set', 'Compatible with Tandem sets'],
        cons: ['Two adhesive sites']
      },
      'Twiist': {
        title: 'Set + separate CGM',
        details: 'Standard infusion set approach.',
        pros: ['Standard approach', 'Separate from CGM'],
        cons: ['Two adhesive sites']
      }
    }
  },
  {
    dimension_number: 11,
    dimension_name: 'Water resistance',
    dimension_description: 'If you swim or sweat heavily, check water guidance for showers, pools, and submersion. Also consider convenience of tubing in water.',
    importance_scale: '1-10',
    category: 'Durability',
    display_order: 11,
    pump_details: {
      'Medtronic 780G': {
        title: 'Water-resistant',
        details: 'Submersible 12 feet for 24 hours as long as pump does not have a crack.',
        pros: ['Best water resistance', '12 feet depth', '24 hours'],
        cons: ['Must check for cracks']
      },
      'Tandem t:slim X2': {
        title: 'Resistant (follow guide)',
        details: 'Not submersible - water rating IP27 - not waterproof but adapt up to 3 feet for 30 mins.',
        pros: ['Shower safe', 'Brief water exposure OK'],
        cons: ['Cannot swim with it', 'Must disconnect for swimming']
      },
      'Tandem Mobi': {
        title: 'Improved resistance',
        details: 'Water rating IP28: submersible up to 8 feet for up to 60 mins.',
        pros: ['Can swim with it', '8 feet depth', '60 minutes'],
        cons: ['Less than Medtronic']
      },
      'Omnipod 5': {
        title: 'Rated within limits',
        details: 'Water rating IP28: submersible up to 8 feet for up to 60 mins.',
        pros: ['Swim without disconnecting', 'No tubing in water', '8 feet depth'],
        cons: ['60 min limit']
      },
      'Beta Bionics iLet': {
        title: 'Water-resistant',
        details: 'Water submersible 12 feet up to 30 mins.',
        pros: ['Deep submersion', '12 feet'],
        cons: ['Only 30 minutes']
      },
      'Twiist': {
        title: 'Water-resistant',
        details: 'Splash proof/water resistance. No submersible.',
        pros: ['Splash proof'],
        cons: ['Cannot swim with it', 'Must disconnect for water activities']
      }
    }
  },
  {
    dimension_number: 12,
    dimension_name: 'Alerts & alarms customization',
    dimension_description: 'Control over volume, vibration, and frequency can reduce alarm fatigue while keeping you safe. Look for the level of tuning you want.',
    importance_scale: '1-10',
    category: 'User Experience',
    display_order: 12,
    pump_details: {
      'Medtronic 780G': {
        title: 'On-pump options',
        details: 'Set high alerts on 30 minutes increments and can adjust during sleep - alert before lows occur.',
        pros: ['Predictive low alerts', 'Customizable timing', 'Sleep adjustments'],
        cons: ['Pump-based only']
      },
      'Tandem t:slim X2': {
        title: 'Pump + app options',
        details: 'Multiple options of alerts.',
        pros: ['Highly customizable', 'App and pump alerts'],
        cons: ['Can be overwhelming to set up']
      },
      'Tandem Mobi': {
        title: 'App-centric notices',
        details: 'Multiple options of alerts.',
        pros: ['Phone-based', 'Customizable', 'Modern interface'],
        cons: ['Requires phone']
      },
      'Omnipod 5': {
        title: 'Phone/controller alerts',
        details: 'High and low alert alarms - Sound control but not alerts can be silenced - especially urgent lows.',
        pros: ['Phone or controller', 'Safety-focused', 'Urgent lows cannot be silenced'],
        cons: ['Less customization']
      },
      'Beta Bionics iLet': {
        title: 'Essential alerts',
        details: 'Alerts less - only 4 minimal essential alerts.',
        pros: ['Minimal alarm fatigue', 'Simple', 'Less intrusive'],
        cons: ['Limited customization', 'May miss some events']
      },
      'Twiist': {
        title: 'Modern alert set',
        details: 'Vibrate mode can be active most of the time but urgent alerts will ring.',
        pros: ['Smart vibration', 'Urgent override', 'Modern approach'],
        cons: ['Newer system']
      }
    }
  },
  {
    dimension_number: 13,
    dimension_name: 'User interface & screen',
    dimension_description: 'Touchscreen, buttons, or phone-first—pick what you\'ll enjoy daily. Readability and one-hand use matter more than you\'d think.',
    importance_scale: '1-10',
    category: 'Controls & Interface',
    display_order: 13,
    pump_details: {
      'Medtronic 780G': {
        title: 'Buttons; onboard screen',
        details: 'MiniMed Mobile App on phone.',
        pros: ['Button controls', 'Tactile feedback', 'Works without looking'],
        cons: ['No touchscreen', 'Older interface style']
      },
      'Tandem t:slim X2': {
        title: 'Touchscreen UI',
        details: 'Quick bolus button.',
        pros: ['Modern touchscreen', 'Intuitive', 'Quick bolus button'],
        cons: ['Screen can be hard to use when wet']
      },
      'Tandem Mobi': {
        title: 'Phone-first UI',
        details: 'Quick bolus button on pump - rest control through iPhone app.',
        pros: ['Modern app interface', 'Large phone screen', 'Quick bolus on pump'],
        cons: ['Requires phone for most functions']
      },
      'Omnipod 5': {
        title: 'Phone or controller',
        details: 'Phone app or PDM only.',
        pros: ['Choice of interface', 'Modern app', 'PDM backup'],
        cons: ['PDM feels dated', 'Two options to learn']
      },
      'Beta Bionics iLet': {
        title: 'Minimalist prompts',
        details: 'Touchscreen pump.',
        pros: ['Simple touchscreen', 'Minimal options', 'Easy to learn'],
        cons: ['Very basic interface']
      },
      'Twiist': {
        title: 'Phone-forward UI',
        details: 'Phone app control only.',
        pros: ['Modern phone interface', 'Large screen', 'Familiar'],
        cons: ['Requires phone always']
      }
    }
  },
  {
    dimension_number: 14,
    dimension_name: 'Data sharing & reports',
    dimension_description: 'If you share data with family/clinic, check how uploading and viewing works, and whether the reports match how you think.',
    importance_scale: '1-10',
    category: 'Data & Connectivity',
    display_order: 14,
    pump_details: {
      'Medtronic 780G': {
        title: 'CareLink cloud',
        details: 'CareLink web platform.',
        pros: ['Established platform', 'Clinic integration'],
        cons: ['Older interface', 'Manual upload sometimes']
      },
      'Tandem t:slim X2': {
        title: 't:connect web/app',
        details: 'Tandem Source Platform.',
        pros: ['Modern platform', 'Automatic upload', 'Good reports'],
        cons: ['Tandem-specific']
      },
      'Tandem Mobi': {
        title: 't:connect (Mobi)',
        details: 'Mobi app.',
        pros: ['Same as t:slim', 'Automatic sync'],
        cons: ['Requires phone']
      },
      'Omnipod 5': {
        title: 'App/cloud reports',
        details: 'Glooko.',
        pros: ['Glooko integration', 'Multi-device platform'],
        cons: ['Third-party platform']
      },
      'Beta Bionics iLet': {
        title: 'BB reporting',
        details: 'Bionic Circle app.',
        pros: ['Integrated reporting', 'Simple interface'],
        cons: ['Proprietary platform']
      },
      'Twiist': {
        title: 'Cloud/app pipeline',
        details: 'Tidepool - up to 15 family/friends can follow.',
        pros: ['Tidepool integration', '15 followers', 'Open platform'],
        cons: ['Newer integration']
      }
    }
  },
  {
    dimension_number: 15,
    dimension_name: 'Clinic support & training',
    dimension_description: 'Local familiarity speeds onboarding and troubleshooting. If you\'re new to automation, a strong training program is priceless.',
    importance_scale: '1-10',
    category: 'Support',
    display_order: 15,
    pump_details: {
      'Medtronic 780G': {
        title: 'Large installed base',
        details: 'Supportive reps/trainers.',
        pros: ['Wide support network', 'Experienced reps', 'Many clinics familiar'],
        cons: ['Large company - less personal']
      },
      'Tandem t:slim X2': {
        title: 'Broad familiarity',
        details: 'Supportive reps/trainers.',
        pros: ['Popular pump', 'Good training', 'Many clinics know it'],
        cons: []
      },
      'Tandem Mobi': {
        title: 'Newer; Tandem support',
        details: 'Supportive reps/trainers.',
        pros: ['Tandem support network', 'Growing familiarity'],
        cons: ['Newer so less clinic experience']
      },
      'Omnipod 5': {
        title: 'Widely used',
        details: 'Supportive reps/trainers.',
        pros: ['Very popular', 'Strong training program', 'Wide support'],
        cons: []
      },
      'Beta Bionics iLet': {
        title: 'Growing support',
        details: 'Supportive reps/trainers.',
        pros: ['Dedicated team', 'Newer approach'],
        cons: ['Smaller support network', 'Fewer clinics experienced']
      },
      'Twiist': {
        title: 'New platform',
        details: 'Supportive reps/trainers.',
        pros: ['Dedicated support'],
        cons: ['Very new', 'Limited clinic experience']
      }
    }
  },
  {
    dimension_number: 16,
    dimension_name: 'Travel & airport logistics',
    dimension_description: 'Pack lists differ: AA batteries vs chargers vs extra pods. Consider airport screening advice and how easy it is to stay powered on long trips.',
    importance_scale: '1-10',
    category: 'Lifestyle Features',
    display_order: 16,
    pump_details: {
      'Medtronic 780G': {
        title: 'AA spares; DME supplies',
        details: 'Insulin, spare AA batteries.',
        pros: ['Easy to find batteries anywhere', 'No charger needed'],
        cons: ['Must pack batteries', 'More items']
      },
      'Tandem t:slim X2': {
        title: 'Charger; DME supplies',
        details: 'Charging cable, all supplies. Option of pump loaner program - can get backup pump when traveling outside US 48 states (sign up required, no cost).',
        pros: ['Loaner pump program', 'Standard USB', 'Backup available'],
        cons: ['Must pack charger']
      },
      'Tandem Mobi': {
        title: 'Pad charger; micro-supplies',
        details: 'Charging plate.',
        pros: ['Compact supplies', 'Wireless charger'],
        cons: ['Proprietary charging plate']
      },
      'Omnipod 5': {
        title: 'Extra pods; no charger',
        details: 'Insulin, CGM extra.',
        pros: ['No charger', 'Simple pack list'],
        cons: ['Must pack enough pods', 'Bulkier supplies']
      },
      'Beta Bionics iLet': {
        title: 'Charger; DME supplies',
        details: 'Charging plate.',
        pros: ['Simple packing'],
        cons: ['Proprietary charger']
      },
      'Twiist': {
        title: 'Charger; DME supplies',
        details: 'Insulin, extra cartridges, pump itself with tubes.',
        pros: ['Battery charging station'],
        cons: ['More items to pack']
      }
    }
  },
  {
    dimension_number: 17,
    dimension_name: 'Pediatric & caregiver features',
    dimension_description: 'If a caregiver helps, remote viewing/bolus and a simplified workflow can be huge. Consider what will reduce friction for your team.',
    importance_scale: '1-10',
    category: 'Family Features',
    display_order: 17,
    pump_details: {
      'Medtronic 780G': {
        title: 'Caregiver-friendly options',
        details: 'Care partner app - caregiver/parents can get alarms. Parents can get notified when a child boluses, but cannot give remote bolus to patient.',
        pros: ['Caregiver app', 'Notifications', 'Alerts'],
        cons: ['No remote bolusing']
      },
      'Tandem t:slim X2': {
        title: 'Remote bolus (compat)',
        details: 'Tandem Source.',
        pros: ['Remote bolus capability', 'Tandem Source platform'],
        cons: ['Compatibility varies']
      },
      'Tandem Mobi': {
        title: 'Phone control helps',
        details: 'Tandem Source.',
        pros: ['Phone-based', 'Remote capabilities'],
        cons: ['Requires phone']
      },
      'Omnipod 5': {
        title: 'Controller/phone + share',
        details: 'Omnipod View app.',
        pros: ['View app', 'Phone or controller', 'Easy sharing'],
        cons: ['No remote bolusing']
      },
      'Beta Bionics iLet': {
        title: 'Simplified interaction',
        details: 'Bionic Circle app.',
        pros: ['Simple for kids', 'Easy to understand'],
        cons: ['Limited remote features']
      },
      'Twiist': {
        title: 'Caregiver app planned',
        details: 'Twiist Insight app.',
        pros: ['Dedicated caregiver app'],
        cons: ['Still in development']
      }
    }
  },
  {
    dimension_number: 18,
    dimension_name: 'Visual discretion & wearability',
    dimension_description: 'Look at size, clips, and clothing. Decide whether a discreet pod or a compact pump with short tube feels best for your lifestyle.',
    importance_scale: '1-10',
    category: 'Design & Wearability',
    display_order: 18,
    pump_details: {
      'Medtronic 780G': {
        title: 'Visible when clipped',
        details: 'Clip/holster; tubing.',
        pros: ['Traditional format'],
        cons: ['Larger pump', 'Visible clip', 'Tubing shows']
      },
      'Tandem t:slim X2': {
        title: 'Slim profile; tubing',
        details: 'Slim; tubing.',
        pros: ['Slimmer than Medtronic', 'Fits in pocket'],
        cons: ['Still visible', 'Tubing']
      },
      'Tandem Mobi': {
        title: 'Very small on body',
        details: 'Belt buckle, clip it, slip in pocket.',
        pros: ['Smallest tubed pump', 'Very discreet', 'Pocket-friendly'],
        cons: ['Still has short tubing']
      },
      'Omnipod 5': {
        title: 'Low pod profile',
        details: 'Upper arm, thighs, on stomach.',
        pros: ['No tubing', 'Multiple sites', 'Invisible under clothes'],
        cons: ['Pod visible when placed', 'Larger than Mobi']
      },
      'Beta Bionics iLet': {
        title: 'Traditional profile',
        details: 'Size of business card - can slip in pocket.',
        pros: ['Pocket size'],
        cons: ['Traditional pump look', 'Has tubing']
      },
      'Twiist': {
        title: 'Compact design',
        details: 'Circular shape - discreet under clothes.',
        pros: ['Lightest (2 oz)', 'Circular design', 'Very compact'],
        cons: ['Has tubing']
      }
    }
  },
  {
    dimension_number: 19,
    dimension_name: 'Ecosystem & accessories',
    dimension_description: 'Watches, widgets, and integrations can boost day-to-day joy. If you love tech, check where each ecosystem is headed.',
    importance_scale: '1-10',
    category: 'Integration',
    display_order: 19,
    pump_details: {
      'Medtronic 780G': {
        title: 'Medtronic ecosystem',
        details: 'MiniMed Mobile - can view on phone and sync to Apple Watch but cannot bolus - have to bolus through pump.',
        pros: ['Apple Watch viewing', 'Ecosystem integration'],
        cons: ['Cannot bolus from watch', 'Limited watch features']
      },
      'Tandem t:slim X2': {
        title: 'Apps + watch',
        details: 'View on phone only - can get notified on watch but have to bolus from pump.',
        pros: ['Watch notifications', 'App integration'],
        cons: ['No watch bolusing']
      },
      'Tandem Mobi': {
        title: 'Accessory-friendly',
        details: 'Everything done through phone.',
        pros: ['Full phone integration', 'Modern ecosystem'],
        cons: ['Phone-dependent']
      },
      'Omnipod 5': {
        title: 'Mobile + controller',
        details: 'Everything done through phone or PDM.',
        pros: ['Choice of devices', 'Flexible'],
        cons: ['Limited watch integration']
      },
      'Beta Bionics iLet': {
        title: 'Growing ecosystem',
        details: 'No watch or phone bolus - only on pump.',
        pros: ['Simple approach'],
        cons: ['No watch integration', 'No phone bolusing']
      },
      'Twiist': {
        title: 'Modern APIs planned',
        details: 'Can bolus on Apple Watch.',
        pros: ['Apple Watch bolusing', 'Modern integration', 'Forward-looking'],
        cons: ['Requires Apple ecosystem']
      }
    }
  },
  {
    dimension_number: 20,
    dimension_name: 'Reliability & occlusion handling',
    dimension_description: 'All systems can fail. Look at how alerts show up, how you clear them, and whether logs help you troubleshoot quickly.',
    importance_scale: '1-10',
    category: 'Reliability',
    display_order: 20,
    pump_details: {
      'Medtronic 780G': {
        title: 'On-pump alerts/logs',
        details: 'When occlusion occurs patient changes site - insulin does not have to be changed. Unplug from site and start again.',
        pros: ['Keep insulin', 'Quick fix', 'Detailed logs'],
        cons: ['Pump-based troubleshooting']
      },
      'Tandem t:slim X2': {
        title: 'Detection + t:connect',
        details: 'App or pump notifies.',
        pros: ['App and pump alerts', 'Good detection', 'Logs'],
        cons: []
      },
      'Tandem Mobi': {
        title: 'App notifications',
        details: 'App or pump notifies.',
        pros: ['Dual notifications', 'App-based logs'],
        cons: []
      },
      'Omnipod 5': {
        title: 'Replace pod if needed',
        details: 'Must replace entire pod.',
        pros: ['Clear indication'],
        cons: ['Waste entire pod', 'Replace all insulin']
      },
      'Beta Bionics iLet': {
        title: 'Device alerts',
        details: 'Occlusion suspected if high glucose alerted for 90 mins - then pump advises to change tubing.',
        pros: ['Smart detection', 'Delayed to avoid false alarms'],
        cons: ['90-minute wait']
      },
      'Twiist': {
        title: 'On-device + app alerts',
        details: 'Dual alert system.',
        pros: ['Multiple alert methods'],
        cons: ['Newer system']
      }
    }
  },
  {
    dimension_number: 21,
    dimension_name: 'Cost & insurance fit',
    dimension_description: 'Coverage varies by plan. Consider DME vs pharmacy benefits, supplies costs, and manufacturer programs for a realistic total.',
    importance_scale: '1-10',
    category: 'Financial',
    display_order: 21,
    pump_details: {
      'Medtronic 780G': {
        title: 'DME; plan dependent',
        details: 'Financial assistance 90% if qualified.',
        pros: ['Financial assistance available', 'DME coverage'],
        cons: ['Plan-dependent', 'May require prior auth']
      },
      'Tandem t:slim X2': {
        title: 'DME/pharmacy varies',
        details: 'DME or Pharmacy.',
        pros: ['Flexible coverage options', 'Often covered'],
        cons: ['Varies by plan']
      },
      'Tandem Mobi': {
        title: 'Confirm coverage',
        details: 'DME or Pharmacy.',
        pros: ['DME or pharmacy options'],
        cons: ['Newer so check coverage']
      },
      'Omnipod 5': {
        title: 'Often pharmacy',
        details: 'Pharmacy benefits.',
        pros: ['Pharmacy coverage easier', 'Often better coverage'],
        cons: ['Varies by plan']
      },
      'Beta Bionics iLet': {
        title: 'Check plan specifics',
        details: '1. Pharmacy benefits if patient quality fully covered with shipments and supplies. 2. DME/traditional insurance. 3. Pharmacy benefits for Medicare patients - no labs required.',
        pros: ['Multiple coverage paths', 'Medicare friendly'],
        cons: ['Complex to navigate']
      },
      'Twiist': {
        title: 'Confirm coverage',
        details: 'Pharmacy benefits.',
        pros: ['Pharmacy benefits'],
        cons: ['Very new - coverage uncertain']
      }
    }
  },
  {
    dimension_number: 22,
    dimension_name: 'On-body visibility & comfort',
    dimension_description: 'Sleeping, sitting, running—how will the device feel and look? If you\'re self-conscious, pick what you\'ll forget you\'re wearing.',
    importance_scale: '1-10',
    category: 'Comfort',
    display_order: 22,
    pump_details: {
      'Medtronic 780G': {
        title: 'Clip/holster; tubing',
        details: 'Traditional pump placement.',
        pros: ['Familiar format'],
        cons: ['Can feel bulky', 'Tubing interference']
      },
      'Tandem t:slim X2': {
        title: 'Slim; tubing',
        details: 'Slimmer profile.',
        pros: ['Slimmer', 'Less bulky'],
        cons: ['Tubing still present']
      },
      'Tandem Mobi': {
        title: 'Small; short tube',
        details: 'Very compact.',
        pros: ['Smallest tubed', 'Minimal feel', 'Forget it\'s there'],
        cons: ['Short tubing only']
      },
      'Omnipod 5': {
        title: 'Single pod',
        details: 'Pod only.',
        pros: ['No tubing', 'Freedom', 'Comfortable sleep'],
        cons: ['Pod placement matters', 'Some find it bulky']
      },
      'Beta Bionics iLet': {
        title: 'Standard pump',
        details: 'Traditional size.',
        pros: ['Standard format'],
        cons: ['Larger than Mobi/Twiist']
      },
      'Twiist': {
        title: 'Compact & light',
        details: '2 ounces.',
        pros: ['Lightest pump', 'Forget it\'s there', 'Comfortable'],
        cons: ['Circular shape unfamiliar']
      }
    }
  },
  {
    dimension_number: 23,
    dimension_name: 'Support apps & updates',
    dimension_description: 'Updates keep features fresh. Decide if you\'re comfortable maintaining apps/firmware or prefer a set-and-forget rhythm.',
    importance_scale: '1-10',
    category: 'Technology',
    display_order: 23,
    pump_details: {
      'Medtronic 780G': {
        title: 'Vendor tools',
        details: 'Updates on app - software update if user changing pumps.',
        pros: ['Guided updates', 'Rep assistance'],
        cons: ['Manual process', 'Less frequent']
      },
      'Tandem t:slim X2': {
        title: 't:connect + firmware',
        details: 'App updates and pump updates - sent notifications via email or on app - rep can help.',
        pros: ['Frequent updates', 'Notification system', 'Rep support'],
        cons: ['More maintenance']
      },
      'Tandem Mobi': {
        title: 'Phone-first updates',
        details: 'App updates and pump updates - sent notifications via email or on app - rep can help.',
        pros: ['Easy phone updates', 'Notifications', 'Support'],
        cons: ['Requires phone']
      },
      'Omnipod 5': {
        title: 'App/controller updates',
        details: 'App-based updates.',
        pros: ['Simple updates', 'Over-the-air'],
        cons: ['Pod firmware cannot update']
      },
      'Beta Bionics iLet': {
        title: 'BB tools',
        details: 'Not automatic - patient has to initiate when notified.',
        pros: ['User control'],
        cons: ['Manual initiation', 'Easy to forget']
      },
      'Twiist': {
        title: 'OTA app support',
        details: 'Updates during cartridge changes if need to update firmware.',
        pros: ['Automatic updates', 'During regular maintenance'],
        cons: ['Newer system']
      }
    }
  }
];


module.exports = PUMP_DIMENSIONS;
