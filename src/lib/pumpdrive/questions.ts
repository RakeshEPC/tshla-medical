import type { SectionKey, SectionSignal } from './types';

export interface Question {
  id: string;
  section: SectionKey;
  prompt: string;
  type: 'single' | 'multi' | 'scale';
  choices?: { id: string; label: string }[];
  // map answer choice/scale to SectionSignal deltas (0..1)
  toSignal: (answer: any) => Partial<SectionSignal>;
}

export const QUESTIONS: Question[] = [
  // COST
  {
    id: 'cost-1',
    section: 'cost',
    prompt: 'Which matters more right now — lower monthly supplies or lower upfront device cost?',
    type: 'single',
    choices: [
      { id: 'ongoing', label: 'Lower monthly supplies' },
      { id: 'upfront', label: 'Lower upfront device cost' },
      { id: 'both', label: 'Both equally' },
    ],
    toSignal: a =>
      a === 'ongoing'
        ? { ongoing: 1 }
        : a === 'upfront'
          ? { upfront: 1 }
          : { ongoing: 0.7, upfront: 0.7 },
  },
  {
    id: 'cost-2',
    section: 'cost',
    prompt: 'Flexibility with where/how you buy supplies?',
    type: 'scale',
    toSignal: (x: number) => ({ suppliesFlex: x / 10 }), // 0..10 scale
  },

  // LIFESTYLE
  {
    id: 'life-1',
    section: 'lifestyle',
    prompt: 'How important is a small/tubeless form factor?',
    type: 'scale',
    toSignal: (x: number) => ({ smallForm: x / 10 }),
  },
  {
    id: 'life-2',
    section: 'lifestyle',
    prompt: 'Do you need full phone control (bolus, settings) instead of using the pump screen?',
    type: 'single',
    choices: [
      { id: 'yes', label: 'Yes' },
      { id: 'nice', label: 'Nice to have' },
      { id: 'no', label: 'No' },
    ],
    toSignal: a =>
      a === 'yes'
        ? { phoneControl: 1 }
        : a === 'nice'
          ? { phoneControl: 0.6 }
          : { phoneControl: 0 },
  },

  // ALGORITHM
  {
    id: 'algo-1',
    section: 'algorithm',
    prompt: 'How aggressive do you want the automation to be in chasing targets?',
    type: 'scale',
    toSignal: (x: number) => ({ aggressiveness: x / 10 }),
  },
  {
    id: 'algo-2',
    section: 'algorithm',
    prompt: 'Is flexible glucose targets (incl. exercise profiles) a priority?',
    type: 'scale',
    toSignal: (x: number) => ({ targetFlex: x / 10, exerciseModes: Math.min(1, x / 8) }),
  },

  // EASE TO START
  {
    id: 'start-1',
    section: 'easeToStart',
    prompt: 'How much hands‑on training/support will you need for day 1?',
    type: 'scale',
    toSignal: (x: number) => ({ trainingAvail: x / 10 }),
  },
  {
    id: 'start-2',
    section: 'easeToStart',
    prompt: 'Prefer the simplest initial setup over advanced customization?',
    type: 'single',
    choices: [
      { id: 'simple', label: 'Simplest setup' },
      { id: 'balanced', label: 'Balanced' },
      { id: 'custom', label: 'I want to tweak everything' },
    ],
    toSignal: a =>
      a === 'simple'
        ? { setupSimplicity: 1 }
        : a === 'balanced'
          ? { setupSimplicity: 0.6 }
          : { setupSimplicity: 0.2 },
  },

  // DAY‑TO‑DAY COMPLEXITY
  {
    id: 'complex-1',
    section: 'complexity',
    prompt: 'How much daily manual work are you OK with? (lower = prefer automation)',
    type: 'scale',
    toSignal: (x: number) => ({ manualWork: 1 - x / 10 }), // invert: lower tolerance → higher value for automation
  },
  {
    id: 'complex-2',
    section: 'complexity',
    prompt: 'Alert/alarms tolerance? (lower = want fewer alerts)',
    type: 'scale',
    toSignal: (x: number) => ({ alertLoad: 1 - x / 10 }),
  },

  // SUPPORT
  {
    id: 'support-1',
    section: 'support',
    prompt: 'Is wide clinic/trainer coverage important to you?',
    type: 'scale',
    toSignal: (x: number) => ({ clinicCoverage: x / 10, trainerAccess: x / 10 }),
  },
  {
    id: 'support-2',
    section: 'support',
    prompt: 'Prior bad warranty experiences make you value service reliability?',
    type: 'scale',
    toSignal: (x: number) => ({ warrantyExperience: x / 10 }),
  },
];
