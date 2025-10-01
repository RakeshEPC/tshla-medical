export interface PumpFeature {
  id: string;
  title: string;
  description: string;
  emoji: string;
  pumpId: string; // Hidden from user, used for matching
  category: 'power' | 'interface' | 'design' | 'automation' | 'convenience' | 'innovation';
}

export const PUMP_FEATURES: PumpFeature[] = [
  // Medtronic 780G Features
  {
    id: 'aa-battery-power',
    title: 'Swap batteries anywhere, anytime',
    description:
      'Never worry about finding a charger - just pop in fresh AA batteries from any store',
    emoji: '🔋',
    pumpId: 'medtronic-780g',
    category: 'power',
  },
  {
    id: 'aggressive-control',
    title: 'Most aggressive blood sugar control',
    description:
      'System gives 100% correction doses vs 60% on other pumps for tightest control possible',
    emoji: '🎯',
    pumpId: 'medtronic-780g',
    category: 'automation',
  },
  {
    id: 'fully-submersible',
    title: 'Swim and dive up to 12 feet underwater',
    description: 'Only pump rated for serious swimming and water sports - submersible to 12 feet',
    emoji: '🏊‍♂️',
    pumpId: 'medtronic-780g',
    category: 'design',
  },

  // Tandem t:slim X2 Features
  {
    id: 'touchscreen-control',
    title: 'Smartphone-like touchscreen interface',
    description:
      'Easy-to-use color touchscreen that works just like your phone - no confusing buttons',
    emoji: '📱',
    pumpId: 't-slim-x2',
    category: 'interface',
  },
  {
    id: 'multiple-cgm-options',
    title: 'Works with multiple CGM brands',
    description: 'Compatible with Dexcom G6/G7, Libre 2 Plus, and upcoming Libre 3 - your choice',
    emoji: '🔄',
    pumpId: 't-slim-x2',
    category: 'convenience',
  },
  {
    id: 'phone-bolusing',
    title: 'Deliver insulin directly from your phone',
    description: 'Dose insulin using your smartphone app - no need to pull out your pump',
    emoji: '📲',
    pumpId: 't-slim-x2',
    category: 'convenience',
  },

  // Tandem Mobi Features
  {
    id: 'ultra-small-size',
    title: 'Smallest pump ever made',
    description: 'Tiny size with short tubing makes it almost invisible under clothes',
    emoji: '🤏',
    pumpId: 'tandem-mobi',
    category: 'design',
  },
  {
    id: 'iphone-only-control',
    title: 'Completely controlled by iPhone',
    description: 'No pump buttons needed - your iPhone is your remote control for everything',
    emoji: '📱',
    pumpId: 'tandem-mobi',
    category: 'interface',
  },
  {
    id: 'wireless-charging',
    title: 'Wireless charging like your phone',
    description: 'Just set it on a charging plate - no cords or plugs to mess with',
    emoji: '🔌',
    pumpId: 'tandem-mobi',
    category: 'power',
  },

  // Omnipod 5 Features
  {
    id: 'completely-tubeless',
    title: 'Zero tubing for total freedom',
    description: 'No tubes to get caught on things - complete freedom of movement',
    emoji: '🎪',
    pumpId: 'omnipod-5',
    category: 'design',
  },
  {
    id: 'waterproof-pod',
    title: 'Swim and shower without disconnecting',
    description: 'Waterproof design means never disconnect for water activities',
    emoji: '💦',
    pumpId: 'omnipod-5',
    category: 'design',
  },
  {
    id: 'dual-control-options',
    title: 'Use phone OR dedicated controller',
    description: 'Choose between smartphone app or dedicated handheld controller device',
    emoji: '🎮',
    pumpId: 'omnipod-5',
    category: 'interface',
  },

  // Beta Bionics iLet Features
  {
    id: 'no-carb-counting',
    title: 'Never count carbs again',
    description: 'Just announce meals - the system figures out insulin needs automatically',
    emoji: '🍎',
    pumpId: 'beta-bionics-ilet',
    category: 'automation',
  },
  {
    id: 'simple-meal-announcements',
    title: 'Say "usual meal" or "more than usual"',
    description: 'No complex calculations - just tell it if your meal is typical or bigger',
    emoji: '🗣️',
    pumpId: 'beta-bionics-ilet',
    category: 'automation',
  },
  {
    id: 'inductive-charging',
    title: 'Charges wirelessly like electric toothbrush',
    description: 'Set and forget inductive charging - no ports or connections',
    emoji: '⚡',
    pumpId: 'beta-bionics-ilet',
    category: 'power',
  },

  // Twiist Features
  {
    id: 'apple-watch-bolusing',
    title: 'Deliver insulin from your Apple Watch',
    description: 'Most convenient dosing ever - just tap your watch to give insulin',
    emoji: '⌚',
    pumpId: 'twiist',
    category: 'innovation',
  },
  {
    id: 'emoji-bolusing',
    title: 'Dose with food emojis 🍎🥪🍕',
    description: 'Fun, intuitive interface - pick the emoji that matches your meal',
    emoji: '😀',
    pumpId: 'twiist',
    category: 'innovation',
  },
  {
    id: 'ultra-lightweight',
    title: 'Weighs only 2 ounces',
    description: "Lightest pump available - you'll forget you're wearing it",
    emoji: '🪶',
    pumpId: 'twiist',
    category: 'design',
  },
];

export const FEATURE_CATEGORIES = {
  power: { name: 'Power & Charging', icon: '🔋' },
  interface: { name: 'Controls & Interface', icon: '📱' },
  design: { name: 'Size & Wearability', icon: '💎' },
  automation: { name: 'Smart Automation', icon: '🤖' },
  convenience: { name: 'Daily Convenience', icon: '✨' },
  innovation: { name: 'Latest Innovation', icon: '🚀' },
} as const;
