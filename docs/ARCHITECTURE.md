# TSHLA Medical - System Architecture

## Overview

TSHLA Medical is a comprehensive medical practice management platform with AI-powered features for medical documentation and insulin pump recommendations.

## Technology Stack

### Frontend
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 7.1
- **Styling:** TailwindCSS 3.4
- **Routing:** React Router DOM 6.28
- **State Management:** React Context API

### Backend
- **Runtime:** Node.js
- **APIs:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with JWT

### AI & ML Services
- **AI Provider:** OpenAI (GPT-4o, GPT-4o-mini)
- **Speech-to-Text:** Deepgram (nova-2-medical model)
- **Use Cases:**
  - Medical dictation transcription
  - SOAP note generation
  - Insulin pump recommendation scoring

### Cloud Infrastructure
- **Hosting:** Azure Container Apps
- **CI/CD:** GitHub Actions
- **Database:** Supabase (managed PostgreSQL)
- **File Storage:** Azure Blob Storage

## System Components

### 1. Authentication System
Multi-role authentication supporting:
- **Medical Staff:** Email/password via Supabase Auth
- **PumpDrive Users:** Email/password via Supabase Auth
- **Access Codes:** Quick access (DOCTOR-2025, DIET-2025, etc.)
- **Patient Portal:** AVA ID-based login

**Auth Flow:**
```
User Login → unifiedAuth.service.ts
    ├─→ Medical Staff (Supabase Auth → medical_staff table)
    ├─→ PumpDrive Users (Supabase Auth → pump_users table)
    ├─→ Demo Accounts (Access codes from config)
    └─→ Patients (AVA ID validation)
```

### 2. Medical Dictation System
**Features:**
- Real-time speech-to-text using Deepgram
- AI-powered SOAP note generation
- Specialty-specific templates
- Export to PDF/Word
- HIPAA-compliant audit logging

**Tech:**
- Deepgram SDK (nova-2-medical model)
- OpenAI for note structuring
- Template-based formatting

### 3. PumpDrive - Insulin Pump Recommendation Engine
**Features:**
- 6-stage assessment workflow
- AI-powered semantic analysis
- 23-dimension scoring system
- 6 supported pumps (100% accuracy)

**Supported Pumps:**
1. Medtronic 780G
2. Tandem t:slim X2
3. Tandem Mobi
4. Omnipod 5
5. Beta Bionics iLet
6. Twiist

**Scoring Stages:**
1. **Baseline:** 40% for all pumps
2. **Sliders:** User preferences (±12%)
3. **Features:** Must-have requirements (±8%)
4. **AI Free Text:** Semantic intent analysis (+25% via GPT-4o-mini)
5. **Context 7:** Smart follow-up questions (±5%)
6. **Final AI:** Holistic reasoning (+20% via GPT-4o)

**Performance:**
- Average recommendation time: ~15 seconds
- Cost per recommendation: ~$0.004
- Success rate: 100% (6/6 pumps validated)

### 4. Practice Management
- Patient management
- Appointment scheduling
- Staff workflow management
- Case management dashboard
- Medical assistant dashboard

### 5. Weight Loss Program
Dedicated module for weight management services.

## Database Schema

### Core Tables (Supabase)

#### medical_staff
```sql
- id (uuid, primary key)
- auth_user_id (uuid, FK to auth.users)
- email (text, unique)
- username (text, unique)
- first_name, last_name (text)
- role (text: 'admin', 'doctor', 'nurse', 'ma')
- specialty (text)
- is_active, is_verified (boolean)
- created_at, updated_at (timestamp)
```

#### pump_users
```sql
- id (uuid, primary key)
- auth_user_id (uuid, FK to auth.users)
- email (text, unique)
- first_name, last_name (text)
- phone (text)
- date_of_birth (date)
- assessment_data (jsonb)
- created_at, updated_at (timestamp)
```

#### pump_dimensions
23 dimensions for pump scoring:
- battery_power, phone_control, tubing_preference
- automation_behavior, cgm_compatibility
- target_adjustability, exercise_modes
- bolus_workflow, reservoir_capacity
- adhesive_tolerance, water_resistance
- alerts_alarms, user_interface
- data_sharing, clinic_support
- travel_logistics, pediatric_features
- visual_discretion, ecosystem_accessories
- reliability_occlusion, cost_insurance
- onbody_comfort, support_apps_updates

#### access_logs
HIPAA-compliant audit trail:
```sql
- id (uuid, primary key)
- user_id (uuid)
- action (text)
- resource (text)
- ip_address (text)
- user_agent (text)
- timestamp (timestamp)
```

## API Architecture

### 1. Pump Report API (`server/pump-report-api.js`)
**Port:** 3005 (production), 9001 (local dev)

