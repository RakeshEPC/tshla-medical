/**
 * Browser Compatibility Utilities
 * Detects and handles browser-specific privacy/storage limitations
 * Especially important for Chrome's strict privacy settings
 */

export interface BrowserCompatibility {
  isLocalStorageAvailable: boolean;
  isSessionStorageAvailable: boolean;
  isCookiesEnabled: boolean;
  browser: string;
  needsStorageWarning: boolean;
}

/**
 * Detect browser type
 */
export const detectBrowser = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
    return 'Chrome';
  } else if (userAgent.includes('firefox')) {
    return 'Firefox';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return 'Safari';
  } else if (userAgent.includes('edge')) {
    return 'Edge';
  }

  return 'Unknown';
};

/**
 * Test if localStorage is available and accessible
 */
export const testLocalStorage = (): boolean => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('localStorage is not available:', e);
    return false;
  }
};

/**
 * Test if sessionStorage is available and accessible
 */
export const testSessionStorage = (): boolean => {
  try {
    const testKey = '__session_test__';
    sessionStorage.setItem(testKey, 'test');
    sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('sessionStorage is not available:', e);
    return false;
  }
};

/**
 * Test if cookies are enabled
 */
export const testCookies = (): boolean => {
  try {
    document.cookie = 'cookietest=1; SameSite=Lax';
    const hasCookies = document.cookie.indexOf('cookietest=') !== -1;
    document.cookie = 'cookietest=; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    return hasCookies;
  } catch (e) {
    console.warn('Cookies are not available:', e);
    return false;
  }
};

/**
 * Get full browser compatibility report
 */
export const checkBrowserCompatibility = (): BrowserCompatibility => {
  const isLocalStorageAvailable = testLocalStorage();
  const isSessionStorageAvailable = testSessionStorage();
  const isCookiesEnabled = testCookies();
  const browser = detectBrowser();

  // Show warning if Chrome has storage blocked
  const needsStorageWarning = browser === 'Chrome' && (!isLocalStorageAvailable || !isCookiesEnabled);

  const result = {
    isLocalStorageAvailable,
    isSessionStorageAvailable,
    isCookiesEnabled,
    browser,
    needsStorageWarning,
  };

  console.log('🔍 Browser Compatibility Check:', result);

  return result;
};

/**
 * Get user-friendly instructions for enabling storage/cookies
 */
export const getStorageEnableInstructions = (browser: string): string => {
  switch (browser) {
    case 'Chrome':
      return `Chrome is blocking cookies or storage. To fix this:
1. Click the lock icon in the address bar
2. Click "Site settings"
3. Under "Permissions", set "Cookies" to "Allow"
4. Refresh the page

Alternatively:
1. Open Chrome Settings
2. Search for "cookies"
3. Select "Allow all cookies" or add tshla.ai to allowed sites`;

    case 'Firefox':
      return `Firefox is blocking cookies or storage. To fix this:
1. Click the shield icon in the address bar
2. Turn off "Enhanced Tracking Protection" for this site
3. Refresh the page`;

    case 'Safari':
      return `Safari is blocking cookies or storage. To fix this:
1. Open Safari Preferences
2. Go to Privacy tab
3. Uncheck "Prevent cross-site tracking"
4. Refresh the page`;

    default:
      return `Your browser is blocking cookies or storage. Please check your browser settings to allow cookies and storage for this site.`;
  }
};

/**
 * Show browser compatibility warning to user
 */
export const showCompatibilityWarning = (): void => {
  const compat = checkBrowserCompatibility();

  if (compat.needsStorageWarning) {
    const instructions = getStorageEnableInstructions(compat.browser);
    console.error(`
⚠️ STORAGE BLOCKED
${instructions}
    `);
  }
};
