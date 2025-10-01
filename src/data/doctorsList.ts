export interface Doctor {
  id: string;
  name: string;
  practice: string;
  specialty: string;
  city: string;
  state: string;
  email?: string;
  phone?: string;
}

export const DOCTORS_LIST: Doctor[] = [
  // California
  {
    id: 'dr-smith-ca',
    name: 'Dr. Sarah Smith',
    practice: 'Bay Area Endocrinology',
    specialty: 'Endocrinology',
    city: 'San Francisco',
    state: 'CA',
    email: 'sarah.smith@bayendocrine.com',
  },
  {
    id: 'dr-johnson-ca',
    name: 'Dr. Michael Johnson',
    practice: 'UCLA Medical Center',
    specialty: 'Diabetes & Endocrinology',
    city: 'Los Angeles',
    state: 'CA',
    email: 'mjohnson@ucla.edu',
  },
  {
    id: 'dr-patel-ca',
    name: 'Dr. Raj Patel',
    practice: 'Stanford Diabetes Center',
    specialty: 'Endocrinology',
    city: 'Palo Alto',
    state: 'CA',
  },

  // New York
  {
    id: 'dr-williams-ny',
    name: 'Dr. Jennifer Williams',
    practice: 'Mount Sinai Diabetes Center',
    specialty: 'Endocrinology',
    city: 'New York',
    state: 'NY',
    email: 'jwilliams@mountsinai.org',
  },
  {
    id: 'dr-brown-ny',
    name: 'Dr. Robert Brown',
    practice: 'NYU Langone Health',
    specialty: 'Diabetes Management',
    city: 'New York',
    state: 'NY',
  },

  // Texas
  {
    id: 'dr-garcia-tx',
    name: 'Dr. Maria Garcia',
    practice: 'Houston Methodist',
    specialty: 'Endocrinology',
    city: 'Houston',
    state: 'TX',
    email: 'mgarcia@houstonmethodist.org',
  },
  {
    id: 'dr-davis-tx',
    name: 'Dr. James Davis',
    practice: 'UT Southwestern Medical',
    specialty: 'Diabetes & Metabolism',
    city: 'Dallas',
    state: 'TX',
  },

  // Florida
  {
    id: 'dr-martinez-fl',
    name: 'Dr. Carlos Martinez',
    practice: 'Miami Diabetes & Endocrine',
    specialty: 'Endocrinology',
    city: 'Miami',
    state: 'FL',
  },
  {
    id: 'dr-anderson-fl',
    name: 'Dr. Lisa Anderson',
    practice: 'Mayo Clinic Florida',
    specialty: 'Endocrinology',
    city: 'Jacksonville',
    state: 'FL',
    email: 'anderson.lisa@mayo.edu',
  },

  // Illinois
  {
    id: 'dr-taylor-il',
    name: 'Dr. David Taylor',
    practice: 'Northwestern Medicine',
    specialty: 'Endocrinology',
    city: 'Chicago',
    state: 'IL',
  },
  {
    id: 'dr-thomas-il',
    name: 'Dr. Patricia Thomas',
    practice: 'Rush University Medical',
    specialty: 'Diabetes Care',
    city: 'Chicago',
    state: 'IL',
  },

  // Massachusetts
  {
    id: 'dr-jackson-ma',
    name: 'Dr. Christopher Jackson',
    practice: 'Mass General Brigham',
    specialty: 'Endocrinology',
    city: 'Boston',
    state: 'MA',
    email: 'cjackson@mgh.harvard.edu',
  },
  {
    id: 'dr-white-ma',
    name: 'Dr. Emily White',
    practice: 'Joslin Diabetes Center',
    specialty: 'Diabetes',
    city: 'Boston',
    state: 'MA',
  },

  // Pennsylvania
  {
    id: 'dr-harris-pa',
    name: 'Dr. Mark Harris',
    practice: 'Penn Medicine',
    specialty: 'Endocrinology',
    city: 'Philadelphia',
    state: 'PA',
  },

  // Washington
  {
    id: 'dr-martin-wa',
    name: 'Dr. Susan Martin',
    practice: 'UW Medicine Diabetes Institute',
    specialty: 'Endocrinology',
    city: 'Seattle',
    state: 'WA',
    email: 'smartin@uw.edu',
  },

  // Arizona
  {
    id: 'dr-thompson-az',
    name: 'Dr. Kevin Thompson',
    practice: 'Mayo Clinic Arizona',
    specialty: 'Endocrinology',
    city: 'Phoenix',
    state: 'AZ',
  },

  // Colorado
  {
    id: 'dr-rodriguez-co',
    name: 'Dr. Ana Rodriguez',
    practice: 'UC Health Diabetes Center',
    specialty: 'Endocrinology',
    city: 'Denver',
    state: 'CO',
  },

  // Georgia
  {
    id: 'dr-lewis-ga',
    name: 'Dr. William Lewis',
    practice: 'Emory Healthcare',
    specialty: 'Diabetes & Endocrinology',
    city: 'Atlanta',
    state: 'GA',
  },

  // North Carolina
  {
    id: 'dr-walker-nc',
    name: 'Dr. Barbara Walker',
    practice: 'Duke Endocrinology',
    specialty: 'Endocrinology',
    city: 'Durham',
    state: 'NC',
    email: 'bwalker@duke.edu',
  },

  // Ohio
  {
    id: 'dr-hall-oh',
    name: 'Dr. Richard Hall',
    practice: 'Cleveland Clinic',
    specialty: 'Endocrinology & Metabolism',
    city: 'Cleveland',
    state: 'OH',
  },

  // Custom/Other option
  {
    id: 'other-doctor',
    name: 'My Doctor Not Listed',
    practice: 'Other Practice',
    specialty: 'Enter Details at Checkout',
    city: 'Other',
    state: 'Other',
  },
];

// Helper function to get doctors by state
export function getDoctorsByState(state: string): Doctor[] {
  return DOCTORS_LIST.filter(doc => doc.state === state);
}

// Helper function to search doctors
export function searchDoctors(query: string): Doctor[] {
  const searchTerm = query.toLowerCase();
  return DOCTORS_LIST.filter(
    doc =>
      doc.name.toLowerCase().includes(searchTerm) ||
      doc.practice.toLowerCase().includes(searchTerm) ||
      doc.city.toLowerCase().includes(searchTerm) ||
      doc.state.toLowerCase().includes(searchTerm)
  );
}

// Get all unique states
export function getStates(): string[] {
  const states = [...new Set(DOCTORS_LIST.map(doc => doc.state))];
  return states.filter(state => state !== 'Other').sort();
}
