# 🔐 Bypass GitHub Secret Scanning

GitHub is blocking your push because of API keys in previous commits (git history).

## ⚡ Quick Fix - Allow the Push

**You must use the GitHub web interface to allow this push:**

### Step 1: Click this URL
```
https://github.com/RakeshEPC/tshla-medical/security/secret-scanning/unblock-secret/33UUaI7GFqigF0I7MuWABywgajY
```

### Step 2: Click "Allow secret" button

### Step 3: Return here and run:
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
git push origin main
```

---

## ⚠️ IMPORTANT: After Push Succeeds

The exposed API keys **MUST be rotated** (deleted and replaced):

### 1. OpenAI API Key
- Go to: https://platform.openai.com/api-keys
- **Delete** the old key (starts with `sk-proj-f03JLBSP...`)
- **Create** a new key
- **Update** your local `.env` file (NOT in git)

### 2. Deepgram API Key
- Go to: https://console.deepgram.com/
- **Delete** the old key (`b5ef4cbfc...`)
- **Create** a new key
- **Update** your local `.env` file

### 3. Supabase Keys
- Go to: https://supabase.com/dashboard/project/minvvjdflezibmgkplqb/settings/api
- Consider rotating the anon key and service role key

---

## 🛡️ What I've Already Fixed

✅ Removed `.env` from git tracking
✅ Added `.gitignore` to prevent future commits
✅ Created `.env.example` with placeholders
✅ Removed actual API keys from future commits

The issue is only with **historical commits** that GitHub remembers.

---

## 📝 To Restore Your Local .env File

After pushing, you'll need to recreate your local `.env` file:

```bash
# Copy the example
cp .env.example .env

# Then edit .env and add your API keys
# (Use new/rotated keys, not the old exposed ones!)
```

---

**Click the bypass URL above, then run `git push origin main`** ✅
