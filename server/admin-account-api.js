/**
 * TSHLA Medical - Admin Account Creation API
 * Uses Supabase Service Role to bypass RLS for account creation
 * Created: October 8, 2025
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const app = express();
const PORT = process.env.ADMIN_ACCOUNT_PORT || 3004;

// Supabase client with SERVICE ROLE (bypasses RLS for admin operations)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Supabase client with ANON KEY (for JWT token validation)
const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'https://www.tshla.ai',
      'https://mango-sky-0ba265c0f.1.azurestaticapps.net',
    ],
    credentials: true,
  })
);
app.use(express.json());

// Verify admin middleware
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    // Verify the token with Supabase (use anon key client for JWT validation)
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      logger.warn('AdminAccount', 'Token validation failed', { error: error?.message });
      return res.status(401).json({ error: 'Invalid token' });
    }

    logger.info('AdminAccount', 'Token validated');

    // Get the medical_staff record to check role
    const { data: staffData, error: staffError } = await supabase
      .from('medical_staff')
      .select('role, id, email')
      .eq('auth_user_id', user.id)
      .single();

    if (staffError || !staffData) {
      return res.status(403).json({ error: 'Staff profile not found' });
    }

    // Check if user is admin or super_admin
    if (staffData.role !== 'admin' && staffData.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Attach user info to request
    req.user = staffData;
    next();
  } catch (error) {
    logger.error('AdminAccount', 'Auth middleware error', { error: error.message });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Generate AVA ID for patients
function generateAvaId() {
  const part1 = Math.floor(Math.random() * 900 + 100);
  const part2 = Math.floor(Math.random() * 900 + 100);
  return `AVA ${part1}-${part2}`;
}

// Generate MRN (Medical Record Number) for patients
function generateMrn() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `MRN-${date}-${random}`;
}

// POST /api/accounts/create - Create new account (admin, staff, or patient)
app.post('/api/accounts/create', verifyAdmin, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      accountType,
      role,
      specialty,
      practice,
      phoneNumber,
      dateOfBirth,
      enablePumpDrive,
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !accountType) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    // Step 1: Create auth user with auto-confirm
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        account_type: accountType,
      },
    });

    if (authError) {
      logger.error('AdminAccount', 'Auth creation error', { error: authError.message });
      return res.status(400).json({
        error: `Failed to create auth user: ${authError.message}`,
      });
    }

    if (!authData.user) {
      return res.status(500).json({
        error: 'No user data returned from authentication',
      });
    }

    // Step 2: Create profile record
    let profileData = null;
    let avaId = null;

    if (accountType === 'admin' || accountType === 'staff') {
      // Create medical_staff record
      const { data, error: staffError } = await supabase
        .from('medical_staff')
        .insert({
          email,
          username: email.split('@')[0],
          first_name: firstName,
          last_name: lastName,
          role: accountType === 'admin' ? 'admin' : role || 'staff',
          specialty: specialty || 'General',
          practice: practice || 'TSHLA Medical',
          auth_user_id: authData.user.id,
          is_active: true,
          is_verified: accountType === 'admin',
          created_by: req.user.id,
        })
        .select()
        .single();

      if (staffError) {
        logger.error('AdminAccount', 'Staff creation error', { error: staffError.message });
        // Clean up auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({
          error: `Failed to create staff profile: ${staffError.message}`,
        });
      }

      profileData = data;
    } else {
      // Create patient record
      avaId = generateAvaId();
      const mrn = generateMrn();

      const { data, error: patientError } = await supabase
        .from('patients')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phoneNumber,
          date_of_birth: dateOfBirth,
          ava_id: avaId,
          mrn: mrn,
          auth_user_id: authData.user.id,
          is_active: true,
          pumpdrive_enabled: enablePumpDrive !== false,
          pumpdrive_signup_date: enablePumpDrive !== false ? new Date().toISOString() : null,
          subscription_tier: 'free',
        })
        .select()
        .single();

      if (patientError) {
        logger.error('AdminAccount', 'Patient creation error', { error: patientError.message });
        // Clean up auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({
          error: `Failed to create patient profile: ${patientError.message}`,
        });
      }

      profileData = data;
    }

    // Step 3: Log the account creation
    await supabase.from('access_logs').insert({
      user_id: authData.user.id,
      user_email: email,
      user_type: accountType,
      action: 'ADMIN_ACCOUNT_CREATED',
      success: true,
      created_at: new Date().toISOString(),
    });

    // Return success
    res.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: profileData.id,
        email,
        accountType,
        avaId,
      },
    });
  } catch (error) {
    logger.error('AdminAccount', 'Account creation error', { error: error.message });
    res.status(500).json({
      error: 'Failed to create account',
      details: error.message,
    });
  }
});

// GET /api/accounts/list - List all accounts with filtering
app.get('/api/accounts/list', verifyAdmin, async (req, res) => {
  try {
    const { accountType, search } = req.query;

    // Get medical staff
    let staffQuery = supabase
      .from('medical_staff')
      .select('id, email, first_name, last_name, role, specialty, practice, is_active, created_at, auth_user_id');

    if (accountType && (accountType === 'admin' || accountType === 'staff')) {
      staffQuery = staffQuery.eq('role', accountType);
    }

    if (search) {
      staffQuery = staffQuery.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    const { data: staffData, error: staffError } = await staffQuery;

    if (staffError) {
      logger.error('AdminAccount', 'Staff query error', { error: staffError.message });
      return res.status(500).json({ error: 'Failed to fetch staff accounts' });
    }

    // Get patients
    let patientQuery = supabase
      .from('patients')
      .select('id, email, first_name, last_name, ava_id, phone, pumpdrive_enabled, subscription_tier, is_active, created_at, auth_user_id');

    if (accountType === 'patient') {
      patientQuery = patientQuery.eq('pumpdrive_enabled', false);
    } else if (accountType === 'pumpdrive') {
      patientQuery = patientQuery.eq('pumpdrive_enabled', true);
    }

    if (search) {
      patientQuery = patientQuery.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,ava_id.ilike.%${search}%`);
    }

    const { data: patientData, error: patientError } = await patientQuery;

    if (patientError) {
      logger.error('AdminAccount', 'Patient query error', { error: patientError.message });
      return res.status(500).json({ error: 'Failed to fetch patient accounts' });
    }

    // Format response
    const accounts = [
      ...staffData.map(s => ({
        ...s,
        accountType: s.role === 'admin' || s.role === 'super_admin' ? 'admin' : 'staff',
        fullName: `${s.first_name} ${s.last_name}`,
      })),
      ...patientData.map(p => ({
        ...p,
        accountType: p.pumpdrive_enabled ? 'pumpdrive' : 'patient',
        fullName: `${p.first_name} ${p.last_name}`,
      })),
    ];

    res.json({
      success: true,
      accounts: accounts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      total: accounts.length,
    });
  } catch (error) {
    logger.error('AdminAccount', 'List accounts error', { error: error.message });
    res.status(500).json({ error: 'Failed to list accounts', details: error.message });
  }
});

// POST /api/accounts/reset-password - Reset password for any account
app.post('/api/accounts/reset-password', verifyAdmin, async (req, res) => {
  try {
    const { authUserId, email } = req.body;

    if (!authUserId && !email) {
      return res.status(400).json({ error: 'Either authUserId or email is required' });
    }

    // Generate new secure password
    const newPassword = generateSecurePassword();

    // Find user by auth_user_id or email
    let userId = authUserId;

    if (!userId && email) {
      // Try to find in medical_staff
      const { data: staffData } = await supabase
        .from('medical_staff')
        .select('auth_user_id')
        .eq('email', email)
        .single();

      if (staffData) {
        userId = staffData.auth_user_id;
      } else {
        // Try to find in patients
        const { data: patientData } = await supabase
          .from('patients')
          .select('auth_user_id')
          .eq('email', email)
          .single();

        if (patientData) {
          userId = patientData.auth_user_id;
        }
      }
    }

    if (!userId) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Update password using admin API
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      logger.error('AdminAccount', 'Password reset error', { error: error.message });
      return res.status(500).json({ error: 'Failed to reset password', details: error.message });
    }

    // Log the password reset
    await supabase.from('access_logs').insert({
      user_id: userId,
      user_email: email,
      action: 'ADMIN_PASSWORD_RESET',
      success: true,
      created_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
      newPassword,
    });
  } catch (error) {
    logger.error('AdminAccount', 'Reset password error', { error: error.message });
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// Helper function to generate secure password
function generateSecurePassword() {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%&*';
  const allChars = uppercase + lowercase + numbers + symbols;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-account-api' });
});

// Start server (only if running directly, not when imported)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.startup('Admin Account API', { port: PORT });
  });
}

// Export app for use in unified server
module.exports = app;
