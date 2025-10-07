# Quick Start: Supabase Migration

**Time Required**: 30 minutes
**Difficulty**: Easy
**Status**: Ready to begin

---

## 🎯 What We've Done Already

✅ Removed hardcoded credentials from code
✅ Updated environment configuration
✅ Created migration documentation
✅ Created export scripts
✅ Fixed security issues

---

## 🚀 Your Next Steps (30 min)

### Step 1: Create Supabase Project (10 min)

1. **Go to** https://supabase.com
2. **Click** "Start your project" → Sign up (free)
3. **Create New Project**:
   - Name: `tshla-medical-prod`
   - Database Password: (generate strong password)
   - Region: `East US (Ohio)` or closest to you
   - Click "Create new project"
4. **Wait ~2 minutes** for project to be created

### Step 2: Get Your Credentials (2 min)

1. **In Supabase Dashboard**, go to: **Settings** → **API**
2. **Copy these 2 values**:
   - Project URL: `https://xxxxx.supabase.co`
   - anon public key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 3: Create .env File (3 min)

1. **In your project folder**, create `.env` file:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical

# Create .env file
cat > .env << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Copy the rest from .env.example
# (You can open .env.example and copy the other variables)
EOF
```

2. **Edit `.env`** and paste your real Supabase values

### Step 4: Run Database Schema (10 min)

1. **In Supabase Dashboard**, click: **SQL Editor**
2. **Click**: "New query"
3. **Copy SQL** from `SUPABASE_MIGRATION_GUIDE.md` (lines 64-296)
4. **Paste** into SQL Editor
5. **Click**: "Run" button
6. **Verify**: Go to **Table Editor**, you should see:
   - medical_staff
   - pump_users
   - access_logs

### Step 5: Create Your Admin Account (5 min)

1. **In Supabase Dashboard**, go to: **Authentication** → **Users**
2. **Click**: "Add user"
3. **Fill in**:
   - Email: `your-email@tshla.ai`
   - Password: (choose a strong password)
   - Auto Confirm Email: ✅ CHECK THIS
4. **Click**: "Create user"
5. **Copy the User ID** (UUID like: `a1b2c3d4-...`)

6. **Go to SQL Editor**, run this (replace USER-ID):

```sql
INSERT INTO public.medical_staff (
  email,
  username,
  first_name,
  last_name,
  role,
  auth_user_id,
  is_active,
  is_verified
) VALUES (
  'your-email@tshla.ai',
  'admin',
  'Your',
  'Name',
  'admin',
  'PASTE-USER-ID-HERE',  -- Replace with UUID from step 5
  true,
  true
);
```

---

## ✅ That's It!

You now have:
- ✅ Supabase project created
- ✅ Database tables created
- ✅ Admin user created
- ✅ Credentials in .env file

---

## 🧪 Test It

```bash
# Start the dev server
npm run dev

# Try logging in with:
# Email: your-email@tshla.ai
# Password: (the password you chose)
```

**Note**: Login won't work yet because the auth services still need to be updated. That's the next development task!

---

## 🆘 Troubleshooting

### "Missing Supabase configuration" error
**Problem**: `.env` file not loaded
**Solution**:
1. Make sure `.env` file exists in project root
2. Restart dev server: `npm run dev`

### Can't see tables in Table Editor
**Problem**: SQL didn't run successfully
**Solution**:
1. Go to SQL Editor
2. Check for error messages
3. Run the schema SQL again

### User created but can't link to medical_staff
**Problem**: Wrong user ID
**Solution**:
1. Go to Authentication → Users
2. Click on your user
3. Copy the ID (it's at the top)
4. Use that exact UUID in the SQL

---

## 📚 Full Documentation

- **Complete Guide**: [SUPABASE_MIGRATION_GUIDE.md](SUPABASE_MIGRATION_GUIDE.md)
- **Progress Tracker**: [SUPABASE_MIGRATION_PROGRESS.md](SUPABASE_MIGRATION_PROGRESS.md)
- **Security Audit**: [SECURITY_AUDIT_AND_MIGRATION_SUMMARY.md](SECURITY_AUDIT_AND_MIGRATION_SUMMARY.md)

---

## 🎯 Next Development Tasks

After you complete this setup:

1. Update `src/services/unifiedAuth.service.ts` to use Supabase Auth
2. Update `src/services/medicalAuth.service.ts` to use Supabase Auth
3. Update `src/services/pumpAuth.service.ts` to use Supabase Auth
4. Test login flows
5. Migrate existing users from Azure MySQL

See [SUPABASE_MIGRATION_PROGRESS.md](SUPABASE_MIGRATION_PROGRESS.md) for detailed next steps!

---

**Created**: October 6, 2025
**Estimated Time**: 30 minutes
**Status**: Ready to begin! 🚀
