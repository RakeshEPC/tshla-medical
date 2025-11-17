# Get Your PIN in 3 Steps (2 Minutes Total)

## Step 1: Run SQL in Supabase (1 minute)

1. Go to https://supabase.com/dashboard
2. Select project `minvvjdflezibmgkplqb`
3. Click **SQL Editor** → **New Query**
4. Open `database/migrations/unified-patients-consolidation.sql`
5. Copy **ALL** (Cmd+A, Cmd+C)
6. Paste into Supabase
7. Click **RUN**
8. Wait for "Success"

---

## Step 2: Create Test Patient (30 seconds)

```bash
cd /Users/rakeshpatel/Desktop/tshla-medical
node create-test-patient-direct.cjs
```

Look for:
```
PIN: 847392  ← Copy this!
Phone: (555) 999-8888
```

---

## Step 3: Login! (30 seconds)

1. Open: `http://localhost:5173/patient-portal-login`
2. Enter phone: `555-999-8888`
3. Enter PIN: (from Step 2)
4. Click Login
5. **You're in!** 🎉

---

## Troubleshooting

**SQL fails with "table doesn't exist"**
- This is fine! Some NOTICE messages are normal
- As long as you see "Success" at the end, you're good

**Script fails with "table doesn't exist"**
- Make sure you ran the SQL in Step 1 first
- Make sure it said "Success"

**Login says "Invalid credentials"**
- Double-check the phone number: `555-999-8888`
- Double-check the PIN from the script output
- Make sure you copied it exactly

---

## That's It!

**3 steps, 2 minutes, and you have a working patient login!**

For more details, see:
- [SQL_READY_TO_RUN.md](SQL_READY_TO_RUN.md) - What the SQL does
- [HOW_TO_LOGIN_AS_PATIENT.md](HOW_TO_LOGIN_AS_PATIENT.md) - Full login guide
- [FRONTEND_COMPLETE.md](FRONTEND_COMPLETE.md) - Complete system overview
