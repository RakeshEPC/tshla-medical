# TSHLA Medical Server Management Guide

## ✅ Your Servers Are Now Persistent!

Your TSHLA Medical development servers are now managed by **PM2 (Process Manager 2)**, which means they will:

- ✅ **Keep running** even after you close your terminal or Claude Code
- ✅ **Auto-restart** if they crash
- ✅ **Survive computer restarts** (after one-time setup below)
- ✅ **Log everything** for debugging

---

## 🚀 Quick Start

### View Server Status
```bash
./manage-servers.sh status
```

### Start Servers
```bash
./manage-servers.sh start
```

### Stop Servers
```bash
./manage-servers.sh stop
```

### Restart Servers
```bash
./manage-servers.sh restart
```

### View Logs
```bash
./manage-servers.sh logs          # All logs
./manage-servers.sh logs-api      # API only
./manage-servers.sh logs-frontend # Frontend only
```

---

## 🌐 Access Your Application

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:3005 |
| **API Documentation** | http://localhost:3005/ |
| **PumpDrive Login** | http://localhost:5173/pumpdrive/login |

---

## 🔐 Test Login Credentials

| Field | Value |
|-------|-------|
| **Email** | demo@pumpdrive.com |
| **Password** | Demo1234! |

---

## 🔧 Server Configuration

### Current Setup
- **Process Manager:** PM2 v6.0.13
- **Frontend Port:** 5173 (Vite dev server)
- **Backend Port:** 3005 (Express API)
- **Database:** MySQL on localhost:3306
- **Database Name:** tshla_medical_local

### Files
- **PM2 Config:** `ecosystem.config.cjs`
- **Management Script:** `manage-servers.sh`
- **Startup Script:** `pm2-setup-startup.sh`

---

## 🎯 One-Time Setup: Auto-Start on Boot (Optional)

To make your servers automatically start when your Mac boots up:

```bash
./pm2-setup-startup.sh
```

This requires sudo password and only needs to be done once.

---

## 📊 PM2 Commands (Direct)

If you prefer using PM2 directly:

```bash
# List all processes
pm2 list

# View logs
pm2 logs

# Monitor resources
pm2 monit

# Restart a specific service
pm2 restart tshla-pump-api
pm2 restart tshla-frontend

# Stop everything
pm2 stop all

# Delete all processes
pm2 delete all

# Save current process list
pm2 save

# View saved processes
pm2 resurrect
```

---

## 🐛 Troubleshooting

### Servers not responding?
```bash
./manage-servers.sh test
```

### Check what's using the ports
```bash
lsof -i :5173  # Frontend
lsof -i :3005  # Backend
```

### Restart everything fresh
```bash
pm2 delete all
./manage-servers.sh start
```

### Check MySQL is running
```bash
brew services list | grep mysql
```

### View server logs
```bash
# Real-time logs
pm2 logs

# Log files location
ls -la logs/
```

---

## 🎓 Why PM2?

**Before PM2:**
- Servers stopped when terminal closed ❌
- Had to manually restart after crashes ❌
- Lost logs between sessions ❌
- No monitoring or management ❌

**With PM2:**
- Servers run in background ✅
- Auto-restart on crashes ✅
- Persistent logging ✅
- Easy monitoring and control ✅
- Can start on system boot ✅

---

## 📝 Environment Variables

The servers use environment variables from:
1. `.env` file (for Vite frontend)
2. `ecosystem.config.cjs` (for PM2 processes)

Key variables:
```
VITE_PUMP_API_URL=http://localhost:3005
DB_HOST=localhost
DB_DATABASE=tshla_medical_local
JWT_SECRET=tshla-unified-jwt-secret-2025-enhanced-secure-key
```

---

## 🔄 Updating Code

After making code changes:

```bash
# Restart to pick up changes
./manage-servers.sh restart

# Or restart individual services
pm2 restart tshla-pump-api      # Backend only
pm2 restart tshla-frontend      # Frontend only
```

Note: The frontend (Vite) supports hot module reload, so most changes appear automatically without restart.

---

## 📁 Log Files

PM2 creates log files in the `logs/` directory:

```
logs/
├── frontend-error.log
├── frontend-out.log
├── frontend-combined.log
├── pump-api-error.log
├── pump-api-out.log
└── pump-api-combined.log
```

View them with:
```bash
tail -f logs/pump-api-combined.log
```

---

## 🎉 All Set!

Your servers are now running persistently. You can:

1. Close this terminal/Claude Code session
2. Your servers will keep running
3. Access them anytime at http://localhost:5173

**Need help?** Run: `./manage-servers.sh` (no arguments) to see all commands.
