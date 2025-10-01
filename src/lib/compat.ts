export type CGM = 'Dexcom' | 'Libre 3' | 'Guardian 4' | 'Eversense' | 'Any';

export const pumpCGMCompat: Record<string, CGM[]> = {
  'Omnipod 5': ['Dexcom'],
  Twiist: ['Dexcom'], // placeholder: adjust if Libre is supported
  'Tandem t:slim X2': ['Dexcom'],
  'Medtronic 780G': ['Guardian 4'],
  'iLet Bionic Pancreas': ['Dexcom', 'Libre 3'],
  // Unknown/other pumps from backend will pass through (we'll treat as compatible with "Any")
};

export function isPumpCompatibleWithCGM(pumpName: string, cgm: CGM): boolean {
  if (!cgm || cgm === 'Any') return true;
  const supports = pumpCGMCompat[pumpName];
  if (!supports) return true; // unknown pump → don't block
  return supports.includes(cgm);
}
