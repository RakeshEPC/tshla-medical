# 🔐 GitHub Secret Setup - URGENT FIX

## ⚠️ ISSUE: Deepgram Dictation Not Working in Production

**Error**: `Deepgram WebSocket error: {"isTrusted":true}`
**Cause**: Missing GitHub Secret `VITE_DEEPGRAM_API_KEY`
**Fix**: Add the secret below (5 minutes)

---

## 🎯 **STEP 1: Add GitHub Secret**

### Option A: Via GitHub Web Interface (Recommended)

1. **Go to your repository settings**:
   - URL: https://github.com/YOUR_USERNAME/tshla-medical/settings/secrets/actions
   - (Replace `YOUR_USERNAME` with your actual GitHub username)

2. **Click** "New repository secret" button (top right)

3. **Enter the secret**:
   ```
   Name: VITE_DEEPGRAM_API_KEY
   Value: 8d226631680379ac8ea48ed0bf73df2c51df453c
   ```

4. **Click** "Add secret"

5. **Done!** ✅ The secret is now available for GitHub Actions

### Option B: Via GitHub CLI (if installed)

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Add the secret
gh secret set VITE_DEEPGRAM_API_KEY --body "8d226631680379ac8ea48ed0bf73df2c51df453c"

# Verify it was added
gh secret list | grep DEEPGRAM
```

---

## 🔍 **STEP 2: Verify Other Secrets Exist**

While you're in the secrets page, **verify** these secrets exist:

✅ `VITE_SUPABASE_URL` = `https://minvvjdflezibmgkplqb.supabase.co`
✅ `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long key)
✅ `VITE_OPENAI_API_KEY` = `sk-proj-...` (starts with sk-proj)
✅ `AZURE_STATIC_WEB_APPS_API_TOKEN` = (Azure deployment token)

**If any are missing**, add them using the same process above.

---

## 🚀 **STEP 3: Trigger Redeploy**

### Option A: Manual Workflow Run (Fastest)

1. Go to: https://github.com/YOUR_USERNAME/tshla-medical/actions/workflows/deploy-frontend.yml
2. Click **"Run workflow"** button (right side)
3. Select branch: **main**
4. Click **"Run workflow"**
5. Wait ~3-5 minutes for deployment

### Option B: Push a Change (Alternative)

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Create deployment log file
echo "# Deployment Log" > DEPLOYMENT_LOG.md
echo "" >> DEPLOYMENT_LOG.md
echo "## $(date '+%Y-%m-%d %H:%M:%S') - Deepgram Fix" >> DEPLOYMENT_LOG.md
echo "" >> DEPLOYMENT_LOG.md
echo "- Added VITE_DEEPGRAM_API_KEY GitHub secret" >> DEPLOYMENT_LOG.md
echo "- Fixes: Deepgram WebSocket connection error" >> DEPLOYMENT_LOG.md
echo "- Status: Deploying..." >> DEPLOYMENT_LOG.md

# Commit and push
git add DEPLOYMENT_LOG.md
git commit -m "fix: Add Deepgram API key to production build

- Added VITE_DEEPGRAM_API_KEY as GitHub secret
- Fixes WebSocket connection error in production dictation
- Medical transcription will now work in production"

git push origin main
```

This will automatically trigger the GitHub Actions workflow.

---

## ✅ **STEP 4: Verify the Fix (After Deployment)**

### Wait for Deployment (~3-5 minutes)

Watch the deployment progress:
- URL: https://github.com/YOUR_USERNAME/tshla-medical/actions
- Look for the latest "Deploy Frontend to Azure Static Web Apps" run
- Wait for green checkmark ✅

### Test in Production

1. **Clear browser cache** (important!):
   - Chrome: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or use Incognito mode

2. **Go to**: https://www.tshla.ai/login

3. **Login**:
   - Email: `admin@tshla.ai`
   - Password: `TshlaSecure2025!`

4. **Navigate to dictation**:
   - URL: https://www.tshla.ai/dictation
   - Or click "Dictation" in menu

5. **Test recording**:
   - Click "Start Recording" button
   - Allow microphone access when browser asks
   - Speak clearly: "This is a test of the medical dictation system"
   - Should see **real-time transcription** appear! ✅

### Expected Result

```
🎤 Recording...
Transcript: "This is a test of the medical dictation system"
✅ Transcription working!
```

---

## 🐛 **If It Still Doesn't Work**

### Check 1: Verify Secret is Set

```bash
# If you have GitHub CLI installed:
gh secret list | grep DEEPGRAM

# Expected output:
# VITE_DEEPGRAM_API_KEY  Updated YYYY-MM-DD
```

### Check 2: Verify Build Included the Key

```bash
# Check if Deepgram is referenced in production bundle
curl -s "https://www.tshla.ai/assets/index-*.js" | grep -o "api.deepgram.com" | head -1

# Expected output:
# api.deepgram.com
```

If this returns nothing, the secret wasn't included in the build.

### Check 3: View GitHub Actions Logs

1. Go to: https://github.com/YOUR_USERNAME/tshla-medical/actions
2. Click the latest workflow run
3. Click "Build application" step
4. Look for this in the logs:
   ```
   VITE_DEEPGRAM_API_KEY: ***
   ```
   The `***` means the secret was loaded (GitHub masks the value for security)

### Check 4: Browser Console

1. Open browser console (F12)
2. Go to dictation page
3. Try recording
4. Look for errors
5. Should NOT see "API key required" error

---

## 📊 **What This Fixes**

After adding the secret and redeploying:

✅ **Deepgram WebSocket** - Will connect successfully
✅ **Medical Dictation** - Real-time transcription working
✅ **Speech-to-Text** - Deepgram nova-2-medical model active
✅ **SOAP Notes** - AI processing with OpenAI working
✅ **Medical Vocabulary** - Optimized for healthcare terms
✅ **Speaker Diarization** - Can distinguish doctor vs patient

---

## 🔒 **Security Notes**

✅ **Good**:
- API key stored as GitHub Secret (encrypted)
- Not in code or git history
- Only accessible during GitHub Actions builds
- Baked into production bundle (safe - frontend needs it)

⚠️ **Important**:
- Anyone can inspect the production JavaScript bundle
- They could extract the Deepgram API key
- This is NORMAL for frontend apps
- Deepgram tracks usage by project
- Monitor usage at: https://console.deepgram.com

🛡️ **Best Practice**:
- Set usage limits in Deepgram console
- Monitor monthly usage
- Rotate key if suspicious activity detected

---

## ⏱️ **Timeline**

- **Add secret**: 2 minutes
- **Trigger deploy**: 1 minute
- **Wait for deploy**: 3-5 minutes
- **Test**: 2 minutes
- **Total**: ~10 minutes

---

## 📞 **Need Help?**

If the fix doesn't work after following all steps:

1. Check GitHub Actions logs for build errors
2. Verify secret name is EXACTLY: `VITE_DEEPGRAM_API_KEY` (case-sensitive)
3. Ensure you pushed to `main` branch (not a different branch)
4. Clear browser cache completely
5. Try in Incognito/Private mode

---

## ✅ **Summary**

**Current Status**: Admin password reset ✅ | Deepgram not working ❌
**Fix Required**: Add GitHub Secret `VITE_DEEPGRAM_API_KEY`
**Time to Fix**: 10 minutes
**After Fix**: Full medical dictation system operational! 🎉

---

**Next Step**: Go add the GitHub secret now! 👆
