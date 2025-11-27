# Quick Setup Instructions

## Issue Found
Clicking "Database" created a "function-bun" service instead of PostgreSQL. We need to create PostgreSQL properly.

## Solution: Manual PostgreSQL Setup

Since Railway's UI might have changed, here's the manual approach:

### Option 1: Use Railway CLI (Recommended)

1. **Install Railway CLI:**
   ```bash
   brew install railway
   # or
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Link to project:**
   ```bash
   railway link
   # Select your project when prompted
   ```

4. **Add PostgreSQL:**
   ```bash
   railway add postgresql
   ```

This will automatically:
- Create PostgreSQL service
- Set DATABASE_URL in your web service
- Connect them together

### Option 2: Manual Setup via Railway Dashboard

1. **Delete the function-bun service:**
   - Click on "function-bun" service
   - Go to Settings → Delete Service

2. **Create PostgreSQL manually:**
   - Click "Create" button
   - Type "postgresql" in the search box
   - Select "PostgreSQL" from the list
   - Railway will create it

3. **Verify DATABASE_URL:**
   - Go to web service → Variables tab
   - Look for DATABASE_URL
   - If missing, copy it from PostgreSQL service → Variables

### Option 3: Use External PostgreSQL (Quick Test)

If you want to test quickly, you can use a free PostgreSQL service:

1. **Sign up for free PostgreSQL:**
   - [Neon](https://neon.tech) - Free tier available
   - [Supabase](https://supabase.com) - Free tier available
   - [ElephantSQL](https://www.elephantsql.com) - Free tier available

2. **Get connection string:**
   - Copy the connection string (starts with `postgresql://`)

3. **Add to Railway:**
   - Go to web service → Variables → New Variable
   - Name: `DATABASE_URL`
   - Value: (paste connection string)

## Next Steps After Setup

1. ✅ Verify DATABASE_URL is set
2. ✅ Wait for redeployment (2-3 minutes)
3. ✅ Check logs show PostgreSQL connection
4. ✅ Test health endpoint

## Current Status

- ✅ Deployment: Successful
- ✅ Server: Running
- ❌ Database: Using SQLite (needs PostgreSQL)
- ⚠️  function-bun service created (can be deleted)