**Endpoints:**
- `POST /api/pumpdrive/start-assessment` - Begin new assessment
- `POST /api/pumpdrive/save-sliders` - Save slider preferences
- `POST /api/pumpdrive/save-features` - Save feature requirements
- `POST /api/pumpdrive/save-free-text` - Save free text input
- `POST /api/pumpdrive/recommend` - Get AI recommendations
- `GET /api/pumpdrive/results/:userId` - Retrieve results
- `GET /api/health` - Health check

**Database:** Supabase

### 2. Medical Auth API (`server/medical-auth-api.js`)
**Status:** Legacy (replaced by Supabase Auth)
**Port:** 3002

### 3. Enhanced Schedule Notes API
**Port:** 3001
**Features:** Appointment scheduling, note management

## Security Features

### Authentication
- ✅ Supabase Auth (managed authentication)
- ✅ JWT tokens with automatic refresh
- ✅ Row Level Security (RLS) on all tables
- ✅ PKCE flow for enhanced security
- ✅ Session management with auto-logout

### Data Protection
- ✅ HIPAA-compliant audit logging
- ✅ Encrypted passwords (Supabase managed)
- ✅ Environment-based secrets (no hardcoded credentials)
- ✅ CORS protection
- ✅ Rate limiting on APIs

### Compliance
- ✅ HIPAA mode enabled
- ✅ Audit logging for all medical data access
- ✅ Session timeout (120 minutes)
- ✅ Warning before session expiry (5 minutes)

## Deployment Architecture

### Production Environment
```
GitHub → GitHub Actions → Docker Build → Azure Container Registry
                                            ↓
                                    Azure Container Apps
                                            ↓
                                    3 Containers:
                                    - Frontend (Vite build)
                                    - Pump API (Port 3005)
                                    - Auth API (Port 3002)
```

### Development Environment
```
Local Development:
- Frontend: npm run dev (Port 5173)
- APIs: npm run server:start (Ports 3001, 3005)
- Database: Supabase (cloud)
```

## Code Organization

```
tshla-medical/
├── src/                    # Frontend React app
│   ├── components/         # Reusable components
│   ├── pages/             # Route-level pages
│   ├── services/          # API clients & business logic
│   ├── lib/               # Utilities & helpers
│   ├── config/            # App configuration
│   ├── contexts/          # React contexts
│   └── types/             # TypeScript types
├── server/                # Backend APIs
│   ├── pump-report-api.js      # Main pump API
│   ├── medical-auth-api.js     # Legacy auth API
│   └── services/               # Server-side services
├── scripts/               # Deployment & utility scripts
│   ├── database/         # SQL scripts
│   └── deployment/       # Deploy scripts
├── docs/                 # Documentation
└── public/               # Static assets
```

## Performance Optimization

### Frontend
- ✅ Code splitting via React.lazy()
- ✅ Route-based lazy loading
- ✅ Bundled components (PumpDrive, Templates, Admin, etc.)
- ✅ TailwindCSS purging for minimal CSS

### Backend
- ✅ Supabase connection pooling
- ✅ API response caching where appropriate
- ✅ Optimized AI model usage (GPT-4o-mini for simple tasks)

### AI Cost Optimization
```
PumpDrive Cost per Patient: ~$0.004
- Stage 4 (GPT-4o-mini): ~$0.0002
- Stage 6 (GPT-4o): ~$0.0038
Total: ~$0.004/patient = 25,000 patients per $100
```

## Monitoring & Logging

### Health Checks
- API health endpoints (`/api/health`)
- Database connectivity checks
- Supabase connection validation

### Logging
- Winston for server-side logging
- Daily log rotation
- Audit logs for HIPAA compliance
- Error tracking with stack traces

## Future Enhancements

### Planned Features
1. Context 7 Questions (smart follow-up for PumpDrive)
2. Email verification (Supabase built-in)
3. Multi-Factor Authentication (MFA)
4. Automated password reset
5. Stripe payment integration completion
6. Provider email delivery (SendGrid)
7. Real-time features (Supabase subscriptions)
8. Analytics dashboard

### Technical Improvements
1. Convert remaining `.js` files to TypeScript
2. Increase test coverage
3. Refactor large files (pump-report-api.js @ 4,802 lines)
4. Add performance monitoring
5. Implement caching layer

## References

- **Supabase Dashboard:** https://supabase.com/dashboard/project/minvvjdflezibmgkplqb
- **OpenAI Platform:** https://platform.openai.com
- **Deepgram Docs:** https://developers.deepgram.com
- **Azure Portal:** Azure Container Apps deployment

---

**Last Updated:** October 7, 2025
**Version:** 1.0.0
