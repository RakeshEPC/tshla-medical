/**
 * Admin API Service for PumpDrive User Management
 * Provides methods to fetch user data, statistics, and export capabilities
 */

const API_BASE_URL = import.meta.env.VITE_PUMP_API_URL ||
  'https://tshla-unified-api.azurewebsites.net';

interface PumpRecommendation {
  name: string;
  manufacturer: string;
  score: number;
  reason?: string;
}

export interface PumpDriveUser {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  phone_number: string | null;
  current_payment_status: string;
  created_at: string;
  last_login: string | null;
  login_count: number;
  is_active: boolean;
  email_verified: boolean;
  report_id: number | null;
  report_payment_status: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  recommendations: PumpRecommendation[] | null;
  primary_pump: string | null;
  secondary_pump: string | null;
  report_created_at: string | null;
}

export interface UserStats {
  total_users: number;
  paid_users: number;
  total_reports: number;
  users_with_paid_reports: number;
  new_users_24h: number;
  new_reports_24h: number;
}

interface UsersResponse {
  success: boolean;
  count: number;
  users: PumpDriveUser[];
  timestamp: string;
  error?: string;
  message?: string;
}

interface StatsResponse {
  success: boolean;
  stats: UserStats;
  timestamp: string;
  error?: string;
  message?: string;
}

class AdminPumpDriveService {
  /**
   * Fetch all PumpDrive users with their pump selections
   */
  async getAllUsers(): Promise<PumpDriveUser[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pumpdrive-users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication token here
          // 'Authorization': `Bearer ${getAuthToken()}`
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UsersResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to fetch users');
      }

      return data.users;
    } catch (error) {
      console.error('Admin API Error - getAllUsers:', error);
      throw error;
    }
  }

  /**
   * Fetch user statistics (counts, conversions, etc.)
   */
  async getStats(): Promise<UserStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pumpdrive-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication token here
          // 'Authorization': `Bearer ${getAuthToken()}`
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: StatsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to fetch stats');
      }

      return data.stats;
    } catch (error) {
      console.error('Admin API Error - getStats:', error);
      throw error;
    }
  }

  /**
   * Export users data to CSV file
   * Opens in new tab to trigger browser download
   */
  exportToCSV(): void {
    const exportUrl = `${API_BASE_URL}/api/admin/pumpdrive-users/export`;
    // TODO: Add authentication token as query parameter or header
    window.open(exportUrl, '_blank');
  }

  /**
   * Get a single user by ID with full details
   */
  async getUserById(userId: number): Promise<PumpDriveUser | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(u => u.id === userId) || null;
    } catch (error) {
      console.error('Admin API Error - getUserById:', error);
      throw error;
    }
  }

  /**
   * Search users by email, username, or name
   */
  async searchUsers(query: string): Promise<PumpDriveUser[]> {
    try {
      const users = await this.getAllUsers();
      const lowerQuery = query.toLowerCase();

      return users.filter(user =>
        user.email.toLowerCase().includes(lowerQuery) ||
        user.username.toLowerCase().includes(lowerQuery) ||
        user.full_name.toLowerCase().includes(lowerQuery) ||
        (user.phone_number && user.phone_number.includes(query))
      );
    } catch (error) {
      console.error('Admin API Error - searchUsers:', error);
      throw error;
    }
  }

  /**
   * Filter users by payment status
   */
  async filterByStatus(status: 'active' | 'pending' | 'trial'): Promise<PumpDriveUser[]> {
    try {
      const users = await this.getAllUsers();

      if (status === 'active') {
        return users.filter(u => u.current_payment_status === 'active');
      } else if (status === 'pending') {
        return users.filter(u => u.current_payment_status === 'pending');
      } else if (status === 'trial') {
        return users.filter(u => u.current_payment_status === 'trial');
      }

      return users;
    } catch (error) {
      console.error('Admin API Error - filterByStatus:', error);
      throw error;
    }
  }

  /**
   * Get users who have completed pump assessments
   */
  async getUsersWithReports(): Promise<PumpDriveUser[]> {
    try {
      const users = await this.getAllUsers();
      return users.filter(u => u.report_id !== null);
    } catch (error) {
      console.error('Admin API Error - getUsersWithReports:', error);
      throw error;
    }
  }

  /**
   * Get users who haven't completed assessments
   */
  async getUsersWithoutReports(): Promise<PumpDriveUser[]> {
    try {
      const users = await this.getAllUsers();
      return users.filter(u => u.report_id === null);
    } catch (error) {
      console.error('Admin API Error - getUsersWithoutReports:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const adminPumpDriveService = new AdminPumpDriveService();
