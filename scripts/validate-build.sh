#!/bin/bash
set -e

echo "🔍 Validating build artifacts..."

# Check dist exists
if [ ! -d "dist" ]; then
  echo "❌ ERROR: dist/ folder not found"
  echo "   Run 'npm run build' first"
  exit 1
fi

# Check staticwebapp.config.json
if [ ! -f "dist/staticwebapp.config.json" ]; then
  echo "❌ ERROR: staticwebapp.config.json missing from dist/"
  echo "   This will cause 404 errors on all /admin/* routes in production!"
  echo "   Fix: Ensure staticwebapp.config.json is in public/ folder"
  exit 1
fi

# Check index.html
if [ ! -f "dist/index.html" ]; then
  echo "❌ ERROR: dist/index.html missing"
  exit 1
fi

# Check AdminBundle
if ! ls dist/assets/AdminBundle-*.js 1> /dev/null 2>&1; then
  echo "❌ ERROR: AdminBundle-*.js not found in dist/assets/"
  echo "   Admin routes will fail to load!"
  exit 1
fi

# Check PumpComparisonManager
if ! ls dist/assets/PumpComparisonManager-*.js 1> /dev/null 2>&1; then
  echo "❌ ERROR: PumpComparisonManager-*.js not found in dist/assets/"
  echo "   /admin/pump-comparison will fail to load!"
  exit 1
fi

echo "✅ All build artifacts valid"
echo "✅ dist/staticwebapp.config.json exists"
echo "✅ AdminBundle exists"
echo "✅ PumpComparisonManager exists"
echo "✅ Ready to deploy"
