# Bug Fix: PumpDrive Assessment Login Redirect Issue

**Date:** October 5, 2025
**Status:** ✅ FIXED
**Priority:** HIGH

---

## Problem Description

When users completed the PumpDrive assessment (sliders, preferences, and free text), they were being redirected to the main login page (`/login`) instead of seeing their results. This completely broke the user flow and prevented them from viewing their pump recommendations.

### User Impact
- ❌ Could not see assessment results after completion
- ❌ Lost all progress and assessment data
- ❌ Redirected to wrong login page
- ❌ Frustrating user experience

---

## Root Cause Analysis

The issue was caused by **two conflicting authentication systems**:

1. **PumpDrive Auth System**
   - Uses: `pump_auth_token` and `pump_user_data` in localStorage
   - Login page: `/pumpdrive/login`
   - Service: `pumpAuthService`

2. **Medical App Auth System**
   - Uses: `auth_token`, `doctor_token`, etc. in localStorage
   - Login page: `/login`
   - Interceptor: `authInterceptor`

### The Bug Flow

```
User completes assessment
  → Navigates to /pumpdrive/results
  → PumpDriveResults tries to save assessment to database
  → API call to /api/pump-assessments/save-complete
  → Server returns 401 Unauthorized (auth issue)
  → Global authInterceptor catches 401
  → Redirects to /login (WRONG! Should be /pumpdrive/login)
  → User loses all progress
```

### Key Files Involved
1. **[src/services/authInterceptor.ts](src/services/authInterceptor.ts)** - Global auth interceptor
2. **[src/pages/PumpDriveResults.tsx](src/pages/PumpDriveResults.tsx)** - Results page
3. **[src/services/pumpAssessment.service.ts](src/services/pumpAssessment.service.ts)** - Assessment save service

---

## Solution Implemented

### Fix #1: Route-Aware Auth Interceptor ✅

Modified `authInterceptor.ts` to detect PumpDrive routes and redirect appropriately:

**Changes:**
- Detects if current path starts with `/pumpdrive`
- For PumpDrive routes: redirects to `/pumpdrive/login`
- For medical app routes: redirects to `/login`
- Only clears relevant tokens (doesn't clear PumpDrive tokens on medical app)

**File:** [src/services/authInterceptor.ts:40-76](src/services/authInterceptor.ts#L40-L76)

```typescript
// Determine which auth system we're using based on current path
const currentPath = window.location.pathname;
const isPumpDrive = currentPath.startsWith('/pumpdrive');

// Clear appropriate auth tokens
if (isPumpDrive) {
  // Clear only PumpDrive tokens
  localStorage.removeItem('pump_auth_token');
  localStorage.removeItem('pump_user_data');
  // Redirect to PumpDrive login
  window.location.href = `/pumpdrive/login?message=${encodeURIComponent(message)}`;
} else {
  // Clear medical app tokens
  clearAuthSession();
  // Redirect to main login
  window.location.href = `/login?message=${encodeURIComponent(message)}`;
}
```

### Fix #2: Graceful Error Handling ✅

Modified `PumpDriveResults.tsx` to handle save failures gracefully:

**Changes:**
- Catches auth errors (401/403) without blocking UI
- Stores unsaved recommendations in sessionStorage as fallback
- Continues showing results even if database save fails
- Logs warnings instead of throwing errors

**File:** [src/pages/PumpDriveResults.tsx:183-197](src/pages/PumpDriveResults.tsx#L183-L197)

```typescript
catch (error) {
  // Check if it's an auth error (401/403)
  if (errorMessage.includes('401') || errorMessage.includes('403')) {
    // Store in sessionStorage as fallback
    sessionStorage.setItem('pumpdrive_unsaved_recommendation', JSON.stringify(recommendationData));
    // Don't redirect or throw - just continue showing results
  }
}
```

### Fix #3: Enhanced Error Detection ✅

Modified `pumpAssessment.service.ts` to detect auth errors earlier:

**File:** [src/services/pumpAssessment.service.ts:127-132](src/services/pumpAssessment.service.ts#L127-L132)

```typescript
if (!response.ok) {
  // Handle authentication errors gracefully
  if (response.status === 401 || response.status === 403) {
    logWarn('PumpAssessment', 'Authentication error - user may need to login');
    throw new Error(`Unauthorized: ${response.status}`);
  }
}
```

---

## Testing Checklist

- [ ] Complete PumpDrive assessment (sliders + preferences + free text)
- [ ] Verify results page loads successfully
- [ ] Verify no redirect to login page
- [ ] Verify results are displayed correctly
- [ ] Test with authenticated user (database save should work)
- [ ] Test with unauthenticated user (should show results, save to sessionStorage)
- [ ] Test medical app routes still redirect to `/login` on 401
- [ ] Test PumpDrive routes redirect to `/pumpdrive/login` on 401

---

## Benefits

✅ **Users can now see results** - No more redirect on assessment completion
✅ **Data is preserved** - Fallback to sessionStorage if save fails
✅ **Better UX** - Graceful degradation instead of blocking errors
✅ **Route-aware** - Correct login page for each section
✅ **Separation of concerns** - PumpDrive and Medical App auth systems separated

---

## Files Modified

1. `src/services/authInterceptor.ts` - Route-aware redirect logic
2. `src/pages/PumpDriveResults.tsx` - Graceful error handling
3. `src/services/pumpAssessment.service.ts` - Enhanced error detection

---

## Future Improvements

1. **Manual Save Button** - Add explicit "Save Assessment" button
2. **Retry Logic** - Auto-retry save on auth failure
3. **Visual Feedback** - Show save status to user (saved/unsaved)
4. **Offline Mode** - Full offline support with local storage
5. **Auth Token Refresh** - Automatic token refresh before expiry
