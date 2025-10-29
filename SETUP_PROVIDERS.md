# 🏥 Setup Providers for Athena Schedule Import

## Current Status
⚠️ **No providers found in `medical_staff` table**

You need to add providers to the database before the Athena schedule import will work properly.

---

## Option 1: Add Providers via Admin UI (Recommended)

### Steps:

1. **Start your dev server:**
```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
npm run dev
```

2. **Login as admin:**
   - Go to: `http://localhost:5173/login`
   - Use your admin credentials

3. **Go to Account Creation page:**
   - Navigate to: `http://localhost:5173/admin/create-accounts`
   - Click the **"Medical Staff"** tab

4. **Add each provider:**

Fill out the form for each provider:

**Example Provider 1:**
- First Name: `Rakesh`
- Last Name: `Patel`
- Email: `rakesh.patel@tshla.ai`
- Password: (generate or create)
- Role: `Doctor`
- Specialty: `Endocrinology`
- Practice: `TSHLA Medical`

**Example Provider 2:**
- First Name: `Veena`
- Last Name: `Watwe`
- Email: `veena.watwe@tshla.ai`
- Password: (generate or create)
- Role: `Doctor`
- Specialty: `Pediatrics`
- Practice: `TSHLA Medical`

5. **Click "Create Staff Account"** for each provider

6. **Verify in Supabase:**
   - Go to Supabase Dashboard → Table Editor
   - Open `medical_staff` table
   - You should see your providers listed

---

## Option 2: Add Providers Directly in Supabase

### Steps:

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Table Editor:**
   - Click "Table Editor" in left sidebar
   - Find and click `medical_staff` table

3. **Click "Insert row"**

4. **Fill in the data:**

**For each provider, add these fields:**

| Field | Example Value | Notes |
|-------|--------------|-------|
| `email` | `rakesh.patel@tshla.ai` | REQUIRED - Must be unique |
| `first_name` | `Rakesh` | REQUIRED |
| `last_name` | `Patel` | REQUIRED |
| `role` | `doctor` | REQUIRED - lowercase |
| `specialty` | `Endocrinology` | Optional but recommended |
| `practice` | `TSHLA Medical` | Optional |
| `is_active` | `true` | REQUIRED - Must be checked |

**Leave these blank (auto-generated):**
- `id` (auto-generated UUID)
- `created_at` (auto-set)
- `updated_at` (auto-set)

5. **Click "Save"**

6. **Repeat for all providers**

---

## Option 3: Bulk Insert via SQL (For Many Providers)

If you have many providers, you can insert them all at once:

### Steps:

1. **Open Supabase Dashboard → SQL Editor**

2. **Paste and modify this SQL:**

```sql
-- First, create Supabase Auth users (required for login)
-- Skip this if providers won't need to login

-- Then insert into medical_staff
INSERT INTO medical_staff (email, first_name, last_name, role, specialty, practice, is_active)
VALUES
  ('rakesh.patel@tshla.ai', 'Rakesh', 'Patel', 'doctor', 'Endocrinology', 'TSHLA Medical', true),
  ('veena.watwe@tshla.ai', 'Veena', 'Watwe', 'doctor', 'Pediatrics', 'TSHLA Medical', true),
  ('tess.chamakkala@tshla.ai', 'Tess', 'Chamakkala', 'doctor', 'Family Medicine', 'TSHLA Medical', true),
  ('radha.bernander@tshla.ai', 'Radha', 'Bernander', 'doctor', 'Internal Medicine', 'TSHLA Medical', true),
  ('shannon.gregroek@tshla.ai', 'Shannon', 'Gregroek', 'doctor', 'Pediatrics', 'TSHLA Medical', true),
  ('elinia.shakya@tshla.ai', 'Elinia', 'Shakya', 'doctor', 'Family Medicine', 'TSHLA Medical', true),
  ('nadia.younus@tshla.ai', 'Nadia', 'Younus', 'doctor', 'Internal Medicine', 'TSHLA Medical', true),
  ('ghislaine.tonye@tshla.ai', 'Ghislaine', 'Tonye', 'doctor', 'Family Medicine', 'TSHLA Medical', true),
  ('cindy.laverde@tshla.ai', 'Cindy', 'Laverde', 'doctor', 'Pediatrics', 'TSHLA Medical', true)
ON CONFLICT (email) DO NOTHING;
```

