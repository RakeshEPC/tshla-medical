export type SectionKey =
  | 'cost'
  | 'lifestyle'
  | 'algorithm'
  | 'easeToStart'
  | 'complexity'
  | 'support';

export interface SectionSignal {
  // normalized 0..1 weights of what the user cares about in this section
  [dimension: string]: number;
}

export interface PumpProfile {
  id: string; // e.g., "omnipod5"
  label: string; // display name
  brand: string; // e.g., "Insulet"
  schemaVersion: string; // e.g., "1.0"
  dataVersion: string; // e.g., "2025-08-27"
  // Per-section attributes normalized 0..1 for comparable scoring
  sections: Record<SectionKey, Record<string, number>>;
  notes?: Record<SectionKey, string[]>; // talking points per section
}

export interface AnswerRecord {
  // Collected signals per section, merged from answers
  signals: Partial<Record<SectionKey, SectionSignal>>;
  // Optional global section weights (patient priority, default equal)
  sectionWeights?: Partial<Record<SectionKey, number>>;
}

export interface SectionScore {
  section: SectionKey;
  scores: { pumpId: string; score: number; reasons: string[] }[];
  winner: { pumpId: string; score: number; reasons: string[] };
}

export interface OverallResult {
  perSection: SectionScore[];
  overallTop: { pumpId: string; score: number }[]; // aggregated with sectionWeights
}
