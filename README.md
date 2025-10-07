# TSHLA Medical

> AI-powered medical practice management platform with intelligent insulin pump recommendations

[![Production](https://img.shields.io/badge/status-production-green)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.8-blue)]()
[![React](https://img.shields.io/badge/react-19.1-blue)]()
[![License](https://img.shields.io/badge/license-proprietary-red)]()

## 🎯 What is TSHLA Medical?

TSHLA Medical is a comprehensive healthcare platform combining:

- **AI Medical Dictation** - Real-time speech-to-text SOAP note generation
- **PumpDrive** - Intelligent insulin pump recommendation engine (100% accuracy)
- **Practice Management** - Multi-role dashboards for medical staff
- **Patient Portal** - Secure patient communication and data access
- **Weight Loss Program** - Integrated weight management module

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- OpenAI API key
- Deepgram API key

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/tshla-medical.git
cd tshla-medical

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your .env file with:
# - Supabase credentials
# - OpenAI API key
# - Deepgram API key

# Start development server
npm run dev:full
```

Access at:
- **Frontend:** http://localhost:5173
- **Pump API:** http://localhost:3005

## 📚 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design and tech stack
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[PumpDrive Documentation](docs/PUMPDRIVE.md)** - AI pump recommendation system
- **[Developer Guide](DEV_GUIDE.md)** - Development workflow and best practices
- **[Quick Start Guide](QUICK_START_GUIDE.md)** - Get up and running quickly

## 🏗️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for blazing fast builds
- **TailwindCSS** for styling
- **React Router** for navigation

### Backend
- **Node.js** Express APIs
- **Supabase** for database & authentication
- **OpenAI** GPT-4o/GPT-4o-mini for AI features
- **Deepgram** for medical-grade speech-to-text

### Infrastructure
- **Azure Container Apps** for hosting
- **GitHub Actions** for CI/CD
- **Supabase** managed PostgreSQL
- **Docker** for containerization

## 🌟 Key Features

### PumpDrive - AI Pump Recommendations
- **6 insulin pumps** with 100% recommendation accuracy
- **23-dimension scoring** across all pump characteristics
- **AI-powered semantic analysis** understands patient intent
- **~$0.004 per recommendation** (95% cheaper than alternatives)
- **~15 second** average recommendation time

### Medical Dictation
- **Real-time transcription** using Deepgram medical model
- **AI-generated SOAP notes** via OpenAI
- **Specialty templates** for different medical fields
- **HIPAA-compliant** audit logging

### Multi-Role Authentication
- Medical staff (doctors, nurses, MAs)
- PumpDrive users
- Patient portal
- Demo access codes

### Practice Management
- Staff workflow dashboards
- Case management
- Appointment scheduling
- Patient communication

## 🔐 Security & Compliance

- ✅ **HIPAA-compliant** audit logging
- ✅ **Supabase Auth** with JWT tokens
- ✅ **Row Level Security (RLS)** on all tables
- ✅ **Encrypted credentials** (no hardcoded secrets)
- ✅ **Session management** with auto-timeout
- ✅ **CORS protection** on all APIs

## 📊 Project Stats

- **410** TypeScript/JavaScript files
- **85** React pages
- **93** service modules
- **6** supported insulin pumps
- **23** pump scoring dimensions
- **3.3GB** total project size

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start frontend only
npm run dev:full         # Start frontend + all APIs
npm run dev:stop         # Stop all development servers

# Build
npm run build            # Production build
npm run preview          # Preview production build

# Quality
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint
npm run format           # Prettier formatting
npm run quality          # Run all quality checks

# Validation
npm run validate:all     # Validate build, APIs, DB, CORS
npm run validate:build   # Validate build only
npm run validate:apis    # Check API health
```

## 🚀 Deployment

### Automated (GitHub Actions)
```bash
git push origin main
# GitHub Actions handles the rest!
```

### Manual
```bash
npm run build
# Deploy to Azure Container Apps
```

See **[Deployment Guide](docs/DEPLOYMENT.md)** for details.

## 📈 Performance

### PumpDrive Engine
- Average recommendation: **14.8 seconds**
- Cost per patient: **$0.004**
- Success rate: **100%** (6/6 pumps validated)

### Frontend
- Code splitting via lazy loading
- Route-based bundles
- Optimized TailwindCSS

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

## 📝 Environment Variables

Required environment variables:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
VITE_OPENAI_API_KEY=your_openai_key

# Deepgram
VITE_DEEPGRAM_API_KEY=your_deepgram_key

# Security
JWT_SECRET=your_secure_random_string
```

See `.env.example` for complete configuration.

## 🐛 Troubleshooting

### Common Issues

**Supabase Connection Error**
```bash
# Ensure environment variables are set
echo $VITE_SUPABASE_URL
```

**OpenAI API Error**
```bash
# Check API key is valid
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $VITE_OPENAI_API_KEY"
```

**Build Fails**
```bash
# Clear cache and rebuild
rm -rf node_modules .vite dist
npm install
npm run build
```

See **[Troubleshooting Guide](docs/DEPLOYMENT.md#troubleshooting)** for more.

## 📞 Support

- **Documentation:** `docs/` directory
- **Issues:** GitHub Issues
- **Email:** support@tshla.ai

## 📄 License

Proprietary - All Rights Reserved

---

**Built with ❤️ by the TSHLA team**

**Last Updated:** October 7, 2025 | **Version:** 1.0.0 | **Status:** Production Ready
