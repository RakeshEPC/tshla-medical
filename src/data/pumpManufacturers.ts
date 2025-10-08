/**
 * Insulin Pump Manufacturer Contact Information
 * Sales representatives and company contacts for each pump manufacturer
 */

export interface ManufacturerContact {
  manufacturer: string;
  pumpModels: string[];
  website: string;
  phone: string;
  salesEmail?: string;
  salesRepName?: string;
  salesRepPhone?: string;
  salesRepEmail?: string;
  demoProgram?: boolean;
  demoDetails?: string;
  specialNotes?: string[];
}

export const pumpManufacturers: Record<string, ManufacturerContact> = {
  medtronic: {
    manufacturer: 'Medtronic Diabetes',
    pumpModels: ['MiniMed 780G', 'MiniMed 770G'],
    website: 'https://www.medtronicdiabetes.com',
    phone: '1-800-646-4633',
    salesEmail: 'rs.diabetesinfo@medtronic.com',
    demoProgram: true,
    demoDetails: 'Free pump trial program available - try before you buy',
    specialNotes: [
      'Ask about their loaner program for vacation coverage',
      'Financial assistance available - 90% discount if qualified',
      'Large network of certified trainers nationwide',
    ],
  },
  tandem: {
    manufacturer: 'Tandem Diabetes Care',
    pumpModels: ['t:slim X2', 'Mobi'],
    website: 'https://www.tandemdiabetes.com',
    phone: '1-877-801-6901',
    salesEmail: 'customerservice@tandemdiabetes.com',
    demoProgram: true,
    demoDetails: 'Demo devices available through your healthcare provider',
    specialNotes: [
      'Free loaner pump program for travel (highly recommended)',
      'Remote software updates - no need to replace pump for new features',
      'Control-IQ algorithm proven in clinical trials',
      'Ask about their warranty and replacement program',
    ],
  },
  insulet: {
    manufacturer: 'Insulet Corporation (Omnipod)',
    pumpModels: ['Omnipod 5', 'Omnipod DASH'],
    website: 'https://www.omnipod.com',
    phone: '1-800-591-3455',
    salesEmail: 'customercare@insulet.com',
    demoProgram: true,
    demoDetails: 'Free sample pod available (non-functional for demonstration)',
    specialNotes: [
      'No upfront pump cost - pay per pod supply shipment',
      'Tubeless system - most discreet option',
      'Waterproof pods - swim, shower, exercise freely',
      'Ask about pharmacy vs. DME insurance coverage (can vary significantly)',
    ],
  },
  'beta-bionics': {
    manufacturer: 'Beta Bionics',
    pumpModels: ['iLet Bionic Pancreas'],
    website: 'https://www.betabionics.com',
    phone: '1-844-443-8123',
    salesEmail: 'info@betabionics.com',
    demoProgram: false,
    demoDetails: 'Contact sales for information sessions',
    specialNotes: [
      'Unique "set and forget" approach - minimal input required',
      'No carb counting needed for many users',
      'Ask about their adaptive algorithm that learns your patterns',
      'Currently available through select healthcare providers',
    ],
  },
  'zealand-pharma': {
    manufacturer: 'Zealand Pharma (Twiist)',
    pumpModels: ['Twiist Automated Insulin Delivery System'],
    website: 'https://www.zealandpharma.com',
    phone: 'Contact through healthcare provider',
    salesEmail: 'info@zealandpharma.com',
    demoProgram: false,
    demoDetails: 'Availability varies by region - contact your endocrinologist',
    specialNotes: [
      'Advanced weight management features',
      'Integrated GLP-1 delivery options (in development)',
      'Ask your healthcare provider about regional availability',
      'May require specialized training certification',
    ],
  },
  sigi: {
    manufacturer: 'TypeZero/Sigi Medical',
    pumpModels: ['Sigi Patch Pump'],
    website: 'https://www.sigipump.com',
    phone: 'Contact through healthcare provider',
    salesEmail: 'info@sigipump.com',
    demoProgram: false,
    demoDetails: 'Currently in limited release - check with endocrinologist',
    specialNotes: [
      'Ultra-discreet patch pump design',
      'Smartphone-controlled dosing',
      'Ask about availability timeline in your area',
      'May be best option for those seeking maximum discretion',
    ],
  },
};

/**
 * Get manufacturer contact info by pump name
 */
export function getManufacturerByPumpName(pumpName: string): ManufacturerContact | null {
  pumpName = pumpName.toLowerCase();

  // Map pump names to manufacturer keys
  if (pumpName.includes('780g') || pumpName.includes('770g') || pumpName.includes('medtronic') || pumpName.includes('minimed')) {
    return pumpManufacturers.medtronic;
  }
  if (pumpName.includes('t:slim') || pumpName.includes('tslim') || pumpName.includes('mobi') || pumpName.includes('tandem')) {
    return pumpManufacturers.tandem;
  }
  if (pumpName.includes('omnipod') || pumpName.includes('insulet')) {
    return pumpManufacturers.insulet;
  }
  if (pumpName.includes('ilet') || pumpName.includes('beta bionics') || pumpName.includes('bionic')) {
    return pumpManufacturers['beta-bionics'];
  }
  if (pumpName.includes('twiist') || pumpName.includes('zealand')) {
    return pumpManufacturers['zealand-pharma'];
  }
  if (pumpName.includes('sigi') || pumpName.includes('patch pump')) {
    return pumpManufacturers.sigi;
  }

  return null;
}

/**
 * Get all manufacturers as array
 */
export function getAllManufacturers(): ManufacturerContact[] {
  return Object.values(pumpManufacturers);
}
