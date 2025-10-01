/**
 * API Service for Backend Communication
 * Handles all database operations through API calls
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://api.tshla.ai';

class APIService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token ? `Bearer ${this.token}` : '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Authentication
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // Doctor operations
  async getDoctorByEmail(email: string) {
    return this.request(`/doctors/email/${email}`);
  }

  async getDoctorById(id: string) {
    return this.request(`/doctors/${id}`);
  }

  // Patient operations
  async getPatients() {
    return this.request('/patients');
  }

  async createPatient(patient: any) {
    return this.request('/patients', {
      method: 'POST',
      body: JSON.stringify(patient),
    });
  }

  // Visit operations
  async createVisit(visit: any) {
    return this.request('/visits', {
      method: 'POST',
      body: JSON.stringify(visit),
    });
  }

  async getVisits(patientId?: string) {
    const query = patientId ? `?patientId=${patientId}` : '';
    return this.request(`/visits${query}`);
  }

  // Audit logging
  async createAuditLog(log: any) {
    return this.request('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }
}

export const apiService = new APIService();
