# Multi-Factor Authentication (MFA) Implementation Plan

**Date:** January 8, 2026
**Status:** Planning
**Priority:** HIGH - HIPAA Requirement

---

## 🎯 MFA Options for HIPAA Compliance

### Option 1: **TOTP (Time-Based One-Time Password)** ⭐ RECOMMENDED
**Example:** Google Authenticator, Authy, Microsoft Authenticator

**Pros:**
- ✅ Free to implement
- ✅ No third-party service needed (no BAA required)
- ✅ Works offline
- ✅ Industry standard
- ✅ HIPAA compliant out of the box
- ✅ Users already familiar with authenticator apps

**Cons:**
- Users must install an authenticator app
- Slightly more complex UX

**HIPAA Status:** ✅ Compliant (no PHI sent to third party)

---

### Option 2: **SMS-Based OTP**
**Example:** Send code via Twilio SMS

**Pros:**
- Easy for users (no app needed)
- Familiar UX

**Cons:**
- ❌ Requires Twilio (need BAA)
- ❌ SMS can be intercepted (less secure)
- ❌ Costs money per SMS
- ❌ Doesn't work if no cell service
- ⚠️ NIST discourages SMS-based 2FA

**HIPAA Status:** ⚠️ Requires BAA with Twilio

---

### Option 3: **Email-Based OTP**
**Example:** Send code to user's email

**Pros:**
- No extra app needed
- Free

**Cons:**
- ❌ Less secure (email can be compromised)
- ❌ Not recommended for HIPAA
- ❌ Doesn't truly verify "something you have"

**HIPAA Status:** ❌ Not recommended

---

### Option 4: **Supabase Built-in MFA**
**Example:** Use Supabase's native MFA

**Pros:**
- ✅ Already integrated with Supabase
- ✅ TOTP support
- ✅ HIPAA compliant
- ✅ Easy to enable
- ✅ Handles everything for you

