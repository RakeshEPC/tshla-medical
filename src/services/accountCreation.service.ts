import bcrypt from 'bcryptjs';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface MedicalProfessional {
  id: string;
  email: string;
  username: string;
  password: string; // hashed
  plainPassword?: string; // temporary, for initial display only
  firstName: string;
  lastName: string;
  practice: string;
  role: 'doctor' | 'staff' | 'admin';
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  requiresPasswordChange: boolean;
  passwordChangedAt?: string;
  passwordHistory?: string[]; // Previous password hashes
}

class AccountCreationService {
  private readonly STORAGE_KEY = 'tshla_medical_accounts';

  /**
   * Generate a simple temporary password (4-letter word + 4 digits)
   */
  private generateSimplePassword(): string {
    // Simple 4-letter words that are easy to remember and type
    const words = [
      'Care',
      'Help',
      'Life',
      'Well',
      'Good',
      'Safe',
      'Hope',
      'Heal',
      'Best',
      'Team',
      'Star',
      'Plus',
      'Core',
      'Peak',
      'Pure',
      'Wise',
      'Kind',
      'Nice',
      'Calm',
      'Sure',
      'Easy',
      'Fast',
      'True',
      'Fair',
    ];

    // Pick a random word
    const word = words[Math.floor(Math.random() * words.length)];

    // Generate 4 random digits
    const digits = Math.floor(1000 + Math.random() * 9000).toString();

    // Combine word + digits
    return word + digits;
  }

