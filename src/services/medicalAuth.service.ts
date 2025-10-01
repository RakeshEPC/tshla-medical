/**
 * Medical Staff Authentication Service
 * Handles authentication for medical professionals using the medical-auth-api
 * Completely separate from PumpDrive authentication
 * Created: September 21, 2025
 */

import { logDebug, logError, logInfo } from './logger.service';

interface MedicalUser {
  id: number;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  practice?: string;
  specialty?: string;
  accessType: 'medical';
}

interface MedicalAuthResult {
  success: boolean;
  user?: MedicalUser;
  token?: string;
  error?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'doctor' | 'nurse' | 'staff' | 'medical_assistant' | 'admin';
  practice?: string;
  specialty?: string;
}

class MedicalAuthService {
  private baseUrl = import.meta.env.VITE_MEDICAL_API_URL || 'https://api.tshla.ai';

  private readonly TOKEN_KEY = 'medical_auth_token';
  private readonly USER_DATA_KEY = 'medical_user_data';
  private readonly SESSION_EXPIRES_KEY = 'medical_session_expires';

  /**
   * Register new medical staff account
   */
  async register(registrationData: RegistrationData): Promise<MedicalAuthResult> {
    try {
      logInfo('MedicalAuth', 'Registering new medical staff', {
        email: registrationData.email,
        role: registrationData.role
      });

      const response = await fetch(`${this.baseUrl}/api/medical/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      logInfo('MedicalAuth', 'Medical staff registered successfully', {
        userId: result.user?.id,
        role: result.user?.role
      });

      return {
        success: true,
        user: result.user,
        token: result.token
      };
    } catch (error) {
      logError('MedicalAuth', 'Medical staff registration failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Login medical staff
   */
  async login(credentials: LoginCredentials): Promise<MedicalAuthResult> {
    try {
      logInfo('MedicalAuth', 'Medical staff login attempt', { email: credentials.email });

      const response = await fetch(`${this.baseUrl}/api/medical/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Store token and user data
      if (result.token) {
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
        this.saveSession(result.token, result.user, expiresAt);
      }

      logInfo('MedicalAuth', 'Medical staff logged in successfully', {
        userId: result.user?.id,
        role: result.user?.role
      });

      return {
        success: true,
        user: result.user,
        token: result.token
      };
    } catch (error) {
      logError('MedicalAuth', 'Medical staff login failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  /**
   * Verify current token
   */
  async verifyToken(): Promise<MedicalAuthResult> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'No token found' };
      }

      const response = await fetch(`${this.baseUrl}/api/medical/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      logDebug('MedicalAuth', 'Token verification successful', {
        userId: result.user?.id
      });

      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      logError('MedicalAuth', 'Token verification failed', { error });
      this.logout(); // Clear invalid token
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token verification failed'
      };
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(token: string, user: MedicalUser, expiresAt: Date): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(user));
    localStorage.setItem(this.SESSION_EXPIRES_KEY, expiresAt.toISOString());

    // Also set legacy keys for backward compatibility
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(user));
    localStorage.setItem('session_expires', expiresAt.toISOString());
  }

  /**
   * Get stored authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get stored user data
   */
  getUser(): MedicalUser | null {
    const userData = localStorage.getItem(this.USER_DATA_KEY);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch (error) {
      logError('MedicalAuth', 'Failed to parse stored user data', { error });
      return null;
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const expires = localStorage.getItem(this.SESSION_EXPIRES_KEY);
    const user = this.getUser();

    if (!token || !expires || !user) return false;

    const expiresAt = new Date(expires);
    return expiresAt > new Date();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Check if user is doctor
   */
  isDoctor(): boolean {
    return this.hasRole('doctor');
  }

  /**
   * Check if user is staff
   */
  isStaff(): boolean {
    const user = this.getUser();
    return user?.role === 'staff' || user?.role === 'medical_assistant' || user?.role === 'nurse';
  }

  /**
   * Get authorization headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Logout user and clear stored data
   */
  logout(): void {
    // Clear medical auth data
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
    localStorage.removeItem(this.SESSION_EXPIRES_KEY);

    // Clear legacy auth data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('session_expires');

    logInfo('MedicalAuth', 'Medical staff logged out successfully', {});
  }

  /**
   * Get session expiration time
   */
  getSessionExpiration(): Date | null {
    const expires = localStorage.getItem(this.SESSION_EXPIRES_KEY);
    if (!expires) return null;

    try {
      return new Date(expires);
    } catch {
      return null;
    }
  }

  /**
   * Get minutes remaining in session
   */
  getMinutesRemaining(): number {
    const expiration = this.getSessionExpiration();
    if (!expiration) return 0;

    const now = new Date();
    const msRemaining = expiration.getTime() - now.getTime();

    if (msRemaining <= 0) return 0;

    return Math.floor(msRemaining / (1000 * 60));
  }

  /**
   * Refresh session if needed (auto-extend)
   */
  async refreshSession(): Promise<boolean> {
    if (!this.isAuthenticated()) return false;

    const minutesRemaining = this.getMinutesRemaining();

    // If less than 30 minutes remaining, verify token to refresh
    if (minutesRemaining < 30) {
      const verifyResult = await this.verifyToken();
      return verifyResult.success;
    }

    return true;
  }
}

// Export singleton instance
export const medicalAuthService = new MedicalAuthService();

// Also export for backward compatibility
export default medicalAuthService;