# DoctorTemplates Page Fixes

## Issues Fixed

### Issue 1: Template Save Failing with "Medical staff record not found"

**Problem**: When creating a new template on `/templates/doctor`, the save would fail with error:
```
❌ Failed to save template: Medical staff record not found
```

**Root Cause**:
- **[DoctorTemplates.tsx:64](src/pages/DoctorTemplates.tsx#L64)** was setting:
  ```typescript
  id: currentUser.email || currentUser.id || 'default-doctor'
  ```
- This passed the email address (e.g., "rakesh@tshla.ai") to `doctorProfileService.createTemplate()`
- **[doctorProfile.service.ts:472](src/services/doctorProfile.service.ts#L472)** then tried to look up:
  ```typescript
  .eq('auth_user_id', effectiveDoctorId)  // Looking for email in auth_user_id
  ```
- But `medical_staff.auth_user_id` contains the Supabase UUID, not the email
- Lookup failed → "Medical staff record not found"

**Solution**:
Changed line 64 to prioritize the actual auth user ID:
```typescript
id: currentUser.id || currentUser.email || 'default-doctor'
```

Now it passes the correct Supabase UUID that matches `medical_staff.auth_user_id`.

### Issue 2: Back Arrow Logs Out User

**Problem**: Clicking the back arrow (←) on `/templates/doctor` would navigate to `/doctor`, which doesn't exist, causing the user to be logged out or redirected to login.

**Root Cause**:
- **[DoctorTemplates.tsx:658](src/pages/DoctorTemplates.tsx#L658)** had:
  ```typescript
  onClick={() => navigate('/doctor')}
  ```
- The route `/doctor` doesn't exist in **[App.tsx:147-158](src/App.tsx#L147-L158)**
- The actual dashboard route is `/dashboard`

**Solution**:
Changed line 658 to navigate to the correct dashboard:
```typescript
onClick={() => navigate('/dashboard')}
```

Now clicking the back arrow properly returns to `DoctorDashboardUnified`.

## Files Modified

- **[src/pages/DoctorTemplates.tsx](src/pages/DoctorTemplates.tsx)**
  - Line 64: Changed `currentUser.email || currentUser.id` → `currentUser.id || currentUser.email`
  - Line 658: Changed `navigate('/doctor')` → `navigate('/dashboard')`

## Deployment

- **Commit**: `472dcf45` - "Fix DoctorTemplates: use auth ID and correct dashboard navigation"
- **GitHub Actions**: Run #18564327279 ✅ **SUCCESS**
- **Deployed**: October 16, 2025
- **Production URL**: https://mango-sky-0ba265c0f.1.azurestaticapps.net/templates/doctor

## Testing

To verify the fixes:

### Test 1: Template Creation
1. ✅ Navigate to https://www.tshla.ai/templates/doctor
2. ✅ Click "New Template"
3. ✅ Fill in template details (name, sections, instructions)
4. ✅ Click "Save Template"
5. ✅ Template should save successfully to Supabase
6. ✅ No "Medical staff record not found" error

### Test 2: Back Button Navigation
1. ✅ On `/templates/doctor` page
2. ✅ Click the back arrow (←) button
3. ✅ Should navigate to `/dashboard`
4. ✅ User should remain logged in
5. ✅ Dashboard should load normally

## Related Files

- [src/services/doctorProfile.service.ts](src/services/doctorProfile.service.ts:470-529) - Template creation logic
- [src/App.tsx](src/App.tsx:147-158) - Dashboard route definition
- [src/services/supabaseAuth.service.ts](src/services/supabaseAuth.service.ts) - Authentication service

## Notes

- The `/templates` page (TemplatesPage.tsx) is a different component than `/templates/doctor` (DoctorTemplates.tsx)
- DoctorTemplates uses `doctorProfileService` which talks directly to Supabase
- TemplatesPage uses the HTTP API at `/api/templates` endpoint
- Both pages now work correctly after today's fixes
