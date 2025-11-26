# 💻 Self-Hosting Guide: Running on Your Laptop

This guide shows you how to run your app on your own laptop/computer instead of using Railway or other cloud platforms. This is called "self-hosting."

---

## 📋 What You'll Need

1. **A laptop/computer** (Mac, Windows, or Linux)
2. **Node.js installed** (version 18 or higher)
3. **PostgreSQL installed** (or use Docker)
4. **A way to make your laptop accessible** (for Shopify OAuth - see options below)

---

## 🎯 Overview: What We're Going to Do

1. **Install PostgreSQL** on your laptop
2. **Set up your database** (create database and run migrations)
3. **Configure environment variables** (create a `.env` file)
4. **Run your app** locally
5. **Make it accessible to Shopify** (so OAuth works)

---

## Step 1: Install PostgreSQL (10 minutes)

### Option A: Using Homebrew (Mac - Easiest)

1. **Install Homebrew** (if you don't have it):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install PostgreSQL:**
   ```bash
   brew install postgresql@15
   ```

3. **Start PostgreSQL:**
   ```bash
   brew services start postgresql@15
   ```

4. **Add PostgreSQL to your PATH** (so commands like `createdb` work):
   ```bash
   # For Apple Silicon Macs (M1/M2/M3):
   echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
   
   # For Intel Macs:
   echo 'export PATH="/usr/local/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
   
   # Reload your shell
   source ~/.zshrc
   ```

5. **Create a database** (choose one method):

   **Method A: Using createdb command:**
   ```bash
   createdb reseller_feed_middleware
   ```

   **Method B: Using psql (if createdb doesn't work):**
   ```bash
   # Connect to PostgreSQL
   psql postgres
   
   # Then run:
   CREATE DATABASE reseller_feed_middleware;
   
   # Exit psql
   \q
   ```

**✅ Done!** PostgreSQL is running and database is created.

### Option B: Using Docker (Works on Mac, Windows, Linux)

1. **Install Docker Desktop:**
   - Mac: https://www.docker.com/products/docker-desktop/
   - Windows: https://www.docker.com/products/docker-desktop/
   - Linux: Follow Docker installation for your distribution

2. **Run PostgreSQL in Docker:**
   ```bash
   docker run --name postgres-reseller \
     -e POSTGRES_PASSWORD=your_secure_password \
     -e POSTGRES_DB=reseller_feed_middleware \
     -p 5432:5432 \
     -d postgres:15
   ```

3. **Verify it's running:**
   ```bash
   docker ps
   ```
   You should see `postgres-reseller` in the list.

**✅ Done!** PostgreSQL is running in Docker.

### Option C: Download PostgreSQL (Windows/Linux)

1. **Download PostgreSQL:**
   - Go to: https://www.postgresql.org/download/
   - Download the installer for your OS
   - Run the installer (remember the password you set!)

2. **Create a database:**
   - Open "pgAdmin" (comes with PostgreSQL)
   - Right-click "Databases" → "Create" → "Database"
   - Name it: `reseller_feed_middleware`
   - Click "Save"

**✅ Done!** PostgreSQL is installed.

---

## Step 2: Set Up Your Database (5 minutes)

### Create the Database Connection String

**If you used Homebrew (Mac):**
```bash
# Your connection string will be:
DATABASE_URL=postgresql://$(whoami)/reseller_feed_middleware
```

**If you used Docker:**
```bash
# Your connection string will be:
DATABASE_URL=postgresql://postgres:your_secure_password@localhost:5432/reseller_feed_middleware
```

**If you installed PostgreSQL normally:**
```bash
# Your connection string will be:
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/reseller_feed_middleware
```

### Run the Migration

1. **Navigate to your project:**
   ```bash
   cd /Users/FarooqK/reseller-feed-middleware
   ```

2. **Set the DATABASE_URL temporarily:**
   ```bash
   # For Homebrew (Mac):
   export DATABASE_URL=postgresql://$(whoami)/reseller_feed_middleware
   
   # For Docker:
   export DATABASE_URL=postgresql://postgres:your_secure_password@localhost:5432/reseller_feed_middleware
   
   # For normal installation:
   export DATABASE_URL=postgresql://postgres:your_password@localhost:5432/reseller_feed_middleware
   ```

3. **Run the migration:**
   ```bash
   npm run migrate:postgres
   ```

   You should see:
   ```
   Starting PostgreSQL migration...
   ✓ Connected to PostgreSQL
   [DB] PostgreSQL migration completed
   ```

**✅ Done!** Your database tables are created.

---

## Step 3: Create Environment Variables File (10 minutes)

### Create `.env` File

1. **In your project folder**, create a file named `.env`:
   ```bash
   cd /Users/FarooqK/reseller-feed-middleware
   touch .env
   ```

2. **Open `.env` in a text editor** and add these variables:

```env
# Database (use the connection string from Step 2)
DATABASE_URL=postgresql://your_username/reseller_feed_middleware

# Server
PORT=3000
LOG_LEVEL=info

# Generate these keys (see below):
ENCRYPTION_KEY=your-generated-key-here
ADMIN_TOKEN=your-generated-token-here

# Shopify
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# App URL - IMPORTANT: See Step 5 for options
APP_URL=http://localhost:3001
SHOPIFY_WEBHOOK_BASE_URL=http://localhost:3000

# Next.js (public variables)
NEXT_PUBLIC_SHOPIFY_API_KEY=your-shopify-api-key
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

### Generate Secret Keys

Run these commands in terminal:

```bash
# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the outputs into your `.env` file.

**✅ Done!** Your environment variables are set.

---

## Step 4: Make Your Laptop Accessible to Shopify (Important!)

### The Problem

Shopify needs to access your app for OAuth to work. Your laptop's `localhost` isn't accessible from the internet.

### Solution Options:

#### Option A: Use ngrok (Easiest - Recommended for Testing)

**ngrok** creates a secure tunnel from the internet to your laptop.

1. **Install ngrok:**
   ```bash
   # Mac
   brew install ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **Sign up for free ngrok account:**
   - Go to: https://ngrok.com
   - Sign up (free)
   - Get your authtoken from the dashboard

3. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN
   ```

4. **Start ngrok tunnel:**
   ```bash
   # This creates a public URL that points to your localhost:3001
   ngrok http 3001
   ```

5. **Copy the ngrok URL:**
   - You'll see something like: `https://abc123.ngrok.io`
   - Copy this URL

6. **Update your `.env` file:**
   ```env
   APP_URL=https://abc123.ngrok.io
   SHOPIFY_WEBHOOK_BASE_URL=https://abc123.ngrok.io
   ```

7. **Update Shopify app settings:**
   - App URL: `https://abc123.ngrok.io`
   - Redirect URL: `https://abc123.ngrok.io/api/auth/callback`

**⚠️ Note:** Free ngrok URLs change every time you restart. For production, use a paid ngrok plan or Option B.

#### Option B: Use a Static IP + Port Forwarding (For Permanent Setup)

1. **Get a static IP** from your ISP (may cost extra)
2. **Configure port forwarding** on your router:
   - Forward port 3001 to your laptop's local IP
3. **Update `.env`:**
   ```env
   APP_URL=http://YOUR_STATIC_IP:3001
   ```

**⚠️ Security Warning:** This exposes your laptop to the internet. Use a firewall and strong passwords.

#### Option C: Use a VPS (Virtual Private Server)

1. **Rent a VPS** (DigitalOcean, Linode, etc. - $5-10/month)
2. **Deploy your app there** (follow similar steps)
3. **Use the VPS IP/domain** in your `.env`

**✅ Done!** Your app is now accessible.

---

## Step 5: Install Dependencies and Build (5 minutes)

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

3. **Build the Next.js app:**
   ```bash
   npm run build:next
   ```

**✅ Done!** Your app is built and ready.

---

## Step 6: Run Your App (2 minutes)

### Start Both Servers

You need to run two servers:
1. **Backend API** (port 3000)
2. **Next.js Frontend** (port 3001)

**Option A: Run in Separate Terminals (Recommended)**

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run start:next
```

**Option B: Run Both Together (Development Mode)**

```bash
npm run dev:all
```

**✅ Done!** Your app is running!

You should see:
- Backend: `Server listening on 3000`
- Frontend: `Ready on http://localhost:3001`
- Database: `[DB] Using PostgreSQL database`

---

## Step 7: Test Your App (5 minutes)

1. **Check backend is running:**
   - Visit: `http://localhost:3000`
   - Should see your API or a response

2. **Check frontend is running:**
   - Visit: `http://localhost:3001`
   - Should see your app

3. **Check database connection:**
   - Look at terminal logs
   - Should see: `[DB] Using PostgreSQL database`

4. **Test OAuth (if using ngrok):**
   - Go to your Shopify store
   - Install your app
   - Should redirect to ngrok URL and work!

**✅ Done!** Your app is working!

---

## 🔄 Keeping Your App Running

### Option A: Run in Terminal (Simple)

Just keep the terminals open. If you close them, the app stops.

### Option B: Use a Process Manager (Recommended)

**Using PM2 (Process Manager):**

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create a PM2 config file** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [
       {
         name: 'reseller-backend',
         script: 'npm',
         args: 'start',
         cwd: '/Users/FarooqK/reseller-feed-middleware',
         env: {
           NODE_ENV: 'production'
         }
       },
       {
         name: 'reseller-frontend',
         script: 'npm',
         args: 'run start:next',
         cwd: '/Users/FarooqK/reseller-feed-middleware',
         env: {
           NODE_ENV: 'production'
         }
       }
     ]
   };
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   ```

4. **Check status:**
   ```bash
   pm2 status
   ```

5. **View logs:**
   ```bash
   pm2 logs
   ```

6. **Auto-start on boot:**
   ```bash
   pm2 startup
   pm2 save
   ```

**✅ Done!** Your app will keep running even if you close the terminal.

---

## 🔧 Troubleshooting

### Problem: Can't Connect to PostgreSQL

**Solutions:**
1. Check PostgreSQL is running:
   ```bash
   # Mac (Homebrew):
   brew services list
   
   # Docker:
   docker ps
   ```

2. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

3. Check DATABASE_URL in `.env` is correct

### Problem: Port Already in Use

**Solutions:**
1. Find what's using the port:
   ```bash
   # Mac/Linux:
   lsof -i :3000
   
   # Kill the process:
   kill -9 <PID>
   ```

2. Or change PORT in `.env`:
   ```env
   PORT=3002
   ```

### Problem: ngrok URL Changes

**Solutions:**
1. Use ngrok paid plan for static URLs
2. Or update Shopify settings each time
3. Or use a VPS with static IP

### Problem: OAuth Not Working

**Solutions:**
1. Verify APP_URL matches ngrok URL exactly
2. Check Shopify app settings match
3. Ensure HTTPS (ngrok provides this)
4. Check logs for errors

---

## 📊 Monitoring Your App

### View Logs

**If running in terminal:**
- Just watch the terminal output

**If using PM2:**
```bash
pm2 logs
pm2 logs reseller-backend
pm2 logs reseller-frontend
```

### Check Database

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# List tables
\dt

# Check installations
SELECT * FROM installations;

# Exit
\q
```

---

## 🔒 Security Considerations

### For Production Self-Hosting:

1. **Use a firewall:**
   - Only allow necessary ports
   - Block unnecessary access

2. **Use strong passwords:**
   - Database passwords
   - Admin tokens
   - Encryption keys

3. **Keep software updated:**
   - Node.js
   - PostgreSQL
   - Your app dependencies

4. **Use HTTPS:**
   - ngrok provides this automatically
   - Or use a reverse proxy (nginx) with SSL

5. **Don't expose database:**
   - Only allow localhost connections
   - Use strong database passwords

---

## 💰 Cost Comparison

| Option | Cost | Best For |
|--------|------|----------|
| **Self-hosting on laptop** | Free (electricity) | Development, testing |
| **ngrok free** | Free | Testing, demos |
| **ngrok paid** | $8/month | Small production |
| **VPS (DigitalOcean)** | $5-10/month | Production |
| **Railway** | Free tier available | Easiest production |

---

## 🎯 When to Use Self-Hosting

**Good for:**
- ✅ Development and testing
- ✅ Learning how it works
- ✅ Small personal projects
- ✅ When you want full control

**Not ideal for:**
- ❌ Production apps with users
- ❌ Apps that need to be always online
- ❌ Apps that need to scale
- ❌ When your laptop might be off

---

## 🚀 Next Steps

1. **For development:** Self-hosting is perfect!
2. **For production:** Consider Railway, Render, or a VPS
3. **For learning:** Self-hosting teaches you a lot!

---

## 📚 Quick Reference

### Start App
```bash
# Development (both servers)
npm run dev:all

# Production (separate terminals)
npm start          # Terminal 1
npm run start:next # Terminal 2
```

### Database
```bash
# Run migration
npm run migrate:postgres

# Connect to database
psql $DATABASE_URL
```

### ngrok
```bash
# Start tunnel
ngrok http 3001

# Get static URL (paid)
ngrok http 3001 --domain=your-domain.ngrok.io
```

---

**You're all set! 🎉** Your app is running on your laptop with PostgreSQL!

