# TSHLA Medical - Quick Account Setup Guide

## 🚀 Get Started in 3 Steps

### Step 1: Create Your First Admin Account

Run this command once:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npx tsx scripts/setup-admin-accounts.ts
```

Choose option 1 to create default admins. You'll get:

**Admin Credentials:**
- Email: `admin@tshla.ai`
- Password: `TshlaAdmin2025!`

### Step 2: Login as Admin

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to: **http://localhost:5173/login**

3. Login with:
   - Email: `admin@tshla.ai`
   - Password: `TshlaAdmin2025!`
   - Verification Code: `000000` (or any 6-digit code in dev mode)

### Step 3: Create All Other Accounts via Web UI

Navigate to: **http://localhost:5173/admin/account-manager**

Now you can create accounts with a beautiful web interface! 🎨

---

## 📝 Account Types You Can Create

### 1️⃣ Admin Accounts
- **Who**: System administrators
- **Access**: Everything (account management, all features)
- **Login**: `/login` with email/password

### 2️⃣ Medical Staff (Doctors, Nurses, Staff)
- **Who**: Healthcare providers
- **Access**: Patient records, dictation, clinical tools
- **Login**: `/login` with email/password
- **Features**:
  - Medical dictation with AI transcription
  - Patient note creation
  - SOAP note templates
  - All clinical features

### 3️⃣ Patients
- **Who**: Your patients
- **Access**: Patient portal, their own records
- **Login**: `/patient-login` with AVA ID or email
- **Features**:
  - PumpDrive (insulin pump selection tool) - optional
  - View their medical records
  - Access health information

---

## 🎯 Creating Accounts via Admin UI

### Admin Account
1. Select "Admin" type
2. Enter email, password, name
3. Click "Create Account"
4. **Save the credentials!**

### Doctor/Staff Account
1. Select "Staff" type
2. Enter email, password, name
3. Choose role (doctor/nurse/staff)
4. Set specialty and practice
5. Click "Create Account"
6. **They can now login and use dictation!**

### Patient Account
1. Select "Patient" type
2. Enter email, password, name
3. Toggle "Enable PumpDrive Access" if needed
4. Click "Create Account"
5. **Important**: Save the AVA ID shown (e.g., AVA 123-456)
6. **Patient can login with AVA ID - no password needed!**

---

## 🔐 Login URLs

| Account Type | Login URL | Credentials |
|-------------|-----------|-------------|
| Admin | `/login` | Email + Password + 6-digit code |
| Doctor/Staff | `/login` | Email + Password + 6-digit code |
| Patient | `/patient-login` | AVA ID (no password) or Email |

---

## ✨ Key Features

### For Admins
- ✅ Create accounts via web UI
- ✅ Password generator included
- ✅ View all accounts
- ✅ Manage users
- ✅ Access all system features

### For Medical Staff
- ✅ AI-powered medical dictation
- ✅ Real-time transcription
- ✅ SOAP note generation
- ✅ Patient management
- ✅ Template library
- ✅ Saves notes to Supabase database

### For Patients
- ✅ Simple AVA ID login (no password!)
- ✅ PumpDrive insulin pump selection
- ✅ View their health records
- ✅ Secure HIPAA-compliant access

---

## 🔧 Technical Details

### Database
All accounts are stored in **Supabase**:
- `auth.users` - Authentication (email/password)
- `medical_staff` - Doctors, nurses, admins
- `patients` - All patients (includes PumpDrive flag)
- `access_logs` - HIPAA compliance logging

### Authentication Flow
1. User enters credentials
2. Supabase Auth validates
3. System fetches profile (medical_staff or patients)
4. User redirected to appropriate dashboard
5. Session maintained for seamless access

### Data Persistence
- ✅ All dictations saved to Supabase
- ✅ Patient records stored securely
- ✅ PumpDrive results saved
- ✅ Notes persist across sessions
- ✅ HIPAA-compliant audit logging

---

## 🆘 Need Help?

### Common Issues

**"I can't access /admin/account-manager"**
- Make sure you're logged in as an admin
- Admin role must be set correctly in database

**"Patient can't login with AVA ID"**
- Make sure you saved the AVA ID (format: AVA 123-456)
- Try email login instead
- Check patient account is active in database

**"Dictation not saving"**
- Check Supabase connection
- Verify medical staff account is properly set up
- Check browser console for errors

### Get More Help

- Full documentation: `scripts/README.md`
- Check your Supabase dashboard
- Review access_logs table for login attempts

---

## 🎉 You're All Set!

Your account system is ready with:
- ✅ Admin UI for easy account creation
- ✅ Separate login flows for staff and patients
- ✅ Supabase database integration
- ✅ HIPAA-compliant logging
- ✅ Working dictation and PumpDrive features
- ✅ Secure password generation
- ✅ AVA ID system for patients

**Recommended Next Steps:**
1. Create your admin account (Step 1 above)
2. Login and explore the Admin UI
3. Create a test doctor account
4. Create a test patient account
5. Test the login flows
6. Try the dictation feature as a doctor
7. Test PumpDrive as a patient

Enjoy your TSHLA Medical platform! 🚀

---

**Quick Reference:**

```bash
# Create first admin
npx tsx scripts/setup-admin-accounts.ts

# Start dev server
npm run dev

# Admin login
http://localhost:5173/login
Email: admin@tshla.ai
Password: TshlaAdmin2025!

# Create more accounts
http://localhost:5173/admin/account-manager
```

That's it! 🎊
