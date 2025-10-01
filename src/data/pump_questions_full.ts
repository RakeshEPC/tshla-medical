export type Dimension =
  | 'Tubing Preference'
  | 'App Control'
  | 'Control Preference'
  | 'Target Adjustability'
  | 'Carb Counting'
  | 'Automation Trust'
  | 'Exercise Mode'
  | 'Visibility'
  | 'Clinic Support'
  | 'Budget Flexibility'
  | 'Travel Friendliness'
  | 'Data Sharing'
  | 'CGM Compatibility'
  | 'Algorithm Adaptability'
  | 'Infusion/Pod Wear Duration'
  | 'Reservoir Size'
  | 'Integration Ecosystem'
  | 'Training Burden'
  | 'Safety Alerts & Fail-safes'
  | 'Battery Convenience'
  | 'Customizable Alerts';

export const DIM_LABELS: Dimension[] = [
  'Tubing Preference',
  'App Control',
  'Control Preference',
  'Target Adjustability',
  'Carb Counting',
  'Automation Trust',
  'Exercise Mode',
  'Visibility',
  'Clinic Support',
  'Budget Flexibility',
  'Travel Friendliness',
  'Data Sharing',
  'CGM Compatibility',
  'Algorithm Adaptability',
  'Infusion/Pod Wear Duration',
  'Reservoir Size',
  'Integration Ecosystem',
  'Training Burden',
  'Safety Alerts & Fail-safes',
  'Battery Convenience',
  'Customizable Alerts',
];

type Option = { text: string; score: number };
export type Q = { dimension: Dimension; question: string; options: Option[] };