3. **Click "RUN"**

4. **Verify:**
```sql
SELECT id, first_name, last_name, email, specialty, role, is_active
FROM medical_staff
ORDER BY last_name;
```

You should see all your providers listed.

---

## After Adding Providers

### Update the Athena Parser Mapping:

Once you have providers in the database, run this command:

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
node scripts/update-provider-mapping.cjs
```

**Expected output:**
```
🚀 Starting provider mapping update...

🔍 Fetching providers from Supabase...
✅ Found 9 active providers
📝 Reading parser file...
💾 Updating parser file...
✅ Provider mapping updated successfully!

📋 Updated mappings for 9 providers:
   - Dr. Radha Bernander (Internal Medicine)
   - Dr. Tess Chamakkala (Family Medicine)
   - Dr. Shannon Gregroek (Pediatrics)
   - Dr. Cindy Laverde (Pediatrics)
   - Dr. Rakesh Patel (Endocrinology)
   - Dr. Elinia Shakya (Family Medicine)
   - Dr. Ghislaine Tonye (Family Medicine)
   - Dr. Veena Watwe (Pediatrics)
   - Dr. Nadia Younus (Internal Medicine)

✨ Done! The athenaScheduleParser.service.ts file has been updated.
```

This will automatically update the provider mapping in the Athena parser!

---

## Verify Provider Mapping

After running the update script, check the file:

**File:** `src/services/athenaScheduleParser.service.ts`

Around line 10-30, you should see:

```typescript
const PROVIDER_NAME_MAPPING: Record<string, { id: string; fullName: string; specialty?: string }> = {
  // Rakesh Patel
  'patel, rakesh': { id: 'abc123-...', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  'rakesh patel': { id: 'abc123-...', fullName: 'Dr. Rakesh Patel', specialty: 'Endocrinology' },
  // Veena Watwe
  'watwe, veena': { id: 'xyz789-...', fullName: 'Dr. Veena Watwe', specialty: 'Pediatrics' },
  'veena watwe': { id: 'xyz789-...', fullName: 'Dr. Veena Watwe', specialty: 'Pediatrics' },
  // ... more providers
};
```

---

## Common Provider Names from Your Athena System

Based on the original parser, these are the providers you likely have:

1. **Dr. Rakesh Patel** - Endocrinology
2. **Dr. Veena Watwe** - Pediatrics
3. **Dr. Tess Chamakkala** - Family Medicine
4. **Dr. Radha Bernander** - Internal Medicine
5. **Dr. Shannon Gregroek** - Pediatrics
6. **Dr. Elinia Shakya** - Family Medicine
7. **Kamili Wade-Reescano, LMFT** - Mental Health
8. **Dr. Nadia Younus** - Internal Medicine
9. **Dr. Ghislaine Tonye** - Family Medicine
10. **Dr. Cindy/Vanessa Laverde** - Pediatrics

**Add all providers that appear in your Athena schedule exports!**

---

## Next Steps After Adding Providers

1. ✅ Add all providers to `medical_staff` table (via UI or SQL)
2. ✅ Run: `node scripts/update-provider-mapping.cjs`
3. ✅ Verify provider mapping in parser file
4. ✅ Test Athena schedule upload
5. ✅ Upload a sample schedule file
6. ✅ Verify providers are recognized correctly

---

## Troubleshooting

**Q: Provider names not matching in Athena file?**

Check how provider names appear in your Athena export. Common formats:
- `LASTNAME, FIRSTNAME` (e.g., "PATEL, RAKESH")
- `Firstname Lastname` (e.g., "Rakesh Patel")
- `LASTNAME FIRSTNAME` (e.g., "PATEL RAKESH")

The parser handles all these variations automatically once mapped!

**Q: Can I add providers later?**

Yes! Just:
1. Add the new provider to `medical_staff` table
2. Run `node scripts/update-provider-mapping.cjs` again
3. The parser will be updated automatically

---

**Ready to proceed once you've added your providers!** 🚀
