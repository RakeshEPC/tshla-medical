// ------------------------------
// PumpDrive data & types (v3.1)
// ------------------------------
export type PumpKey =
  | 'Medtronic 780G'
  | 't:slim X2'
  | 'Tandem Mobi'
  | 'Omnipod 5'
  | 'Beta Bionics iLet';

export const PUMPS: PumpKey[] = [
  'Medtronic 780G',
  't:slim X2',
  'Tandem Mobi',
  'Omnipod 5',
  'Beta Bionics iLet',
];

export type Dimension = {
  id: string;
  title: string;
  scenario: string; // long-form paragraph shown to patient
  facts: Record<PumpKey, string>; // short, neutral facts per pump
};

// Helper to keep text compact in code
const p = (s: string) => s.replace(/\s+/g, ' ').trim();

// 21 dimensions
export const DIMENSIONS: Dimension[] = [
  {
    id: 'battery',
    title: 'Battery life & power management',
    scenario: p(`Battery power affects how often you charge or swap, what you must carry,
      and how confident you feel during long days, trips, or sports. Think about whether you prefer
      quick top-offs, carrying a spare AA battery, or avoiding charging because the pod is disposable.
      Also consider whether a dedicated charging pad would annoy you and whether phone apps might
      drain a rechargeable pump slightly faster.`),
    facts: {
      'Medtronic 780G': 'AA battery; swap anywhere; no charging.',
      't:slim X2': 'Rechargeable; multi-day; app use can add drain.',
      'Tandem Mobi': 'Rechargeable micro-pump; wireless pad for charging.',
      'Omnipod 5': 'Built-in pod battery; lasts the wear cycle; no charging.',
      'Beta Bionics iLet': 'Rechargeable; multi-day; top-offs recommended.',
    },
  },
  {
    id: 'phone_control',
    title: 'Phone control & app dependence',
    scenario: p(`Some pumps let you dose and adjust from your phone; others keep dosing on the pump
      and use the phone mainly to view data. Consider how often you have your phone, your comfort with
      apps, and whether you want the pump to keep working the same if your phone is away.`),
    facts: {
      'Medtronic 780G': 'Phone app for viewing; bolus on the pump.',
      't:slim X2': 'Mobile bolus on compatible phones.',
      'Tandem Mobi': 'Phone-first control; automation continues if phone is away.',
      'Omnipod 5': 'Full control via compatible phone or provided controller.',
      'Beta Bionics iLet': 'Phone for viewing/sharing; dosing on the pump.',
    },
  },
  {
    id: 'tubing_style',
    title: 'Tubing preference & wear style',
    scenario: p(`Decide whether you prefer a traditional tubed pump, a very short-tube micro-pump,
      or a tubeless pod. Imagine daily clothing, sleep, exercise, and how you feel about a visible tube
      versus an adhesive pod.`),
    facts: {
      'Medtronic 780G': 'Tubed pump with infusion set.',
      't:slim X2': 'Slim tubed pump; clip/case options.',
      'Tandem Mobi': 'Micro-pump; very short tube near the site.',
      'Omnipod 5': 'Tubeless pod adhered to skin.',
      'Beta Bionics iLet': 'Tubed pump with simple set changes.',
    },
  },
  {
    id: 'algorithm_style',
    title: 'Automation behavior (algorithm style)',
    scenario:
      p(`Automation styles differ. Some systems deliver auto-corrections and actively adjust basal;
      others aim for simplicity with fewer manual steps. Think about how aggressive you want automated
      corrections to be versus how much control you want to keep.`),
    facts: {
      'Medtronic 780G': 'SmartGuard automation with auto-corrections.',
      't:slim X2': 'Control-IQ adjusts basal and adds auto-correction boluses.',
      'Tandem Mobi': 'Runs Control-IQ like t:slim X2.',
      'Omnipod 5': 'On-pod algorithm adapts to CGM trends.',
      'Beta Bionics iLet': 'Adaptive algorithm aims for minimal manual input.',
    },
  },
  {
    id: 'cgm_compat',
    title: 'CGM compatibility & signal handling',
    scenario: p(`Consider which CGM you use or plan to use and how each pump integrates with it.
      Think about pairing reliability, warm-up periods, and what happens during brief signal gaps.`),
    facts: {
      'Medtronic 780G': 'Integrates with Medtronic CGM.',
      't:slim X2': 'Dexcom integration (model/region dependent).',
      'Tandem Mobi': 'Dexcom integration (model/region dependent).',
      'Omnipod 5': 'Dexcom integration; phone compatibility matters.',
      'Beta Bionics iLet': 'Dexcom integration (model/region dependent).',
    },
  },
  {
    id: 'target_flex',
    title: 'Target adjustability & flexibility',
    scenario: p(`Some systems allow more target/goal adjustments than others. Decide how much
      fine-tuning you want versus a simpler, more fixed approach.`),
    facts: {
      'Medtronic 780G': 'SmartGuard targets with limited adjustment.',
      't:slim X2': 'Profiles and temp targets via Control-IQ.',
      'Tandem Mobi': 'Control-IQ targets; app-driven changes.',
      'Omnipod 5': 'Adjustable target ranges; activity feature.',
      'Beta Bionics iLet': 'Simplified targets; minimal manual tweaks.',
    },
  },
  {
    id: 'exercise',
    title: 'Exercise modes & temporary targets',
    scenario:
      p(`If you’re active, consider how easy it is to set activity modes or temporary targets
      before workouts, and how the system behaves during and after exercise.`),
    facts: {
      'Medtronic 780G': 'Temp target for activity.',
      't:slim X2': 'Exercise mode raises target.',
      'Tandem Mobi': 'Same Control-IQ exercise mode.',
      'Omnipod 5': 'Activity feature to soften automation.',
      'Beta Bionics iLet': 'Simple activity target options.',
    },
  },
  {
    id: 'manual_bolus',
    title: 'Manual bolus workflow (carbs vs simpler steps)',
    scenario: p(`Consider whether you prefer classic carb entry and precise bolus math,
      or a simpler, guided style with fewer steps.`),
    facts: {
      'Medtronic 780G': 'Carb entry with auto-correction support.',
      't:slim X2': 'Carb entry; auto-correction boluses available.',
      'Tandem Mobi': 'App-based carb entry; quick-bolus options.',
      'Omnipod 5': 'Carb-based dosing with automated adjustments.',
      'Beta Bionics iLet': 'No carb counting; meal announcements (simple).',
    },
  },
  {
    id: 'capacity',
    title: 'Reservoir/pod capacity & change frequency',
    scenario:
      p(`Think about how much insulin you typically use and how often you want to change sets/pods.
      Larger reservoirs mean fewer changes; smaller ones can be lighter but require more frequent refills.`),
    facts: {
      'Medtronic 780G': 'High-capacity reservoir.',
      't:slim X2': 'High-capacity reservoir.',
      'Tandem Mobi': 'Smaller reservoir than full-size pumps.',
      'Omnipod 5': 'Fixed pod capacity; change on wear cycle.',
      'Beta Bionics iLet': 'Standard reservoir capacity.',
    },
  },
  {
    id: 'adhesive',
    title: 'Adhesive & site tolerance',
    scenario:
      p(`Consider skin sensitivity, sweat, and your climate. Tubed systems use an infusion set
      plus a separate CGM adhesive; pods combine pump and infusion site into one adhesive patch.`),
    facts: {
      'Medtronic 780G': 'Infusion set + separate CGM adhesive.',
      't:slim X2': 'Infusion set + separate CGM adhesive.',
      'Tandem Mobi': 'Small device near site + separate CGM.',
      'Omnipod 5': 'Pod adhesive + separate CGM adhesive.',
      'Beta Bionics iLet': 'Infusion set + separate CGM adhesive.',
    },
  },
  {
    id: 'water',
    title: 'Water resistance & activities',
    scenario:
      p(`If you swim or sweat heavily, check water resistance and what the manufacturer recommends
      for showers, pools, and submersion. Also consider tubing convenience in water.`),
    facts: {
      'Medtronic 780G': 'Water-resistant; tubed.',
      't:slim X2': 'Water-resistant; follow guide.',
      'Tandem Mobi': 'Improved resistance; very short tube.',
      'Omnipod 5': 'Pod rated for water within guidelines.',
      'Beta Bionics iLet': 'Water-resistant; tubed.',
    },
  },
  {
    id: 'alerts',
    title: 'Alerts & alarms customization',
    scenario: p(`Decide how much control you want over volume, vibration, and frequency of alerts
      for highs, lows, and system events.`),
    facts: {
      'Medtronic 780G': 'Customizable on-pump alerts.',
      't:slim X2': 'Pump + app alerts with options.',
      'Tandem Mobi': 'App-centric notifications.',
      'Omnipod 5': 'Phone/controller alert options.',
      'Beta Bionics iLet': 'Simplified essential alerts.',
    },
  },
  {
    id: 'ui',
    title: 'User interface & screen',
    scenario: p(`Pick the interface you’ll enjoy using daily—touchscreen, buttons, or phone-first—
      and the readability/visibility that fits your eyes and habits.`),
    facts: {
      'Medtronic 780G': 'Button interface with on-pump screen.',
      't:slim X2': 'Touchscreen pump UI.',
      'Tandem Mobi': 'Phone-first UI; minimal on-device controls.',
      'Omnipod 5': 'Phone or handheld controller UI.',
      'Beta Bionics iLet': 'Minimalist on-pump UI with prompts.',
    },
  },
  {
    id: 'sharing',
    title: 'Data sharing & reports',
    scenario:
      p(`If you share data with family or clinic, consider how each system handles uploading,
      viewing, and reports.`),
    facts: {
      'Medtronic 780G': 'CareLink platform.',
      't:slim X2': 't:connect (web + app).',
      'Tandem Mobi': 't:connect with Mobi support.',
      'Omnipod 5': 'Omnipod reports via app/cloud.',
      'Beta Bionics iLet': 'Beta Bionics cloud/reporting.',
    },
  },
  {
    id: 'clinic_support',
    title: 'Clinic support & training',
    scenario:
      p(`Consider how familiar local clinics are with each system and the availability of training
      resources if you’re new to pumps or automation.`),
    facts: {
      'Medtronic 780G': 'Large installed base; established training.',
      't:slim X2': 'Broad clinic familiarity.',
      'Tandem Mobi': 'Newer device with Tandem support.',
      'Omnipod 5': 'Widely used; many clinics trained.',
      'Beta Bionics iLet': 'Newer ecosystem; growing support.',
    },
  },
  {
    id: 'travel',
    title: 'Travel & airport logistics',
    scenario: p(`Think about what you’ll pack (batteries, charger, pods, sets), airport screening,
      and how easy it is to stay powered on long trips.`),
    facts: {
      'Medtronic 780G': 'Carry AA spares; tubed supplies.',
      't:slim X2': 'Carry charger; tubed supplies.',
      'Tandem Mobi': 'Carry wireless pad; micro-pump supplies.',
      'Omnipod 5': 'Extra pods; no charger needed.',
      'Beta Bionics iLet': 'Carry charger; tubed supplies.',
    },
  },
  {
    id: 'peds',
    title: 'Pediatric & caregiver features',
    scenario:
      p(`If a caregiver assists, consider remote viewing/bolus options, simplicity of workflows,
      and how easy it is to teach and supervise use.`),
    facts: {
      'Medtronic 780G': 'Caregiver-friendly features; approvals vary by age.',
      't:slim X2': 'Remote bolus on supported phones; sharing.',
      'Tandem Mobi': 'Phone control can help caregivers.',
      'Omnipod 5': 'Controller/phone options; data sharing.',
      'Beta Bionics iLet': 'Simplified interaction may help some families.',
    },
  },
  {
    id: 'discretion',
    title: 'Visual discretion & wearability',
    scenario: p(`Consider pump size, clips, and clothing. Decide whether you prefer a discreet pod
      under clothing or a small device with short tube near the site.`),
    facts: {
      'Medtronic 780G': 'Visible if clipped; tubed sites.',
      't:slim X2': 'Slim profile; tubed.',
      'Tandem Mobi': 'Very small device; short tube near site.',
      'Omnipod 5': 'Tubeless pod profile under clothing.',
      'Beta Bionics iLet': 'Traditional pump size.',
    },
  },
  {
    id: 'ecosystem',
    title: 'Ecosystem & accessories',
    scenario:
      p(`If you like watches, apps, or accessories, consider what each ecosystem supports today
      and how you might use it.`),
    facts: {
      'Medtronic 780G': 'Medtronic ecosystem; limited phone control.',
      't:slim X2': 'Apps and watch viewing available.',
      'Tandem Mobi': 'Phone-centric; accessory-friendly.',
      'Omnipod 5': 'Mobile ecosystem + controller.',
      'Beta Bionics iLet': 'Ecosystem growing over time.',
    },
  },
  {
    id: 'reliability',
    title: 'Reliability & occlusion handling',
    scenario:
      p(`All pumps can have occlusions or site issues. Consider how alerts appear, how you clear
      them, and your past experiences with sets or pods.`),
    facts: {
      'Medtronic 780G': 'On-pump occlusion alerts/logs.',
      't:slim X2': 'Occlusion detection; details in t:connect.',
      'Tandem Mobi': 'Similar detection; app notifications.',
      'Omnipod 5': 'Pod occlusion alerts; replace pod if needed.',
      'Beta Bionics iLet': 'Occlusion alerts on device.',
    },
  },
  {
    id: 'cost',
    title: 'Cost & insurance fit (subjective)',
    scenario:
      p(`Coverage and out-of-pocket vary widely by plan and region. Rate how each option fits your
      expected coverage and costs based on what you know today.`),
    facts: {
      'Medtronic 780G': 'Traditional DME coverage; check plan.',
      't:slim X2': 'DME; supplies via DME/pharmacy (varies).',
      'Tandem Mobi': 'Newer device; confirm coverage.',
      'Omnipod 5': 'Pods often via pharmacy; check benefit.',
      'Beta Bionics iLet': 'Confirm plan specifics; newer entrant.',
    },
  },
  {
    id: 'visibility',
    title: 'On-body visibility & comfort',
    scenario: p(`Think about how each option feels on your body during sleep, sitting, and movement,
      and how you feel about others noticing it.`),
    facts: {
      'Medtronic 780G': 'Clip/holster wear; tubing visible at times.',
      't:slim X2': 'Slim on belt/pocket; tubing visible.',
      'Tandem Mobi': 'Small device near site; low profile.',
      'Omnipod 5': 'Single pod footprint; no tubing visibility.',
      'Beta Bionics iLet': 'Standard pump profile; tubed.',
    },
  },
  {
    id: 'support_apps',
    title: 'Support apps & updates',
    scenario: p(`Consider how frequently apps/firmware update and whether you’re comfortable keeping
      things up to date on your phone or controller.`),
    facts: {
      'Medtronic 780G': 'Updates via Medtronic tools.',
      't:slim X2': 't:connect app + firmware updates.',
      'Tandem Mobi': 'Phone-first updates and tools.',
      'Omnipod 5': 'App/controller updates as released.',
      'Beta Bionics iLet': 'Updates via Beta Bionics tools.',
    },
  },
];
