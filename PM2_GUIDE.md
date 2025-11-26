# 🚀 PM2 Process Manager Guide

This guide shows you how to use PM2 to keep your app running in production on your laptop or server.

---

## 📋 What is PM2?

PM2 (Process Manager 2) is a production process manager for Node.js applications. It:
- ✅ Keeps your app running even if it crashes
- ✅ Restarts automatically on system reboot
- ✅ Manages logs
- ✅ Monitors resource usage
- ✅ Runs multiple processes (backend + frontend)

---

## 🔧 Installation

### Install PM2 globally:

```bash
npm install -g pm2
```

Or using yarn:
```bash
yarn global add pm2
```

---

## 🚀 Quick Start

### 1. Build Your App First

Before starting with PM2, make sure your app is built:

```bash
# Build TypeScript
npm run build

# Build Next.js
npm run build:next
```

### 2. Start Both Services

```bash
pm2 start ecosystem.config.js
```

This starts both:
- **Backend API** (port 3000)
- **Frontend Next.js** (port 3001)

### 3. Check Status

```bash
pm2 status
```

You should see both services running:
```
┌─────┬─────────────────────┬─────────┬─────────┬─────────┐
│ id  │ name                │ status  │ cpu     │ memory  │
├─────┼─────────────────────┼─────────┼─────────┼─────────┤
│ 0   │ reseller-backend    │ online  │ 0%      │ 45 MB   │
│ 1   │ reseller-frontend   │ online  │ 0%      │ 120 MB  │
└─────┴─────────────────────┴─────────┴─────────┴─────────┘
```

---

## 📊 Common PM2 Commands

### View Logs

```bash
# View all logs
pm2 logs

# View logs for specific service
pm2 logs reseller-backend
pm2 logs reseller-frontend

# View last 100 lines
pm2 logs --lines 100

# Follow logs (like tail -f)
pm2 logs --follow
```

### Manage Services

```bash
# Stop all services
pm2 stop ecosystem.config.js

# Stop specific service
pm2 stop reseller-backend

# Restart all services
pm2 restart ecosystem.config.js

# Restart specific service
pm2 restart reseller-backend

# Reload (zero-downtime restart)
pm2 reload ecosystem.config.js

# Delete services
pm2 delete ecosystem.config.js
pm2 delete reseller-backend
```

### Monitor Resources

```bash
# Real-time monitoring
pm2 monit

# Show detailed info
pm2 show reseller-backend
pm2 show reseller-frontend
```

### Save and Auto-Start

```bash
# Save current process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Follow the instructions it gives you
# (usually involves running a sudo command)
```

---

## 🔄 Updating Your App

When you update your code:

```bash
# 1. Build the new code
npm run build
npm run build:next

# 2. Restart PM2 services
pm2 restart ecosystem.config.js

# Or reload (zero-downtime)
pm2 reload ecosystem.config.js
```

---

## 📝 Logs Location

PM2 logs are stored in:
- `./logs/backend-out.log` - Backend stdout
- `./logs/backend-error.log` - Backend errors
- `./logs/frontend-out.log` - Frontend stdout
- `./logs/frontend-error.log` - Frontend errors

You can also view them with:
```bash
pm2 logs
```

---

## ⚙️ Configuration Explained

The `ecosystem.config.js` file configures:

### Backend Service
- **Name:** `reseller-backend`
- **Script:** `npm start` (runs build then starts server)
- **Port:** 3000
- **Memory limit:** 500MB (restarts if exceeded)

### Frontend Service
- **Name:** `reseller-frontend`
- **Script:** `npm run start:next` (starts Next.js)
- **Port:** 3001
- **Memory limit:** 500MB (restarts if exceeded)

### Auto-Restart Settings
- **Autorestart:** Enabled (restarts if crashes)
- **Max restarts:** 10 times
- **Min uptime:** 10 seconds (must run for 10s to be considered stable)
- **Restart delay:** 4 seconds (waits 4s before restarting)

---

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
pm2 logs reseller-backend --err
pm2 logs reseller-frontend --err

# Check if ports are in use
lsof -i :3000
lsof -i :3001

# Kill process using port
kill -9 <PID>
```

### Service Keeps Restarting

```bash
# Check why it's restarting
pm2 logs reseller-backend --lines 50

# Check memory usage
pm2 monit

# Increase memory limit in ecosystem.config.js
max_memory_restart: '1G'
```

### Can't Access App

1. **Check services are running:**
   ```bash
   pm2 status
   ```

2. **Check logs for errors:**
   ```bash
   pm2 logs
   ```

3. **Verify ports:**
   ```bash
   # Backend should be on 3000
   curl http://localhost:3000
   
   # Frontend should be on 3001
   curl http://localhost:3001
   ```

4. **Check environment variables:**
   ```bash
   # PM2 uses .env file automatically
   # Make sure DATABASE_URL and other vars are set
   ```

---

## 🔒 Production Best Practices

### 1. Use Environment Variables

Create a `.env` file (already in `.gitignore`):
```env
DATABASE_URL=postgresql://...
PORT=3000
NODE_ENV=production
# ... other variables
```

PM2 will automatically load `.env` file.

### 2. Set Up Log Rotation

PM2 has built-in log rotation. To configure:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. Monitor in Production

```bash
# Install PM2 monitoring (optional, requires account)
pm2 install pm2-server-monit
```

### 4. Health Checks

Add health check endpoints and monitor them:
```bash
# Check if backend is healthy
curl http://localhost:3000/health

# Check if frontend is healthy
curl http://localhost:3001
```

---

## 📊 Advanced Usage

### Run in Cluster Mode (Multiple Instances)

For the backend API (if you want multiple instances):

```javascript
// In ecosystem.config.js, change:
instances: 2,  // or 'max' for all CPU cores
exec_mode: 'cluster',
```

**Note:** Next.js doesn't support cluster mode, keep it as `fork`.

### Custom Environment Variables

You can override environment variables:

```bash
# Start with custom env
pm2 start ecosystem.config.js --env production

# Or set specific variable
pm2 start ecosystem.config.js --update-env -- DATABASE_URL=postgresql://...
```

### Graceful Shutdown

PM2 handles graceful shutdown automatically. Your app should:
- Listen for `SIGTERM` or `SIGINT` signals
- Close database connections
- Finish ongoing requests
- Then exit

---

## 🎯 Quick Reference

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop ecosystem.config.js

# Restart
pm2 restart ecosystem.config.js

# View logs
pm2 logs

# Check status
pm2 status

# Monitor
pm2 monit

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup

# Delete all
pm2 delete all
```

---

## 💡 Tips

1. **Always build before starting:**
   ```bash
   npm run build && npm run build:next && pm2 restart ecosystem.config.js
   ```

2. **Check logs regularly:**
   ```bash
   pm2 logs --lines 50
   ```

3. **Monitor memory usage:**
   ```bash
   pm2 monit
   ```

4. **Use PM2 Plus (optional):**
   - Free monitoring dashboard
   - Sign up at: https://pm2.io

---

**Your app is now running with PM2! 🎉**

It will automatically restart if it crashes and start on system boot.

