import type { PumpProfile, SectionKey } from './types';

// Dimensions by section (keys must match signals produced by questions)
// cost: upfront, ongoing, suppliesFlex
// lifestyle: smallForm, waterResist, phoneControl, travelEase
// algorithm: aggressiveness, targetFlex, exerciseModes, cgmDependence
// easeToStart: trainingAvail, setupSimplicity, uiClarity
// complexity: manualWork, alertLoad, refillFriction
// support: clinicCoverage, trainerAccess, warrantyExperience

export const PUMPS: PumpProfile[] = [
  {
    id: 'omnipod5',
    label: 'Omnipod 5',
    brand: 'Insulet',
    schemaVersion: '1.0',
    dataVersion: '2025-08-27',
    sections: {
      cost: { upfront: 0.8, ongoing: 0.6, suppliesFlex: 0.9 },
      lifestyle: { smallForm: 0.85, waterResist: 0.7, phoneControl: 0.85, travelEase: 0.8 },
      algorithm: { aggressiveness: 0.6, targetFlex: 0.7, exerciseModes: 0.6, cgmDependence: 0.8 },
      easeToStart: { trainingAvail: 0.8, setupSimplicity: 0.85, uiClarity: 0.8 },
      complexity: { manualWork: 0.7, alertLoad: 0.75, refillFriction: 0.9 },
      support: { clinicCoverage: 0.85, trainerAccess: 0.8, warrantyExperience: 0.8 },
    },
    notes: {
      lifestyle: ['Tubeless convenience', 'Discreet form factor'],
      algorithm: ['CGM‑linked automation', 'Solid target flexibility'],
    },
  },
  {
    id: 'tandem-x2',
    label: 'Tandem t:slim X2',
    brand: 'Tandem',
    schemaVersion: '1.0',
    dataVersion: '2025-08-27',
    sections: {
      cost: { upfront: 0.6, ongoing: 0.65, suppliesFlex: 0.6 },
      lifestyle: { smallForm: 0.65, waterResist: 0.6, phoneControl: 0.7, travelEase: 0.7 },
      algorithm: { aggressiveness: 0.8, targetFlex: 0.85, exerciseModes: 0.8, cgmDependence: 0.7 },
      easeToStart: { trainingAvail: 0.8, setupSimplicity: 0.65, uiClarity: 0.7 },
      complexity: { manualWork: 0.55, alertLoad: 0.6, refillFriction: 0.6 },
      support: { clinicCoverage: 0.9, trainerAccess: 0.85, warrantyExperience: 0.85 },
    },
    notes: {
      algorithm: ['Strong auto‑correction logic', 'Fine target control'],
    },
  },
  {
    id: 'tandem-mobi',
    label: 'Tandem Mobi',
    brand: 'Tandem',
    schemaVersion: '1.0',
    dataVersion: '2025-08-27',
    sections: {
      cost: { upfront: 0.65, ongoing: 0.65, suppliesFlex: 0.65 },
      lifestyle: { smallForm: 0.8, waterResist: 0.65, phoneControl: 0.85, travelEase: 0.8 },
      algorithm: { aggressiveness: 0.75, targetFlex: 0.8, exerciseModes: 0.8, cgmDependence: 0.7 },
      easeToStart: { trainingAvail: 0.8, setupSimplicity: 0.7, uiClarity: 0.75 },
      complexity: { manualWork: 0.6, alertLoad: 0.65, refillFriction: 0.65 },
      support: { clinicCoverage: 0.85, trainerAccess: 0.8, warrantyExperience: 0.8 },
    },
  },
  {
    id: 'medtronic-780g',
    label: 'Medtronic 780G',
    brand: 'Medtronic',
    schemaVersion: '1.0',
    dataVersion: '2025-08-27',
    sections: {
      cost: { upfront: 0.55, ongoing: 0.6, suppliesFlex: 0.55 },
      lifestyle: { smallForm: 0.55, waterResist: 0.65, phoneControl: 0.6, travelEase: 0.6 },
      algorithm: { aggressiveness: 0.9, targetFlex: 0.75, exerciseModes: 0.75, cgmDependence: 0.8 },
      easeToStart: { trainingAvail: 0.85, setupSimplicity: 0.6, uiClarity: 0.65 },
      complexity: { manualWork: 0.55, alertLoad: 0.55, refillFriction: 0.55 },
      support: { clinicCoverage: 0.95, trainerAccess: 0.9, warrantyExperience: 0.9 },
    },
  },
  {
    id: 'ilet',
    label: 'Beta Bionics iLet',
    brand: 'Beta Bionics',
    schemaVersion: '1.0',
    dataVersion: '2025-08-27',
    sections: {
      cost: { upfront: 0.6, ongoing: 0.6, suppliesFlex: 0.6 },
      lifestyle: { smallForm: 0.6, waterResist: 0.65, phoneControl: 0.55, travelEase: 0.65 },
      algorithm: { aggressiveness: 0.7, targetFlex: 0.6, exerciseModes: 0.7, cgmDependence: 0.85 },
      easeToStart: { trainingAvail: 0.75, setupSimplicity: 0.8, uiClarity: 0.8 },
      complexity: { manualWork: 0.8, alertLoad: 0.75, refillFriction: 0.65 },
      support: { clinicCoverage: 0.75, trainerAccess: 0.75, warrantyExperience: 0.75 },
    },
    notes: {
      easeToStart: ['Simple mental model', 'Reduced carb math'],
    },
  },
  {
    id: 'twiist',
    label: 'Twiist',
    brand: 'Sequel MedTech',
    schemaVersion: '1.0',
    dataVersion: '2025-08-27',
    sections: {
      cost: { upfront: 0.65, ongoing: 0.7, suppliesFlex: 0.7 },
      lifestyle: { smallForm: 0.7, waterResist: 0.7, phoneControl: 0.75, travelEase: 0.75 },
      algorithm: { aggressiveness: 0.8, targetFlex: 0.8, exerciseModes: 0.8, cgmDependence: 0.7 },
      easeToStart: { trainingAvail: 0.7, setupSimplicity: 0.7, uiClarity: 0.7 },
      complexity: { manualWork: 0.65, alertLoad: 0.65, refillFriction: 0.7 },
      support: { clinicCoverage: 0.7, trainerAccess: 0.7, warrantyExperience: 0.7 },
    },
    notes: {
      algorithm: ['Aggressive automation options', 'Modern UI/phone control focus'],
    },
  },
];

export const SECTION_KEYS: SectionKey[] = [
  'cost',
  'lifestyle',
  'algorithm',
  'easeToStart',
  'complexity',
  'support',
];
