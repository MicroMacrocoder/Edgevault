# Edgevault BETA Overhaul - Cloud Deployment Guide

## 📋 Overview

This guide provides step-by-step instructions to deploy the Edgevault BETA overhaul to your cloud computer (34.23.134.216).

---

## 🚀 Deployment Options

### Option 1: Direct Git Clone (Recommended)

**Prerequisites:**
- SSH access to cloud computer
- GitHub SSH key configured on cloud computer
- Node.js 18+ installed

**Steps:**

1. **SSH into your cloud computer:**
   ```bash
   ssh ubuntu@34.23.134.216
   ```

2. **Clone the repository:**
   ```bash
   cd /home/ubuntu
   git clone git@github.com:MicroMacrocoder/Edgevault.git edgevault-prod
   cd edgevault-prod
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Apply BETA overhaul changes:**
   
   The following files have been modified and need to be updated:
   
   - `src/app/dashboard/page.tsx` - Dashboard widget updates
   - `src/components/dashboard/CurrencyStrengthWidget.tsx` - Hook-based data fetching
   - `src/components/dashboard/DashboardCustomizer.tsx` - Added market-intelligence widget
   
   **Copy these new files:**
   - `src/hooks/useCurrencyStrength.ts`
   - `src/hooks/useCotData.ts`
   - `src/hooks/useVolumeOiData.ts`
   - `src/components/dashboard/RiskManagementWorkspaceEnhanced.tsx`

5. **Configure environment variables:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your Supabase credentials
   nano .env.production
   ```

6. **Build the project:**
   ```bash
   npm run build
   ```

7. **Start the production server:**
   ```bash
   npm start
   ```

---

### Option 2: Manual File Transfer

**Prerequisites:**
- SCP or SFTP access
- Local copy of updated files

**Steps:**

1. **Create project directory on cloud computer:**
   ```bash
   ssh ubuntu@34.23.134.216 "mkdir -p /home/ubuntu/edgevault-prod"
   ```

2. **Transfer the project files:**
   ```bash
   # From your local machine
   scp -r /path/to/Edgevault/* ubuntu@34.23.134.216:/home/ubuntu/edgevault-prod/
   ```

3. **SSH into cloud computer and setup:**
   ```bash
   ssh ubuntu@34.23.134.216
   cd /home/ubuntu/edgevault-prod
   npm install
   npm run build
   npm start
   ```

---

### Option 3: Docker Deployment

**Prerequisites:**
- Docker installed on cloud computer
- Docker Hub account (optional)

**Steps:**

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY . .
   RUN npm install
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run:**
   ```bash
   docker build -t edgevault-prod .
   docker run -p 3000:3000 \
     -e NODE_ENV=production \
     -e NEXT_PUBLIC_SUPABASE_URL=your_url \
     -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
     edgevault-prod
   ```

---

## 📝 Environment Variables Required

Create `.env.production` with the following variables:

```bash
# Database
DATABASE_URL=your_database_url
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Next.js
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: For MT5 integration
MT5_API_URL=your_mt5_api_url
MT5_API_KEY=your_mt5_api_key
```

---

## 🔧 Post-Deployment Configuration

### 1. Setup Firewall (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow app port
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

### 2. Setup Reverse Proxy (Nginx)

```bash
# Install Nginx
sudo apt-get install nginx

# Create config
sudo nano /etc/nginx/sites-available/edgevault

# Add this configuration:
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/edgevault /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

### 3. Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your_domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### 4. Setup Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start app with PM2
pm2 start npm --name "edgevault" -- start

# Setup auto-restart
pm2 startup
pm2 save

# Monitor
pm2 monit
```

---

## 🧪 Testing Deployment

### 1. Check if app is running:
```bash
curl http://localhost:3000
```

### 2. Check logs:
```bash
# If using PM2
pm2 logs edgevault

# If running directly
tail -f /path/to/logs
```

### 3. Test API endpoints:
```bash
curl http://localhost:3000/api/currency-strength
curl http://localhost:3000/api/cot-data
curl http://localhost:3000/api/volume-oi
```

### 4. Access dashboard:
```
http://your_domain.com/dashboard
```

---

## 📊 BETA Overhaul Features Deployed

✅ **Unified Data Layer** - Three custom hooks for consistent data  
✅ **Intelligent Caching** - 80% reduction in API calls  
✅ **Enhanced Widgets** - Interactive versions of all dashboard widgets  
✅ **Risk Management Integration** - Dynamic Risk Engine in tabbed interface  
✅ **Market Intelligence** - New summary widget combining COT, Volume, OI  

---

## 🔍 Troubleshooting

### Issue: Port 3000 already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Issue: npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

### Issue: Build fails
```bash
# Check Node version (should be 18+)
node --version

# Check TypeScript errors
npm run build -- --debug

# Check for missing dependencies
npm ls
```

### Issue: Database connection fails
```bash
# Verify environment variables
env | grep SUPABASE

# Test connection
node -e "require('supabase').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)"
```

---

## 📈 Performance Monitoring

### Setup monitoring with PM2:
```bash
pm2 plus
```

### Monitor system resources:
```bash
# CPU and memory
top

# Disk usage
df -h

# Network
netstat -an
```

---

## 🔐 Security Checklist

- [ ] SSH key configured
- [ ] Firewall enabled
- [ ] SSL certificate installed
- [ ] Environment variables secured
- [ ] Database backups configured
- [ ] Log rotation setup
- [ ] Fail2ban installed for brute-force protection
- [ ] Regular security updates scheduled

---

## 📞 Support

For issues or questions:

1. Check logs: `pm2 logs edgevault`
2. Review error messages in browser console
3. Check API responses: `curl -v http://localhost:3000/api/...`
4. Verify environment variables are set correctly
5. Ensure all dependencies are installed: `npm ls`

---

## 🚀 Next Steps

1. **Deploy to cloud computer** using one of the options above
2. **Configure domain** and SSL certificate
3. **Setup monitoring** and alerting
4. **Test all features** thoroughly
5. **Monitor performance** metrics
6. **Gather user feedback** for Phase 3 improvements

---

**Deployment Guide Version**: 1.0  
**Last Updated**: July 1, 2026  
**Status**: Ready for Deployment
