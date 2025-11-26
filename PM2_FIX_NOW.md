# 🔧 Quick Fix: PM2 Errors

## Problems Found

1. **Port 3001 is already in use** - Something else is running on that port
2. **App not built** - Missing `dist/` and `.next/` folders

---

## ✅ Step-by-Step Fix

### Step 1: Stop PM2

```bash
pm2 stop all
pm2 delete all
```

### Step 2: Find What's Using Port 3001

```bash
lsof -i :3001
```

**You'll see something like:**
```
COMMAND   PID    USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     12345  FarooqK   23u  IPv6  ...      0t0  TCP *:3001 (LISTEN)
```

**Note the PID number** (like 12345).

### Step 3: Kill the Process Using Port 3001

```bash
kill -9 <PID>
```

**Replace `<PID>` with the number from Step 2.**

**Example:**
```bash
kill -9 12345
```

### Step 4: Check Port 3000 Too (Just in Case)

```bash
lsof -i :3000
```

If something is using it, kill it:
```bash
kill -9 <PID>
```

### Step 5: Build the App

**This is the most important step!**

```bash
# Build backend (TypeScript → JavaScript)
npm run build

# Build frontend (Next.js)
npm run build:next
```

**Wait for both to complete.** You should see:
- `dist/` folder created (for backend)
- `.next/` folder created (for frontend)

### Step 6: Verify Builds Succeeded

```bash
# Check backend build
ls -la dist/index.js

# Check frontend build
ls -la .next/
```

Both should exist!

### Step 7: Start PM2 Again

```bash
pm2 start ecosystem.config.js
```

### Step 8: Check Status

```bash
pm2 status
```

**Both should show:**
- Status: `online` ✅
- Uptime: increasing (not 0) ✅
- Restarts: 0 or low number ✅

### Step 9: View Logs

```bash
pm2 logs
```

**You should see:**
- Backend: `Server listening on 3000`
- Frontend: `Ready on http://localhost:3001`
- No errors! ✅

---

## 🎯 Quick Command Summary

Run these in order:

```bash
# 1. Stop PM2
pm2 stop all
pm2 delete all

# 2. Kill process on port 3001
lsof -i :3001
kill -9 <PID_FROM_ABOVE>

# 3. Build the app
npm run build
npm run build:next

# 4. Start PM2
pm2 start ecosystem.config.js

# 5. Check status
pm2 status

# 6. View logs
pm2 logs
```

---

## ✅ Success Indicators

After fixing, you should see:

**pm2 status:**
```
│ 0  │ reseller-backend    │ online  │ 10s  │ 0    │ 45 MB   │
│ 1  │ reseller-frontend  │ online  │ 10s  │ 0    │ 120 MB  │
```

**pm2 logs:**
```
reseller-backend: Server listening on 3000
reseller-frontend: Ready on http://localhost:3001
```

---

**That's it! Your app should be running now! 🎉**

