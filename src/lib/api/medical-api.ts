/**
import { env } from "../config/environment";
 * Medical API Client
 * Connects to Python FastAPI backend for HIPAA-compliant operations
 */

// Use environment variable or default to localhost for development
const API_BASE_URL = env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Store token in memory (in production, use secure storage)
let authToken: string | null = null;

export interface LoginCredentials {
  email: string;
  magic_word: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  tshla_number: string;
  ava_number?: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  transcript?: string;
  soap_note?: string;
  visit_type?: string;
  created_at: string;
  status: string;
}

class MedicalAPIClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }
    return response.json();
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<{ access_token: string }> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await this.handleResponse<{ access_token: string }>(response);
    authToken = data.access_token;

    // Store in localStorage for persistence (consider more secure options)
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', authToken);
    }

    return data;
  }

  async register(userData: { email: string; magic_word: string; role?: string }): Promise<User> {
    const response = await fetch(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    return this.handleResponse<User>(response);
  }

  // Patients
  async getPatients(): Promise<Patient[]> {
    const response = await fetch(`${this.baseURL}/api/patients`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Patient[]>(response);
  }

  async createPatient(patientData: Omit<Patient, 'id'>): Promise<Patient> {
    const response = await fetch(`${this.baseURL}/api/patients`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(patientData),
    });

    return this.handleResponse<Patient>(response);
  }

  // Visits
  async createVisit(
    patientId: string,
    visitData: {
      transcript?: string;
      soap_note?: string;
      visit_type?: string;
      chief_complaint?: string;
    }
  ): Promise<Visit> {
    const response = await fetch(`${this.baseURL}/api/patients/${patientId}/visits`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(visitData),
    });

    return this.handleResponse<Visit>(response);
  }

  async getPatientVisits(patientId: string): Promise<Visit[]> {
    const response = await fetch(`${this.baseURL}/api/patients/${patientId}/visits`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Visit[]>(response);
  }

  async getVisit(visitId: string): Promise<Visit> {
    const response = await fetch(`${this.baseURL}/api/visits/${visitId}`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Visit>(response);
  }

  async updateVisit(visitId: string, updates: Partial<Visit>): Promise<Visit> {
    const response = await fetch(`${this.baseURL}/api/visits/${visitId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    return this.handleResponse<Visit>(response);
  }

  // Legacy support for existing frontend
  async savePatientNote(noteData: {
    patientId: string;
    patientName: string;
    doctorId: string;
    date: string;
    transcript: string;
    soapNote: any;
    templateUsed: string;
  }): Promise<{ success: boolean; visitId?: string }> {
    const response = await fetch(`${this.baseURL}/api/patient-notes/save`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(noteData),
    });

    return this.handleResponse<{ success: boolean; visitId?: string }>(response);
  }

  async retrievePatientNote(
    patientId: string,
    date?: string
  ): Promise<{
    transcript: string;
    soapNote: any;
    date: string;
    templateUsed: string;
  }> {
    const params = new URLSearchParams({ patientId });
    if (date) params.append('date', date);

    const response = await fetch(`${this.baseURL}/api/patient-notes/retrieve?${params}`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  // Health check
  async checkHealth(): Promise<{ status: string; database?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      return this.handleResponse(response);
    } catch (error) {
      return { status: 'offline' };
    }
  }

  // Initialize token from storage
  initializeAuth(): void {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        authToken = storedToken;
      }
    }
  }

  // Logout
  logout(): void {
    authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!authToken;
  }
}

// Export singleton instance
export const medicalAPI = new MedicalAPIClient();

// Initialize on load
if (typeof window !== 'undefined') {
  medicalAPI.initializeAuth();
}
