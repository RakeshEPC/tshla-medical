import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface UserRegistrationData {
  email: string;
  username?: string; // Optional - will be auto-generated if not provided
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
  isResearchParticipant?: boolean;
  researchData?: ResearchParticipantData;
  questionnaireData?: PreTreatmentQuestionnaire;
}

export interface ResearchParticipantData {
  fullName: string;
  dateOfBirth: string;
  pcpName: string;
  pcpPhone: string;
  pcpEmail: string;
  pcpAddress: string;
  endocrinologistName: string;
  endocrinologistPhone: string;
  endocrinologistEmail: string;
  endocrinologistAddress: string;
  mailingAddress: string;
}

export interface PreTreatmentQuestionnaire {
  overallSatisfaction: number;
  highBloodSugarFrequency: string;
  lowBloodSugarFrequency: string;
  convenienceSatisfaction: number;
  flexibilitySatisfaction: number;
  understandingSatisfaction: number;
  continuationLikelihood: number;
  recommendationLikelihood: number;
  additionalComments: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  isResearchParticipant: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
  accessExpired?: boolean;
  researchParticipantId?: number;
}

export interface AccessStatus {
  success: boolean;
  accessStatus: 'valid' | 'expired';
  accessExpiresAt: string;
  hoursRemaining: number;
}

class PumpAuthService {
  private baseUrl = import.meta.env.VITE_PUMP_API_URL || 'https://api.tshla.ai';

  private tokenKey = 'pump_auth_token';
  private userKey = 'pump_user_data';

  /**
   * Validate password requirements
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least 1 uppercase letter');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least 1 special character (!@#$%^&*)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register a new user account
   */
  async registerUser(registrationData: UserRegistrationData): Promise<AuthResponse> {
    try {
      logInfo('PumpAuth', 'Registering new user', {
        email: registrationData.email,
        username: registrationData.username,
        isResearchParticipant: registrationData.isResearchParticipant
      });

      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
      }

      // Store token and user data
      if (result.token) {
        localStorage.setItem(this.tokenKey, result.token);
      }
      if (result.user) {
        localStorage.setItem(this.userKey, JSON.stringify(result.user));
      }

      logInfo('PumpAuth', 'User registered successfully', {
        userId: result.user?.id,
        isResearchParticipant: result.user?.isResearchParticipant
      });

      return result;
    } catch (error) {
      logError('PumpAuth', 'User registration failed', { error });
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Login user with email and password
   */
  async loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      logInfo('PumpAuth', 'User login attempt', { email: credentials.email });

      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
      }

      // Store token and user data
      if (result.token) {
        localStorage.setItem(this.tokenKey, result.token);
      }
      if (result.user) {
        localStorage.setItem(this.userKey, JSON.stringify(result.user));
      }

      logInfo('PumpAuth', 'User logged in successfully', {
        userId: result.user?.id,
        accessExpired: result.accessExpired
      });

      return result;
    } catch (error) {
      logError('PumpAuth', 'User login failed', { error });
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user has valid access
   */
  async checkAccess(): Promise<AccessStatus> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${this.baseUrl}/api/auth/check-access`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
      }

      logDebug('PumpAuth', 'Access check completed', {
        accessStatus: result.accessStatus,
        hoursRemaining: result.hoursRemaining
      });

      return result;
    } catch (error) {
      logError('PumpAuth', 'Access check failed', { error });
      throw new Error(`Access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Renew 24-hour access after payment
   */
  async renewAccess(userId: number): Promise<{ success: boolean; accessExpiresAt: string }> {
    try {
      logInfo('PumpAuth', 'Renewing access for user', { userId });

      const response = await fetch(`${this.baseUrl}/api/auth/renew-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}`);
      }

      // Update stored user data with new expiry
      const userData = this.getUser();
      if (userData) {
        userData.accessExpiresAt = result.accessExpiresAt;
        localStorage.setItem(this.userKey, JSON.stringify(userData));
      }

      logInfo('PumpAuth', 'Access renewed successfully', {
        userId,
        newExpiryTime: result.accessExpiresAt
      });

      return result;
    } catch (error) {
      logError('PumpAuth', 'Access renewal failed', { error, userId });
      throw new Error(`Access renewal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get stored authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Get stored user data
   */
  getUser(): User | null {
    const userData = localStorage.getItem(this.userKey);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch (error) {
      logWarn('PumpAuth', 'Failed to parse stored user data', { error });
      return null;
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  }

  /**
   * Check if user's access has expired (client-side check)
   */
  isAccessExpired(): boolean {
    const user = this.getUser();
    if (!user || !user.accessExpiresAt) return true;

    const expiryTime = new Date(user.accessExpiresAt);
    const now = new Date();
    return now >= expiryTime;
  }

  /**
   * Get hours remaining in access period
   */
  getHoursRemaining(): number {
    const user = this.getUser();
    if (!user || !user.accessExpiresAt) return 0;

    const expiryTime = new Date(user.accessExpiresAt);
    const now = new Date();
    const msRemaining = expiryTime.getTime() - now.getTime();

    if (msRemaining <= 0) return 0;

    return Math.floor(msRemaining / (1000 * 60 * 60));
  }

  /**
   * Logout user and clear stored data
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);

    logInfo('PumpAuth', 'User logged out successfully', {});
  }

  /**
   * Alias for loginUser to maintain consistency with login page
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.loginUser(credentials);
  }

  /**
   * Clear all auth data (for debugging)
   */
  clearAll(): void {
    this.logout();
    logDebug('PumpAuth', 'All authentication data cleared', {});
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
   * Validate registration data before submission
   */
  validateRegistrationData(data: UserRegistrationData): string[] {
    const errors: string[] = [];

    // Email validation
    if (!data.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }

    // First name validation
    if (!data.firstName) {
      errors.push('First name is required');
    } else if (data.firstName.length < 1) {
      errors.push('First name must be at least 1 character');
    } else if (data.firstName.length > 50) {
      errors.push('First name must be less than 50 characters');
    }

    // Last name validation
    if (!data.lastName) {
      errors.push('Last name is required');
    } else if (data.lastName.length < 1) {
      errors.push('Last name must be at least 1 character');
    } else if (data.lastName.length > 50) {
      errors.push('Last name must be less than 50 characters');
    }

    // Phone number validation
    if (!data.phoneNumber) {
      errors.push('Phone number is required');
    } else if (!/^\+?[\d\s\-\(\)]{10,15}$/.test(data.phoneNumber)) {
      errors.push('Please enter a valid phone number');
    }

    // Password validation using new method
    const passwordValidation = this.validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    // Research participant data validation
    if (data.isResearchParticipant && data.researchData) {
      if (!data.researchData.fullName) {
        errors.push('Full name is required for research participants');
      }
      if (!data.researchData.dateOfBirth) {
        errors.push('Date of birth is required for research participants');
      }
      if (!data.researchData.mailingAddress) {
        errors.push('Mailing address is required for research participants');
      }
    }

    return errors;
  }
}

export const pumpAuthService = new PumpAuthService();