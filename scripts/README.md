# TSHLA Medical - Account Creation Guide

This guide explains how to create and manage user accounts for the TSHLA Medical platform.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Account Types](#account-types)
- [Using the Admin UI (Recommended)](#using-the-admin-ui-recommended)
- [Using Scripts](#using-scripts)
- [Login Information](#login-information)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Option 1: Admin UI (Easiest) ✅

1. **Create your first admin account** (one-time setup):
   ```bash
   cd /Users/rakeshpatel/Desktop/tshla-medical
   npx tsx scripts/setup-admin-accounts.ts
   ```

2. **Login as admin**:
   - Go to: http://localhost:5173/login
   - Use the credentials from step 1

3. **Create all other accounts**:
   - Navigate to: http://localhost:5173/admin/account-manager
   - Use the web interface to create admin, staff, and patient accounts

### Option 2: Scripts

Use the command-line scripts if you prefer terminal-based account creation.

---

## Account Types

### 🔐 Admin Accounts
- **Access**: Full system access, account management, all features
- **Can do**: Create accounts, manage users, access all clinical features
- **Login URL**: `/login`
- **Login method**: Email + Password + Verification Code

### 👨‍⚕️ Medical Staff Accounts
- **Roles**: Doctor, Nurse, Staff
- **Access**: Patient records, dictation, clinical features
- **Can do**: Create notes, access patient data, use dictation tools
- **Login URL**: `/login`
- **Login method**: Email + Password + Verification Code

### 🧑 Patient Accounts
- **Access**: Patient portal, personal health data
- **Can do**: View their records, access PumpDrive (if enabled)
- **Login URL**: `/patient-login`
- **Login methods**:
  - AVA ID (format: AVA 123-456)
  - Email (no password required for AVA login)
- **PumpDrive**: Optional feature for insulin pump selection

---

## Using the Admin UI (Recommended)

### Step 1: Initial Setup

First, create your admin account using the setup script:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npx tsx scripts/setup-admin-accounts.ts
```

Follow the prompts:
- Choose option 1 (default admins) or 2 (custom admin)
- Save the credentials shown

**Default Admin Credentials:**
- Email: `admin@tshla.ai`
- Password: `TshlaAdmin2025!`

### Step 2: Access Admin Panel

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:5173/login

3. Login with your admin credentials

4. Go to: http://localhost:5173/admin/account-manager

### Step 3: Create Accounts via UI

The Account Manager UI allows you to:

#### Create Admin Accounts
1. Select "Admin" as account type
2. Fill in email, password, name
3. Set role (admin/super_admin)
4. Optionally set specialty
5. Click "Create Account"

#### Create Medical Staff
1. Select "Staff" as account type
2. Fill in email, password, name
3. Choose role (doctor/nurse/staff)
4. Set specialty and practice
5. Click "Create Account"

#### Create Patients
1. Select "Patient" as account type
2. Fill in email, password, name
3. Optionally add phone and date of birth
4. Toggle "Enable PumpDrive Access" if needed
5. Click "Create Account"
6. **Save the AVA ID** - it's shown only once!

### Features of the Admin UI

- **Password Generator**: Click 🔐 button to generate secure passwords
- **Instant Feedback**: See results immediately
- **Credential Display**: Credentials shown after creation (save them!)
- **Account Type Toggle**: Easy switching between account types
- **Form Validation**: Built-in validation for required fields

---

## Using Scripts

### Setup Admin Accounts

Creates initial admin accounts for platform access.

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npx tsx scripts/setup-admin-accounts.ts
```

**Interactive menu:**
1. Create default admin accounts
2. Create custom admin account
3. Create both

**Default accounts created:**
- `admin@tshla.ai` - Admin User
- `rakesh.patel@tshla.ai` - Super Admin

### Create Regular Accounts

Creates medical staff and patient accounts in bulk.

```bash
npx tsx scripts/create-accounts.ts
```

This script creates:
- 2 doctor accounts
- 1 nurse account
- 3 patient accounts (2 with PumpDrive, 1 without)

**Edit the script** to customize the accounts created.

### Customizing Scripts

To create your own accounts, edit the arrays in `scripts/create-accounts.ts`:

```typescript
// Add your medical staff
const staffAccounts: StaffAccount[] = [
  {
    email: 'your.doctor@tshla.ai',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
    role: 'doctor',
    specialty: 'Cardiology',
    practice: 'TSHLA Medical'
  }
];

// Add your patients
const patientAccounts: PatientAccount[] = [
  {
    email: 'patient@example.com',
    password: 'Patient123!',
    firstName: 'Jane',
    lastName: 'Smith',
    phoneNumber: '555-0100',
    dateOfBirth: '1990-01-01',
    enablePumpDrive: true
  }
];
```

---

## Login Information

### Admin & Medical Staff Login

**URL**: http://localhost:5173/login

**Login Options:**
1. **Email Login**:
   - Email address
   - Password
   - 6-digit verification code

2. **Quick Access** (development only):
   - Use predefined access codes

**After Login:**
- Admins → Admin dashboard
- Doctors → Doctor dashboard with dictation tools
- Staff → Appropriate workflow dashboard

### Patient Login

**URL**: http://localhost:5173/patient-login

**Login Options:**
1. **AVA ID**:
   - Format: `AVA 123-456`
   - No password required

2. **Email**:
   - Patient's email address
   - No password required

**After Login:**
- PumpDrive patients → PumpDrive assessment
- Regular patients → Patient dashboard

---

## Database Tables

Accounts are stored in Supabase:

### medical_staff table
- Stores: Doctors, nurses, staff, admins
- Key fields: email, role, specialty, practice, auth_user_id
- Links to: auth.users (Supabase Auth)

### patients table
- Stores: All patients (unified)
- Key fields: email, ava_id, pumpdrive_enabled, auth_user_id
- Links to: auth.users (Supabase Auth)

### access_logs table
- HIPAA compliance: All logins and account creations logged
- Key fields: user_id, action, timestamp

---

## Troubleshooting

### "User already exists"
The email is already registered. Try:
1. Use a different email
2. Reset the password (admin only)
3. Check if account exists in Supabase dashboard

### "Failed to create medical_staff record"
The auth user was created but profile creation failed:
1. Check Supabase dashboard for the auth user
2. Manually delete the auth user
3. Try creating account again

### Can't login after creating account
1. **Staff/Admin**: Make sure you have the 6-digit verification code
2. **Patient**: Use AVA ID instead of email
3. Check that account is marked as `is_active: true`

### Admin UI not accessible
1. Ensure you're logged in as an admin
2. Check `user.role === 'admin'` in your session
3. Navigate directly to `/admin/account-manager`

### Scripts not running
1. Make sure you're in the project directory
2. Install dependencies: `npm install`
3. Check that tsx is available: `npx tsx --version`

---

## Environment Variables

Required for account creation:

```env
VITE_SUPABASE_URL=https://minvvjdflezibmgkplqb.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

These are pre-configured in your `.env` file.

---

## Security Best Practices

1. **Change Default Passwords**: After first login, change all default passwords
2. **Use Strong Passwords**: Minimum 12 characters, mix of upper/lower/numbers/symbols
3. **Store Credentials Securely**: Use a password manager
4. **Limit Admin Access**: Only create admin accounts for trusted users
5. **Enable MFA**: Consider adding multi-factor authentication
6. **Regular Audits**: Check access_logs table regularly

---

## Support

### Getting Help

- **Documentation**: This README
- **Code**: Check inline comments in scripts
- **Issues**: Create an issue in the repository
- **Admin UI**: Use the web interface for easier account management

### Quick Links

- Admin UI: http://localhost:5173/admin/account-manager
- Provider Login: http://localhost:5173/login
- Patient Login: http://localhost:5173/patient-login
- Supabase Dashboard: https://app.supabase.com

---

## Summary

**Recommended Workflow:**

1. **One-time setup**: Run `npx tsx scripts/setup-admin-accounts.ts`
2. **Login as admin**: http://localhost:5173/login
3. **Create all accounts**: Use http://localhost:5173/admin/account-manager
4. **Save credentials**: Keep them in a secure location
5. **Distribute logins**: Send credentials to users securely

**That's it!** You now have a fully functional account management system with UI and scripts.

---

## Example Account Creation via Admin UI

### Creating a Doctor

1. Login as admin → Navigate to `/admin/account-manager`
2. Select "Staff" account type
3. Fill in:
   - Email: `dr.smith@tshla.ai`
   - Password: Click 🔐 to generate
   - First Name: `John`
   - Last Name: `Smith`
   - Role: `doctor`
   - Specialty: `Internal Medicine`
   - Practice: `TSHLA Medical`
4. Click "Create Account"
5. **Save the credentials shown!**

### Creating a PumpDrive Patient

1. In Account Manager, select "Patient" account type
2. Fill in:
   - Email: `patient@example.com`
   - Password: Click 🔐 to generate
   - First Name: `Jane`
   - Last Name: `Doe`
   - Phone: `555-0100`
   - Date of Birth: Select from calendar
   - ✅ Enable PumpDrive Access (checked)
3. Click "Create Account"
4. **Save the AVA ID, email, and password!**

Patient can now login at `/patient-login` using their AVA ID.

---

Made with ❤️ for TSHLA Medical
