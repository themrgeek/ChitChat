#!/bin/bash

echo "🚂 ChitChat Railway Deployment Check"
echo "===================================="

# Check if required files exist
echo "📁 Checking deployment files..."
if [ -f "package.json" ]; then
    echo "✅ package.json found"
else
    echo "❌ package.json missing"
fi

if [ -f "nixpacks.toml" ]; then
    echo "✅ nixpacks.toml found"
else
    echo "❌ nixpacks.toml missing"
fi

if [ -d "backend" ] && [ -f "backend/server.js" ]; then
    echo "✅ backend/server.js found"
else
    echo "❌ backend/server.js missing"
fi

if [ -d "frontend" ]; then
    echo "✅ frontend directory found"
else
    echo "❌ frontend directory missing"
fi

echo ""
echo "🧪 Testing local build..."
npm run build

echo ""
echo "📋 Deployment checklist:"
echo "1. ✅ Delete old Railway project"
echo "2. ✅ Create new Railway project"
echo "3. ✅ Connect GitHub repository"
echo "4. ✅ Set environment variables:"
echo "   - NODE_ENV=production"
echo "   - JWT_SECRET=your-secure-random-string"
echo "   - EMAIL_USER=your-email (optional)"
echo "   - EMAIL_PASS=your-password (optional)"
echo "5. ✅ Wait for auto-deployment"
echo "6. ✅ Check Railway logs for debug output"
echo "7. ✅ Visit your app URL"

echo ""
echo "🌐 Expected Railway URL format:"
echo "https://chitchat-production.up.railway.app"

echo ""
echo "🔍 Debug logs to look for:"
echo "- Railway Environment Debug: PORT, RAILWAY_STATIC_URL, NODE_ENV"
echo "- ✅ Using Railway-assigned PORT: [number]"
echo "- 🚀 ChitChat server running on port [number]"
