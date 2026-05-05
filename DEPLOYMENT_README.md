# Tataheer ERP - Deployment Guide

## 🚀 Free Deployment Options

### 1. **Render** (Recommended)
- **Free Tier:** 750 hours/month, static IP
- **URL:** https://render.com

**Steps:**
1. Connect your GitHub repository
2. Choose "Web Service"
3. Set build command: `npm install && npm run build`
4. Set start command: `node server.js`
5. Add environment variables:
   - `DATABASE_URL` (your MongoDB Atlas URL)
   - `ADMIN_USER` and `ADMIN_PASSWORD`
   - `NODE_ENV=production`

### 2. **Railway**
- **Free Tier:** 512MB RAM, 1GB disk
- **URL:** https://railway.app

**Steps:**
1. Connect GitHub repo
2. Railway auto-detects Node.js
3. Add environment variables in dashboard
4. Deploy automatically

### 3. **Fly.io**
- **Free Tier:** 3 shared CPUs, 256MB RAM
- **URL:** https://fly.io

**Steps:**
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. `fly launch` in project folder
3. Configure with your settings

### 4. **Vercel**
- **Free Tier:** Serverless functions
- **URL:** https://vercel.com

**Steps:**
1. Connect GitHub repo
2. Vercel detects configuration
3. Add environment variables
4. Deploy

## 🔧 Environment Variables Required

```
DATABASE_URL=mongodb://your-mongodb-atlas-url
ADMIN_USER=admin
ADMIN_PASSWORD=your-secure-password
NODE_ENV=production
```

## 📱 Mobile App Deployment

After web deployment, update your Capacitor config:

```json
{
  "server": {
    "url": "https://your-deployed-app-url.com"
  }
}
```

## 🗄️ Database Setup

Your app uses MongoDB Atlas (already configured). Make sure:
- Network access allows `0.0.0.0/0` (all IPs)
- Database user has read/write permissions

## 🌐 Accessing Your App

Once deployed, your ERP system will be available at:
- **Web:** `https://your-app-name.onrender.com`
- **API:** `https://your-app-name.onrender.com/api/*`

Default login: admin / admin123 (change in production!)