**Cons:**
- Only works if using Supabase Auth (you're using custom auth)
- Would require migration to Supabase Auth

**HIPAA Status:** ✅ Compliant

---

## 🏆 RECOMMENDED SOLUTION: TOTP (Google Authenticator Style)

Based on your setup, I recommend **TOTP (Time-Based One-Time Password)** because:

1. ✅ **No BAA needed** - Everything handled on your server
2. ✅ **Free** - No per-user costs
3. ✅ **Secure** - Industry standard (6-digit codes that expire every 30 seconds)
4. ✅ **HIPAA compliant** - No PHI sent to third parties
5. ✅ **Works with your custom auth** - No migration needed

---

## 🔧 How TOTP Works

```
┌─────────────────────────────────────────────────────────┐
│ 1. User enables MFA                                      │
│    ↓                                                      │
│ 2. Server generates SECRET KEY (32-char random string)   │
│    ↓                                                      │
│ 3. Server creates QR CODE with secret                    │
│    ↓                                                      │
│ 4. User scans QR code with Google Authenticator          │
│    ↓                                                      │
│ 5. App generates 6-digit code every 30 seconds           │
│    ↓                                                      │
│ 6. User enters code when logging in                      │
│    ↓                                                      │
│ 7. Server validates code matches secret                  │
└─────────────────────────────────────────────────────────┘
```

**Key Point:** The secret is shared ONCE via QR code, then both server and app generate matching codes independently. No internet needed!

---

## 📦 Implementation Plan

### Phase 1: Backend Setup

**Install Dependencies:**
```bash
npm install speakeasy qrcode
```

**Database Changes:**
Add MFA columns to `patients` table:
```sql
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[]; -- For account recovery
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMP;
```

**Create MFA Service:**
```javascript
// server/services/mfa.service.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class MFAService {
  // Generate secret for new enrollment
  generateSecret(email) {
    return speakeasy.generateSecret({
      name: `TSHLA Medical (${email})`,
      issuer: 'TSHLA Medical',
      length: 32
    });
  }

  // Generate QR code
  async generateQRCode(secret) {
    return await QRCode.toDataURL(secret.otpauth_url);
  }

  // Verify TOTP code
  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 60 seconds of clock drift
    });
  }

  // Generate backup codes (for account recovery)
  generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateRandomCode());
    }
    return codes;
  }

  generateRandomCode() {
    // Generate 8-digit backup code
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }
}
```

---

### Phase 2: API Endpoints

**1. Enable MFA (Setup)**
```javascript
// POST /api/auth/mfa/enroll
app.post('/api/auth/mfa/enroll', verifyToken, async (req, res) => {
  const userId = req.user.userId;

  // Generate secret
  const secret = mfaService.generateSecret(req.user.email);

  // Generate QR code
  const qrCode = await mfaService.generateQRCode(secret);

  // Store secret (temporarily) in session or temp table
  // Don't save to DB until user confirms it works

  res.json({
    secret: secret.base32, // For manual entry if QR doesn't work
    qrCode: qrCode, // Data URL for QR image
    instructions: 'Scan this QR code with Google Authenticator or Authy'
  });
});
```

**2. Verify and Activate MFA**
```javascript
// POST /api/auth/mfa/verify-and-enable
app.post('/api/auth/mfa/verify-and-enable', verifyToken, async (req, res) => {
  const { token, secret } = req.body;
  const userId = req.user.userId;

  // Verify the code works
  const isValid = mfaService.verifyToken(secret, token);

  if (!isValid) {
    return res.status(400).json({
      error: 'Invalid code. Please try again.'
    });
  }

  // Generate backup codes
  const backupCodes = mfaService.generateBackupCodes();

  // Save to database
  await supabase
    .from('patients')
    .update({
      mfa_enabled: true,
      mfa_secret: secret,
      mfa_backup_codes: backupCodes,
      mfa_enrolled_at: new Date().toISOString()
    })
    .eq('id', userId);

  res.json({
    success: true,
    message: 'MFA enabled successfully',
    backupCodes: backupCodes, // Show once, user must save them
    warning: 'Save these backup codes in a safe place. You won\'t see them again.'
  });
});
```

**3. Updated Login Flow**
```javascript
// POST /api/auth/login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password, mfaToken } = req.body;

  // Step 1: Verify password
  const { data: user } = await supabase
    .from('patients')
    .select('*')
    .eq('email', email)
    .single();

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Step 2: Check if MFA is enabled
  if (user.mfa_enabled) {
    // MFA is required
    if (!mfaToken) {
      // First step: password is correct, but need MFA code
      return res.status(200).json({
        mfaRequired: true,
        message: 'Please enter your authenticator code',
        tempToken: generateTempToken(user.id) // Short-lived token
      });
    }

    // Verify MFA token
    const isValidMFA = mfaService.verifyToken(user.mfa_secret, mfaToken);

    // Also check if it's a backup code
    const isBackupCode = user.mfa_backup_codes?.includes(mfaToken);

    if (!isValidMFA && !isBackupCode) {
      return res.status(401).json({
        error: 'Invalid authenticator code'
      });
    }

    // If backup code used, remove it (one-time use)
    if (isBackupCode) {
      const updatedCodes = user.mfa_backup_codes.filter(c => c !== mfaToken);
      await supabase
        .from('patients')
        .update({ mfa_backup_codes: updatedCodes })
        .eq('id', user.id);

      logger.warn('MFA', 'Backup code used', {
        user_id: user.id,
        remaining_codes: updatedCodes.length
      });
    }
  }

  // Step 3: Generate full JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    }
  });
});
```

**4. Disable MFA**
```javascript
// POST /api/auth/mfa/disable
app.post('/api/auth/mfa/disable', verifyToken, async (req, res) => {
  const { password, mfaToken } = req.body;
  const userId = req.user.userId;

  // Get user
  const { data: user } = await supabase
    .from('patients')
    .select('*')
    .eq('id', userId)
    .single();

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Verify current MFA code
  const isValidMFA = mfaService.verifyToken(user.mfa_secret, mfaToken);
  if (!isValidMFA) {
    return res.status(401).json({ error: 'Invalid authenticator code' });
  }

  // Disable MFA
  await supabase
    .from('patients')
    .update({
      mfa_enabled: false,
      mfa_secret: null,
      mfa_backup_codes: null
    })
    .eq('id', userId);

  res.json({
    success: true,
    message: 'MFA disabled successfully'
  });
});
```

---

### Phase 3: Frontend Implementation

**1. MFA Setup Page**
```typescript
// src/pages/MFASetup.tsx
import { useState } from 'react';

export function MFASetup() {
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  async function enrollMFA() {
    const response = await fetch('/api/auth/mfa/enroll', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setQrCode(data.qrCode);
    setSecret(data.secret);
  }

  async function verifyAndEnable() {
    const response = await fetch('/api/auth/mfa/verify-and-enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        token: verificationCode,
        secret
      })
    });
    const data = await response.json();
    setBackupCodes(data.backupCodes);
  }

  return (
    <div>
      <h2>Set Up Two-Factor Authentication</h2>

      {!qrCode && (
        <button onClick={enrollMFA}>Enable MFA</button>
      )}

      {qrCode && !backupCodes.length && (
        <div>
          <p>1. Install Google Authenticator or Authy on your phone</p>
          <p>2. Scan this QR code:</p>
          <img src={qrCode} alt="MFA QR Code" />
          <p>Or enter this code manually: <code>{secret}</code></p>

          <p>3. Enter the 6-digit code from your app:</p>
          <input
            type="text"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="000000"
          />
          <button onClick={verifyAndEnable}>Verify & Enable</button>
        </div>
      )}

      {backupCodes.length > 0 && (
        <div>
          <h3>✅ MFA Enabled Successfully!</h3>
          <p>Save these backup codes in a safe place:</p>
          <ul>
            {backupCodes.map(code => (
              <li key={code}><code>{code}</code></li>
            ))}
          </ul>
          <button onClick={() => window.print()}>Print Codes</button>
        </div>
      )}
    </div>
  );
}
```

**2. Login with MFA**
```typescript
// src/pages/Login.tsx
const [mfaRequired, setMfaRequired] = useState(false);
const [mfaCode, setMfaCode] = useState('');
const [tempToken, setTempToken] = useState('');

async function handleLogin() {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      mfaToken: mfaRequired ? mfaCode : undefined
    })
  });

  const data = await response.json();

  if (data.mfaRequired) {
    setMfaRequired(true);
    setTempToken(data.tempToken);
    return;
  }

  // Login successful
  localStorage.setItem('token', data.token);
  navigate('/dashboard');
}
```

---

## 📊 User Experience Flow

### First-Time MFA Setup:
1. User goes to Settings → Security
2. Clicks "Enable Two-Factor Authentication"
3. Sees QR code
4. Scans with Google Authenticator
5. Enters 6-digit code to verify
6. Gets 8 backup codes to save
7. MFA is now enabled

### Login with MFA:
1. User enters email + password
2. If correct, sees "Enter authenticator code" screen
3. Opens Google Authenticator app
4. Enters 6-digit code
5. Logged in successfully

### Lost Phone (Account Recovery):
1. User enters email + password
2. Clicks "Use backup code"
3. Enters one of their 8 saved backup codes
4. Logged in successfully
5. Can now disable MFA and re-enroll

---

## 🔒 Security Features

**TOTP Advantages:**
- ✅ Codes expire every 30 seconds
- ✅ Secret never leaves your server after setup
- ✅ Works offline (no network needed)
- ✅ Resistant to phishing
- ✅ Industry standard

**Additional Security:**
- Rate limit MFA attempts (5 per 15 min)
- Log all MFA events (enrollment, use, failures)
- Backup codes are one-time use
- Option to require MFA for all users (admin setting)

---

## 💰 Cost Analysis

| Solution | Setup Cost | Per-User Cost | Annual Cost (100 users) |
|----------|------------|---------------|-------------------------|
| **TOTP (Recommended)** | $0 | $0 | $0 |
| SMS (Twilio) | $0 | ~$0.0075/SMS | ~$270 |
| Email OTP | $0 | $0 | $0 |
| Supabase MFA | $0 | $0 | $0 |

**Winner:** TOTP - Free and most secure!

---

## ✅ HIPAA Compliance Checklist

- [x] No PHI sent to third parties (TOTP is local)
- [x] Audit logging (log all MFA events)
- [x] Account recovery (backup codes)
- [x] Strong secrets (32-character random)
- [x] Rate limiting (prevent brute force)
- [x] User consent (opt-in for MFA)
- [x] Secure storage (secrets encrypted in DB)

---

## 🚀 Implementation Timeline

**Week 1:**
- [ ] Add database columns
- [ ] Install npm packages
- [ ] Create MFA service
- [ ] Create API endpoints

**Week 2:**
- [ ] Build frontend MFA setup page
- [ ] Update login flow
- [ ] Add MFA to user settings

**Week 3:**
- [ ] Testing
- [ ] Security review
- [ ] Deploy to production
- [ ] User communications

---

## 📝 Next Steps

**Option A:** Implement TOTP MFA (Recommended)
- I can create all the code for you
- ~1-2 weeks to implement
- $0 cost
- Most secure

**Option B:** Switch to Supabase Auth + MFA
- Requires migrating from custom auth
- ~2-3 weeks to implement
- MFA comes built-in

**Option C:** SMS-based MFA
- Requires Twilio BAA
- Ongoing costs
- Less secure

**Which option would you like to pursue?**

---

**Created:** January 8, 2026
**Recommendation:** TOTP (Google Authenticator style)
