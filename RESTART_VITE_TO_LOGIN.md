# Quick Fix: Restart Vite to Login

## The Problem

The frontend is trying to connect to `http://localhost:3000` but your server is on `http://localhost:3001`.

I've already fixed the `.env` file by adding:
```
VITE_API_BASE_URL=http://localhost:3001
```

## ✅ Solution: Restart Vite (30 seconds)

### Option 1: Restart in Your Terminal

1. Find the terminal where Vite is running
2. Press **Ctrl+C** to stop it
3. Run: `npm run dev`
4. Wait for "Local: http://localhost:5173"

### Option 2: Kill and Restart via Command

```bash
# Kill Vite
pkill -f "node.*vite"

# Start Vite
cd /Users/rakeshpatel/Desktop/tshla-medical
npm run dev
```

---

## 🎉 Then Login!

Once Vite restarts:

1. Open: **http://localhost:5173/patient-portal-login**
2. Enter:
   - **Phone**: `555-999-8888`
   - **PIN**: `247700`
3. Click **Login**
4. **Success!** 🚀

---

## Why This Happened

- Your unified API server runs on port **3001**
- The frontend was defaulting to port **3000**
- Environment variables in Vite require a restart to take effect

---

## Your Login Credentials (Reminder)

```
Phone: 555-999-8888
PIN: 247700
Patient ID: PT-2025-0002
```

**After restarting Vite, you'll be able to login!**
