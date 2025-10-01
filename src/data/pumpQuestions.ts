export type Option = { label: string; score: number };
export type PumpQuestion = { dimension: string; question: string; options: Option[] };

export const PUMP_QUESTIONS: PumpQuestion[] = [
  {
    dimension: 'Tubing Preference',
    question: "You're about to head out for a workout or swim. Which setup sounds best?",
    options: [
      {
        label:
          "I don't want to remove or disconnect anything — I want it to just stay on and work.",
        score: 3,
      },
      { label: "I'm okay quickly detaching something or tucking it away.", score: 1 },
      { label: 'Either is fine depending on the day — I’m flexible.', score: 2 },
    ],
  },
  {
    dimension: 'Tubing Preference',
    question: "When you're getting dressed or wearing tighter clothes...",
    options: [
      { label: 'I want my device completely hidden and wire-free.', score: 3 },
      { label: 'A little tubing is fine; I don’t mind managing it.', score: 1 },
      { label: 'I’m okay either way; comfort matters more than style.', score: 2 },
    ],
  },
  {
    dimension: 'Control Preference',
    question: 'How do you prefer to make adjustments (bolus, temp targets, etc.)?',
    options: [
      { label: 'I want a phone app to do almost everything quickly.', score: 3 },
      { label: 'I prefer using the pump device itself.', score: 1 },
      { label: 'I want both options available.', score: 2 },
    ],
  },
  {
    dimension: 'Control Preference',
    question: 'If your phone dies or isn’t with you…',
    options: [
      { label: 'I still want full control from the pump.', score: 1 },
      { label: 'I’m fine losing app control if the pump can maintain automation.', score: 2 },
      { label: 'I mostly care about the app; I rarely touch the pump.', score: 3 },
    ],
  },
  {
    dimension: 'Target Adjustability',
    question: 'How specific do you want to be with glucose targets?',
    options: [
      { label: 'Very specific; I want to set exact targets.', score: 3 },
      { label: 'I’m fine with a reasonable default target.', score: 1 },
      { label: 'A mix: default most days, tweak when needed.', score: 2 },
    ],
  },
  {
    dimension: 'App Control',
    question: 'Using your phone for daily pump tasks…',
    options: [
      { label: 'Essential — I want a great app and do most things there.', score: 3 },
      { label: 'Nice to have — basic things on app are enough.', score: 2 },
      { label: 'Not important — I prefer the pump hardware.', score: 1 },
    ],
  },
  {
    dimension: 'Carb Counting',
    question: 'Carb entry for meals…',
    options: [
      { label: 'I want to enter precise carbs and fine tune.', score: 3 },
      { label: 'I’d rather keep it simple or use presets.', score: 1 },
      { label: 'I can do either depending on the situation.', score: 2 },
    ],
  },
  {
    dimension: 'Automation Trust',
    question: 'How much do you trust closed-loop automation?',
    options: [
      { label: 'A lot — I want it handling most of the work.', score: 3 },
      { label: 'Some — I want to oversee and step in often.', score: 2 },
      { label: 'Little — I prefer manual control.', score: 1 },
    ],
  },
  {
    dimension: 'Exercise Mode',
    question: 'During exercise, what’s most important?',
    options: [
      { label: 'Smart, automatic adjustments with minimal fiddling.', score: 3 },
      { label: 'Simple manual options to raise targets/lessen insulin.', score: 2 },
      { label: 'I’ll manage it manually; don’t need special modes.', score: 1 },
    ],
  },
  {
    dimension: 'Visibility',
    question: 'On-body visibility:',
    options: [
      { label: 'I want low-profile and discreet.', score: 3 },
      { label: 'Doesn’t matter to me.', score: 2 },
      { label: 'I’m fine with a visible device/tube.', score: 1 },
    ],
  },
  {
    dimension: 'Clinic Support',
    question: 'Training & clinic familiarity:',
    options: [
      { label: 'I want widely supported options my clinic knows well.', score: 3 },
      { label: 'I don’t mind newer options if they fit me better.', score: 2 },
      { label: 'I’m happy to self-learn with minimal clinic help.', score: 1 },
    ],
  },
];
