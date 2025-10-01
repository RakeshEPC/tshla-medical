export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  diagnosis: string;
  lastVisit: string;
  status: 'stable' | 'needs-attention' | 'critical';
  phone?: string;
  email?: string;
}

export const testPatients: Patient[] = [
  {
    id: '1',
    name: 'John Doe',
    age: 45,
    gender: 'Male',
    diagnosis: 'Type 2 Diabetes',
    lastVisit: '2024-01-15',
    status: 'stable',
    phone: '555-0101',
    email: 'john.doe@example.com',
  },
  {
    id: '2',
    name: 'Jane Smith',
    age: 38,
    gender: 'Female',
    diagnosis: 'Type 1 Diabetes',
    lastVisit: '2024-01-10',
    status: 'needs-attention',
    phone: '555-0102',
    email: 'jane.smith@example.com',
  },
  {
    id: '3',
    name: 'Robert Johnson',
    age: 62,
    gender: 'Male',
    diagnosis: 'Type 2 Diabetes',
    lastVisit: '2024-01-08',
    status: 'critical',
    phone: '555-0103',
    email: 'robert.j@example.com',
  },
];

export function getPatientById(id: string): Patient | undefined {
  return testPatients.find(patient => patient.id === id);
}

export function getPatientsByStatus(status: Patient['status']): Patient[] {
  return testPatients.filter(patient => patient.status === status);
}

export function generatePatientId(): string {
  return `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateAvaId(): string {
  return `AVA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
