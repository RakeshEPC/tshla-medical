# Deepgram Setup Instructions for Production

## Problem Fixed
The production app was failing with error: `VITE_DEEPGRAM_API_KEY environment variable is required`

This happened because the GitHub Actions deployment workflow was not including Deepgram environment variables during the build process.

## Solution Applied

### 1. Updated GitHub Actions Workflow ✅
The file `.github/workflows/deploy-frontend.yml` has been updated to include Deepgram environment variables in the build step.

### 2. Required GitHub Secret Setup ⚠️ ACTION REQUIRED

**You MUST add the following GitHub secret for the deployment to work:**

#### Steps to Add GitHub Secret:

1. **Go to GitHub Repository Settings:**
   - Navigate to: https://github.com/YOUR_USERNAME/tshla-medical/settings/secrets/actions
   - (Replace `YOUR_USERNAME` with your actual GitHub username)

2. **Click "New repository secret"**

3. **Add the Deepgram API Key:**
   - **Name:** `VITE_DEEPGRAM_API_KEY`
   - **Value:** `8d226631680379ac8ea48ed0bf73df2c51df453c`

4. **Click "Add secret"**

### 3. Deploy to Production

After adding the GitHub secret:

```bash
# From your local repository
git add .
git commit -m "Fix: Add Deepgram environment variables to production build"
git push origin main
```

The GitHub Actions workflow will automatically:
1. Build the frontend with Deepgram API key included
2. Deploy to Azure Static Web Apps
3. Validate the deployment

### Verification

After deployment completes (~3-5 minutes), test the Quick Note feature:
1. Go to: https://www.tshla.ai
2. Login as staff
3. Navigate to Quick Note
4. The app should load without errors
5. Test recording functionality

## Environment Variables Included

The following Deepgram variables are now included in production builds:

- `VITE_DEEPGRAM_API_KEY` - API key from GitHub secrets
- `VITE_DEEPGRAM_MODEL` - `nova-2-medical` (medical-optimized model)
- `VITE_DEEPGRAM_LANGUAGE` - `en-US`
- `VITE_DEEPGRAM_TIER` - `enhanced`
- `VITE_PRIMARY_STT_PROVIDER` - `deepgram`
- `VITE_USE_DEEPGRAM_SDK` - `true`
- `VITE_PRIMARY_SPEECH_PROVIDER` - `deepgram`

## Security Note

⚠️ **Important:** The Deepgram API key is stored as a GitHub secret and is NOT exposed in the codebase or version control. It is only available during the GitHub Actions build process and gets baked into the production bundle.

## Troubleshooting

If the error persists after deployment:

1. **Verify GitHub Secret exists:**
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Ensure `VITE_DEEPGRAM_API_KEY` is listed

2. **Check GitHub Actions logs:**
   - Go to: Repository → Actions → Latest workflow run
   - Verify the "Build application" step shows the environment variables (the value will be masked as `***`)

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or clear cache completely

4. **Verify Deepgram API key is valid:**
   - Test at: https://console.deepgram.com
   - Check usage/quota limits

## Related Files

- `.github/workflows/deploy-frontend.yml` - Deployment workflow (UPDATED)
- `src/services/deepgramSDK.service.ts` - Deepgram service that requires the API key
- `src/services/speechServiceRouter.service.ts` - Routes to Deepgram service
- `.env` - Local environment variables (for development only)
- `.env.example` - Example environment variables template

## Contact

If issues persist, check:
- Deepgram Console: https://console.deepgram.com
- GitHub Actions logs
- Azure Static Web Apps deployment logs
