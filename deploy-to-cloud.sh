#!/bin/bash

# Edgevault BETA Overhaul - Cloud Deployment Script
# This script deploys the updated Edgevault to your cloud computer

set -e

# Configuration
CLOUD_IP="34.23.134.216"
CLOUD_USER="ubuntu"
PROJECT_NAME="edgevault-prod"
PROJECT_PATH="/home/ubuntu/$PROJECT_NAME"
LOCAL_PROJECT="/tmp/Edgevault"

echo "🚀 Edgevault BETA Overhaul - Cloud Deployment"
echo "=============================================="
echo ""

# Step 1: Create archive
echo "📦 Step 1: Creating deployment archive..."
cd /tmp
tar --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.env*' -czf edgevault-deploy.tar.gz Edgevault
echo "✓ Archive created: edgevault-deploy.tar.gz"
echo ""

# Step 2: Transfer to cloud
echo "📤 Step 2: Transferring to cloud computer..."
echo "Note: You may be prompted for password authentication"
scp edgevault-deploy.tar.gz $CLOUD_USER@$CLOUD_IP:/tmp/
echo "✓ Archive transferred"
echo ""

# Step 3: Extract and setup on cloud
echo "🔧 Step 3: Setting up on cloud computer..."
ssh $CLOUD_USER@$CLOUD_IP << 'CLOUD_SCRIPT'
set -e

echo "📁 Extracting archive..."
cd /tmp
tar -xzf edgevault-deploy.tar.gz

echo "📂 Setting up project directory..."
mkdir -p /home/ubuntu/edgevault-prod
cp -r Edgevault/* /home/ubuntu/edgevault-prod/
cd /home/ubuntu/edgevault-prod

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building project..."
npm run build

echo "⚙️  Creating environment file..."
if [ ! -f .env.production ]; then
  cat > .env.production << 'EOF'
NODE_ENV=production
# Add your Supabase credentials here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EOF
  echo "⚠️  Please update .env.production with your credentials"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. SSH into cloud computer: ssh ubuntu@34.23.134.216"
echo "2. Update environment: nano /home/ubuntu/edgevault-prod/.env.production"
echo "3. Start server: cd /home/ubuntu/edgevault-prod && npm start"
echo "4. Access at: http://34.23.134.216:3000"

CLOUD_SCRIPT

echo "✓ Cloud setup complete"
echo ""

# Step 4: Cleanup
echo "🧹 Step 4: Cleaning up..."
rm -f /tmp/edgevault-deploy.tar.gz
echo "✓ Cleanup complete"
echo ""

echo "🎉 Deployment script finished!"
echo ""
echo "📋 Summary:"
echo "  - Project deployed to: $PROJECT_PATH"
echo "  - Cloud IP: $CLOUD_IP"
echo "  - Access URL: http://$CLOUD_IP:3000"
echo ""
echo "⚠️  Important:"
echo "  1. Configure environment variables on cloud computer"
echo "  2. Setup firewall rules (UFW)"
echo "  3. Configure reverse proxy (Nginx)"
echo "  4. Setup SSL certificate (Let's Encrypt)"
echo "  5. Use PM2 for process management"
echo ""
echo "📖 For detailed instructions, see: DEPLOYMENT_GUIDE.md"
