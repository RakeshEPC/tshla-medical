/**
 * TSHLA Medical - Admin Account Creation API
 * Uses Supabase Service Role to bypass RLS for account creation
 * Created: October 8, 2025
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.ADMIN_ACCOUNT_PORT || 3004;

// Supabase client with SERVICE ROLE (bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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

    // Verify the token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

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
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Generate AVA ID for patients
function generateAvaId() {
  const part1 = Math.floor(Math.random() * 900 + 100);
  const part2 = Math.floor(Math.random() * 900 + 100);
  return `AVA ${part1}-${part2}`;
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
      console.error('Auth creation error:', authError);
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
        console.error('Staff creation error:', staffError);
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

      const { data, error: patientError } = await supabase
        .from('patients')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phoneNumber,
          date_of_birth: dateOfBirth,
          ava_id: avaId,
          auth_user_id: authData.user.id,
          is_active: true,
          pumpdrive_enabled: enablePumpDrive !== false,
          pumpdrive_signup_date: enablePumpDrive !== false ? new Date().toISOString() : null,
          subscription_tier: 'free',
        })
        .select()
        .single();

      if (patientError) {
        console.error('Patient creation error:', patientError);
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
    console.error('Account creation error:', error);
    res.status(500).json({
      error: 'Failed to create account',
      details: error.message,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-account-api' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔐 Admin Account API running on port ${PORT}`);
  console.log(`📝 Endpoint: http://localhost:${PORT}/api/accounts/create`);
});

module.exports = app;