  /**
   * Generate a secure password for permanent use
   */
  private generateSecurePassword(): string {
    const length = 12;
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    const allChars = lowercase + uppercase + numbers + symbols;

    let password = '';

    // Ensure at least one of each type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Generate username from email
   */
  private generateUsername(email: string): string {
    // Use the part before @ and make it lowercase
    const emailPart = email.split('@')[0].toLowerCase();
    // Remove special characters except dots and underscores
    return emailPart.replace(/[^a-z0-9._]/g, '');
  }

  /**
   * Extract name and practice from email
   */
  private extractInfoFromEmail(email: string): {
    firstName: string;
    lastName: string;
    practice: string;
  } {
    const [localPart, domain] = email.split('@');
    const nameParts = localPart.split('.');

    let firstName = '';
    let lastName = '';

    if (nameParts.length >= 2) {
      firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
      lastName =
        nameParts[nameParts.length - 1].charAt(0).toUpperCase() +
        nameParts[nameParts.length - 1].slice(1).toLowerCase();
    } else {
      firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
      lastName = '';
    }

    // Extract practice name from domain
    const practiceParts = domain.split('.')[0];
    const practice = practiceParts
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return { firstName, lastName, practice };
  }

  /**
   * Create multiple accounts at once
   */
  async createAccounts(emails: string[]): Promise<MedicalProfessional[]> {
    const accounts: MedicalProfessional[] = [];

    for (const email of emails) {
      const plainPassword = this.generateSimplePassword(); // Use simple password for initial accounts
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const username = this.generateUsername(email);
      const { firstName, lastName, practice } = this.extractInfoFromEmail(email);

      const account: MedicalProfessional = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        email: email.toLowerCase(),
        username,
        password: hashedPassword,
        plainPassword, // Store temporarily for display
        firstName,
        lastName,
        practice,
        role: 'doctor',
        createdAt: new Date().toISOString(),
        isActive: true,
        requiresPasswordChange: true, // Force password change on first login
        passwordHistory: [hashedPassword], // Keep track of password history
      };

      accounts.push(account);

      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Save to database (localStorage for now)
    this.saveAccounts(accounts);

    return accounts;
  }

  /**
   * Save accounts to database
   */
  private saveAccounts(newAccounts: MedicalProfessional[]): void {
    // Get existing accounts
    const existingData = localStorage.getItem(this.STORAGE_KEY);
    let accounts: MedicalProfessional[] = [];

    if (existingData) {
      try {
        accounts = JSON.parse(existingData);
      } catch (e) {
        logError('accountCreation', 'Error message', {});
      }
    }

    // Remove plainPassword before storing
    const accountsToStore = newAccounts.map(acc => {
      const { plainPassword, ...accountData } = acc;
      return accountData;
    });

    // Add new accounts
    accounts.push(...accountsToStore);

    // Save to localStorage (in production, this would be a database)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));

    // Also save a lookup index for quick access
    this.updateAccountIndex(accountsToStore);
  }

  /**
   * Update account lookup index
   */
  private updateAccountIndex(accounts: Omit<MedicalProfessional, 'plainPassword'>[]): void {
    const indexKey = `${this.STORAGE_KEY}_index`;
    const existingIndex = localStorage.getItem(indexKey);
    let index: Record<string, string> = {};

    if (existingIndex) {
      try {
        index = JSON.parse(existingIndex);
      } catch (e) {
        logError('accountCreation', 'Error message', {});
      }
    }

    // Add new accounts to index (email -> id mapping)
    accounts.forEach(account => {
      index[account.email] = account.id;
      index[account.username] = account.id;
    });

    localStorage.setItem(indexKey, JSON.stringify(index));
  }

  /**
   * Verify login credentials
   */
  async verifyLogin(
    emailOrUsername: string,
    password: string
  ): Promise<MedicalProfessional | null> {
    const account = this.getAccountByEmailOrUsername(emailOrUsername);

    if (!account) {
      return null;
    }

    const isValid = await bcrypt.compare(password, account.password);

    if (isValid) {
      // Update last login
      account.lastLogin = new Date().toISOString();
      this.updateAccount(account);

      // Return without password
      const { password: _, ...accountWithoutPassword } = account;
      return accountWithoutPassword as MedicalProfessional;
    }

    return null;
  }

  /**
   * Get account by email or username
   */
  private getAccountByEmailOrUsername(emailOrUsername: string): MedicalProfessional | null {
    const accounts = this.getAllAccounts();
    const searchValue = emailOrUsername.toLowerCase();

    return (
      accounts.find(
        acc => acc.email.toLowerCase() === searchValue || acc.username.toLowerCase() === searchValue
      ) || null
    );
  }

  /**
   * Get all accounts
   */
  getAllAccounts(): MedicalProfessional[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (e) {
      logError('accountCreation', 'Error message', {});
      return [];
    }
  }

  /**
   * Update account
   */
  private updateAccount(account: MedicalProfessional): void {
    const accounts = this.getAllAccounts();
    const index = accounts.findIndex(acc => acc.id === account.id);

    if (index !== -1) {
      accounts[index] = account;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
    }
  }

  /**
   * Get account by ID
   */
  getAccountById(id: string): MedicalProfessional | null {
    const accounts = this.getAllAccounts();
    return accounts.find(acc => acc.id === id) || null;
  }

  /**
   * Reset password (admin function)
   */
  async resetPassword(email: string): Promise<string | null> {
    const account = this.getAccountByEmailOrUsername(email);

    if (!account) {
      return null;
    }

    const newPassword = this.generateSimplePassword(); // Use simple password for resets
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    account.password = hashedPassword;
    account.requiresPasswordChange = true; // Force password change on next login

    // Add to password history
    if (!account.passwordHistory) {
      account.passwordHistory = [];
    }
    account.passwordHistory.push(hashedPassword);

    this.updateAccount(account);

    return newPassword;
  }

  /**
   * Change password (user function after login)
   */
  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const account = this.getAccountByEmailOrUsername(email);

    if (!account) {
      return false;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, account.password);
    if (!isValid) {
      return false;
    }

    // Check password requirements (at least 8 chars, mix of upper/lower/number)
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new Error('Password must contain uppercase, lowercase, and numbers');
    }

    // Check if password was used before
    if (account.passwordHistory) {
      for (const oldHash of account.passwordHistory) {
        if (await bcrypt.compare(newPassword, oldHash)) {
          throw new Error('Password was used previously. Please choose a different password.');
        }
      }
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    account.password = hashedPassword;
    account.requiresPasswordChange = false;
    account.passwordChangedAt = new Date().toISOString();

    // Add to history (keep last 5)
    if (!account.passwordHistory) {
      account.passwordHistory = [];
    }
    account.passwordHistory.push(hashedPassword);
    if (account.passwordHistory.length > 5) {
      account.passwordHistory.shift();
    }

    this.updateAccount(account);
    return true;
  }
}

export const accountCreationService = new AccountCreationService();
