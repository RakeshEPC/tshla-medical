import { accountCreationService } from '../services/accountCreation.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

// List of medical professionals to create accounts for
const medicalProfessionals = [
  'veena.watwe@houstondiabetescenter.com',
  'Ghislaine.Tonye@endocrineandpsychiatry.com',
  'radha.bernander@endocrineandpsychiatry.com',
  'Elina.Shakya@houstondiabetescenter.com',
  'cindy.laverde@endocrineandpsychiatry.com' // Note: email shows Vanessa but email is cindy
];

export async function createDoctorAccounts() {
  logDebug('App', 'Debug message', {});
  
  try {
    const accounts = await accountCreationService.createAccounts(medicalProfessionals);
    
    logInfo('App', 'Info message', {});
    logDebug('App', 'Debug message', {}); 
    
    accounts.forEach((account, index) => {
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {}); 
    });
    
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    
    // Return credentials for display
    return accounts.map(acc => ({
      name: `${acc.firstName} ${acc.lastName}`,
      email: acc.email,
      username: acc.username,
      password: acc.plainPassword,
      practice: acc.practice
    }));
    
  } catch (error) {
    logError('App', 'Error message', {});
    throw error;
  }
}

// Function to display accounts in a formatted table
export function displayAccountsTable(accounts: any[]) {
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug output', { data: data: "placeholder" });
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  
  accounts.forEach(acc => {
    const name = acc.name.padEnd(20);
    const email = acc.email.padEnd(46);
    const username = acc.username.padEnd(21);
    const password = acc.password.padEnd(15);
    const practice = acc.practice.padEnd(28);
    
    logDebug('App', 'Debug message', {});
  });
  
  logDebug('App', 'Debug output', { data: data: "placeholder" });
}

// Execute if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createDoctorAccounts().then(accounts => {
    if (accounts) {
      displayAccountsTable(accounts);
    }
  });
}