const questions: Q[] = [
  {
    dimension: 'Tubing Preference',
    question: 'Getting dressed for a day out, which setup feels most natural with your clothes?',
    options: [
      { text: 'Wearable without visible lines or tubes.', score: 10 },
      { text: 'A short, tidy connection is fine.', score: 6 },
      { text: 'Longer tubing is okay if features fit me.', score: 3 },
    ],
  },
  {
    dimension: 'App Control',
    question: 'On the go and need a quick adjustment—what would you reach for first?',
    options: [
      { text: 'My phone, most of the time.', score: 10 },
      { text: 'Either phone or device.', score: 7 },
      { text: 'The device itself.', score: 3 },
    ],
  },
  {
    dimension: 'Control Preference',
    question: 'How hands-on do you want to be with settings day to day?',
    options: [
      { text: 'I’ll fine-tune often.', score: 10 },
      { text: 'I’ll adjust sometimes.', score: 7 },
      { text: 'Prefer it to handle decisions.', score: 3 },
    ],
  },
  {
    dimension: 'Target Adjustability',
    question: 'Travel week—nights run different. How much should you be able to nudge goals?',
    options: [
      { text: 'Full control for different times/activities.', score: 10 },
      { text: 'Some ability to adjust.', score: 7 },
      { text: 'Fixed goals are fine.', score: 3 },
    ],
  },
  {
    dimension: 'Carb Counting',
    question: 'At a potluck trying a new dish—how do you handle dosing?',
    options: [
      { text: 'Estimate confidently and use helpful features.', score: 10 },
      { text: 'Basic guess and let the system assist.', score: 7 },
      { text: 'Let automation take the lead.', score: 3 },
    ],
  },
  {
    dimension: 'Automation Trust',
    question: 'Overnight adjustments without waking you—how should that work?',
    options: [
      { text: 'Act automatically.', score: 10 },
      { text: 'I’ll check in sometimes.', score: 7 },
      { text: 'Prefer to decide first.', score: 3 },
    ],
  },
  {
    dimension: 'Exercise Mode',
    question: 'Right before a workout—how quickly should you switch to an activity setup?',
    options: [
      { text: 'Very quickly, minimal steps.', score: 10 },
      { text: 'Available even if it takes a moment.', score: 7 },
      { text: 'No special mode needed.', score: 3 },
    ],
  },
  {
    dimension: 'Visibility',
    question: 'For a formal event—how should the pump’s presence be handled?',
    options: [
      { text: 'Blend in completely.', score: 10 },
      { text: 'Small and subtle is fine.', score: 7 },
      { text: 'Visibility isn’t a concern.', score: 3 },
    ],
  },
  {
    dimension: 'Clinic Support',
    question: 'If questions come up, how important is local staff expertise?',
    options: [
      { text: 'Very important.', score: 10 },
      { text: 'Somewhat important.', score: 7 },
      { text: 'Not important.', score: 3 },
    ],
  },
  {
    dimension: 'Budget Flexibility',
    question: 'When extra value is clear, how do you approach costs?',
    options: [
      { text: 'I’ll pay more for features I want.', score: 10 },
      { text: 'Prefer mid-range first.', score: 7 },
      { text: 'Prefer lowest cost.', score: 3 },
    ],
  },
  {
    dimension: 'Travel Friendliness',
    question: 'Two-week trip—what matters most for supplies and wear time?',
    options: [
      { text: 'Fewer changes and simple logistics.', score: 10 },
      { text: 'Some convenience is enough.', score: 7 },
      { text: 'Travel doesn’t affect my choice.', score: 3 },
    ],
  },
  {
    dimension: 'Data Sharing',
    question: 'Automatic sharing to clinic/family—what’s your take?',
    options: [
      { text: 'Enable it.', score: 10 },
      { text: 'Sometimes.', score: 7 },
      { text: 'Keep data to myself.', score: 3 },
    ],
  },
  {
    dimension: 'CGM Compatibility',
    question: 'Staying with your current sensor family—how important is that?',
    options: [
      { text: 'Very important.', score: 10 },
      { text: 'Open to switching.', score: 7 },
      { text: 'No preference.', score: 5 },
    ],
  },
  {
    dimension: 'Algorithm Adaptability',
    question: 'Schedules change—how important is fast adaptation?',
    options: [
      { text: 'Very important.', score: 10 },
      { text: 'Somewhat important.', score: 7 },
      { text: 'Not important.', score: 3 },
    ],
  },
  {
    dimension: 'Infusion/Pod Wear Duration',
    question: 'Changing sets/pods—what’s your ideal?',
    options: [
      { text: 'As few changes as possible.', score: 10 },
      { text: 'Every few days is fine.', score: 7 },
      { text: 'Frequent changes are okay.', score: 3 },
    ],
  },
  {
    dimension: 'Reservoir Size',
    question: 'Thinking about roughly three days of insulin—what do you prefer?',
    options: [
      { text: 'Larger reserve without refilling.', score: 10 },
      { text: 'Medium size is fine.', score: 7 },
      { text: 'Small is fine.', score: 3 },
    ],
  },
  {
    dimension: 'Integration Ecosystem',
    question: 'Linking with watches/fitness trackers—how much does that matter?',
    options: [
      { text: 'A lot—keep devices connected.', score: 10 },
      { text: 'Nice to have.', score: 7 },
      { text: 'Doesn’t matter.', score: 3 },
    ],
  },
  {
    dimension: 'Training Burden',
    question: 'Starting out—what do you want from onboarding?',
    options: [
      { text: 'Simple, clear support.', score: 10 },
      { text: 'Some learning is fine.', score: 7 },
      { text: 'Steep curve is okay.', score: 3 },
    ],
  },
  {
    dimension: 'Safety Alerts & Fail-safes',
    question: 'Out for the day and an issue is detected—how should alerts behave?',
    options: [
      { text: 'Notify quickly and clearly.', score: 10 },
      { text: 'Helpful but not urgent.', score: 7 },
      { text: 'Not a priority.', score: 3 },
    ],
  },
  {
    dimension: 'Battery Convenience',
    question: 'For power—what fits you best?',
    options: [
      { text: 'Charge rarely/easily or use disposables.', score: 10 },
      { text: 'Charging occasionally is fine.', score: 7 },
      { text: 'Frequent charging is okay.', score: 3 },
    ],
  },
  {
    dimension: 'Customizable Alerts',
    question: 'With frequent alerts, how important is customizing sound, vibration, and timing?',
    options: [
      { text: 'Very important.', score: 10 },
      { text: 'Nice to have.', score: 7 },
      { text: 'Not important.', score: 3 },
    ],
  },
];

export default questions;
