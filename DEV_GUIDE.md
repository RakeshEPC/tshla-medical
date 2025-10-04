# TSHLA Medical Development Guide

## Quick Start

### Starting the Development Environment

**Single command to start everything:**
```bash
./start-dev.sh
```

This will:
- ✅ Load environment variables from `.env`
- ✅ Kill any existing processes on ports 3002, 3003, 5173-5175
- ✅ Start Medical Auth API on port 3003
- ✅ Start Pump Report API on port 3002
- ✅ Start Frontend Dev Server (usually port 5173)
- ✅ Ensure all APIs use the same JWT_SECRET

### Stopping Services

```bash
./stop-dev.sh
```

### Restarting APIs Only (without restarting frontend)

```bash
./restart-apis.sh
```

## Service URLs

- **Frontend**: http://localhost:5173 (or 5174/5175 if 5173 is busy)
- **Medical Auth API**: http://localhost:3003
- **Pump Report API**: http://localhost:3002

## Health Checks

Verify services are running correctly:

```bash
# Check Medical Auth API
curl http://localhost:3003/api/medical/health | python3 -m json.tool

# Check Pump Report API
curl http://localhost:3002/api/health | python3 -m json.tool
```

Both should return `status: "ok"` and matching `secretHash` values in the JWT section.

## Viewing Logs

```bash
# Medical Auth API logs
tail -f logs/medical-auth-api.log

# Pump Report API logs
tail -f logs/pump-report-api.log

# Frontend Dev Server logs
tail -f logs/vite-dev.log
```

## Authentication Flow

### Automatic Error Recovery

The frontend now automatically handles authentication errors:

1. **401/403 errors** are caught automatically
2. **localStorage is cleared** automatically
3. **User is redirected to login** with a friendly message
4. **No manual intervention required**

### Login Credentials (Development)

```
Email: admin@tshla.ai
Password: admin123
```

### How It Works

1. All fetch requests are intercepted by `authInterceptor.ts`
2. If a 401/403 error occurs:
   - Auth tokens are cleared from localStorage
   - User is redirected to `/login`
   - Message: "Your session has expired. Please login again."
3. After login, user gets a fresh token that works with all APIs

## Common Development Tasks

### Adding a New API Endpoint

1. Add endpoint to `server/medical-auth-api.js` or `server/pump-report-api.js`
2. Restart APIs: `./restart-apis.sh`
3. Test endpoint
4. Frontend will automatically use the new endpoint

### Updating Environment Variables

1. Edit `.env` file
2. Restart all services: `./stop-dev.sh && ./start-dev.sh`
3. Verify with health checks

### JWT Secret Verification

Both APIs must use the same JWT_SECRET. To verify:

```bash
# Check both APIs have matching secretHash
curl -s http://localhost:3003/api/medical/health | grep secretHash
curl -s http://localhost:3002/api/health | grep secretHash
```

If the hashes don't match, restart with `./start-dev.sh` to reload environment variables.

## Troubleshooting

### "Failed to fetch" or 403 Errors

**Old way (manual):**
- Open browser console
- Run `localStorage.clear()`
- Refresh page
- Login again

**New way (automatic):**
- Just refresh the page
- The auth interceptor will automatically redirect you to login
- No manual localStorage clearing needed!

### APIs Won't Start

```bash
# Kill all processes and start fresh
./stop-dev.sh
sleep 2
./start-dev.sh
```

### Port Already in Use

The startup script automatically kills processes on ports 3002, 3003, and 5173-5175. If you still see errors:

```bash
# Manually kill a specific port
lsof -ti:3002 | xargs kill -9
```

### JWT Token Issues

If you see "invalid signature" errors:

1. Stop all services: `./stop-dev.sh`
2. Start with unified script: `./start-dev.sh`
3. Clear browser data (Ctrl+Shift+Delete or Cmd+Shift+Delete)
4. Login again

The startup script ensures all APIs use the same JWT_SECRET from `.env`.

## Production-Grade Features

✅ **Automatic authentication error recovery** - No manual localStorage clearing
✅ **Unified environment configuration** - Single source of truth
✅ **Health check endpoints** - Verify JWT secret synchronization
✅ **Process management** - Clean startup and shutdown
✅ **Centralized logging** - All logs in one place
✅ **Token expiration checking** - Automatic session management

## Development Workflow

1. **Start development**: `./start-dev.sh`
2. **Make changes** to code
3. **Frontend auto-reloads** (Vite HMR)
4. **API changes**: `./restart-apis.sh`
5. **Test in browser**
6. **Stop when done**: `./stop-dev.sh` (or Ctrl+C)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Port 5173)                           │
│  - React + TypeScript + Vite                    │
│  - Auth Interceptor (automatic 401/403 handling)│
│  - Token expiration checking                    │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼────────┐ ┌─────▼───────────┐
│ Medical Auth   │ │ Pump Report API │
│ API (3003)     │ │ (3002)          │
├────────────────┤ ├─────────────────┤
│ - Login        │ │ - Pump Data     │
│ - Registration │ │ - Reports       │
│ - JWT tokens   │ │ - Admin         │
└────────┬───────┘ └──────┬──────────┘
         │                 │
         │   Same JWT      │
         │   Secret        │
         │                 │
    ┌────▼─────────────────▼─────┐
    │  MySQL Database            │
    │  (localhost:3306)          │
    └────────────────────────────┘
```

## Environment Variables

Key variables in `.env`:

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=tshla_medical_local

# Authentication (MUST be the same for all APIs)
JWT_SECRET=tshla-unified-jwt-secret-2025-enhanced-secure-key

# API URLs for frontend
VITE_MEDICAL_API_URL=http://localhost:3003
VITE_PUMP_API_URL=http://localhost:3002
VITE_API_URL=http://localhost:3002
```

## Support

For issues or questions:
- Check logs in `logs/` directory
- Verify health endpoints
- Restart services with `./start-dev.sh`
- Check browser console for frontend errors

---

**Last Updated**: October 2025
**Production-Grade Authentication**: ✅ Implemented
