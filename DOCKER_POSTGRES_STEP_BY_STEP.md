# 🐳 Step-by-Step: Running PostgreSQL in Docker

This guide walks you through running PostgreSQL in Docker, step by step.

---

## 📍 Where to Run This Command

**You run this in your Terminal (command line).**

### How to Open Terminal:

**On Mac:**
1. Press `Cmd + Space` (opens Spotlight)
2. Type "Terminal"
3. Press Enter
4. Terminal window opens ✅

**On Windows:**
1. Press `Win + R`
2. Type "cmd" or "powershell"
3. Press Enter

**On Linux:**
1. Press `Ctrl + Alt + T`
2. Terminal opens

---

## ✅ Step 1: Check if Docker is Installed

Before running the command, check if Docker is installed:

```bash
docker --version
```

**If you see a version number** (like `Docker version 24.0.0`):
- ✅ Docker is installed! Go to Step 2.

**If you see "command not found":**
- ❌ Docker is not installed. Go to "Install Docker" section below.

---

## 📥 Install Docker (If Needed)

### For Mac:

1. **Download Docker Desktop:**
   - Go to: https://www.docker.com/products/docker-desktop/
   - Click "Download for Mac"
   - Choose the right version:
     - **Apple Silicon (M1/M2/M3)**: Download "Mac with Apple chip"
     - **Intel Mac**: Download "Mac with Intel chip"

2. **Install:**
   - Open the downloaded `.dmg` file
   - Drag Docker to Applications folder
   - Open Docker from Applications
   - Follow the setup wizard
   - Docker icon should appear in your menu bar (top right)

3. **Verify:**
   ```bash
   docker --version
   ```
   Should show version number.

### For Windows:

1. **Download Docker Desktop:**
   - Go to: https://www.docker.com/products/docker-desktop/
   - Click "Download for Windows"
   - Run the installer
   - Follow the setup wizard
   - Restart your computer if prompted

2. **Verify:**
   ```bash
   docker --version
   ```

### For Linux:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Verify
docker --version
```

---

## 🚀 Step 2: Navigate to Your Project (Optional)

You can run the Docker command from anywhere, but it's good practice to be in your project folder:

```bash
cd /Users/FarooqK/reseller-feed-middleware
```

---

## 🐳 Step 3: Run the Docker Command

**Copy and paste this entire command into Terminal:**

```bash
docker run --name postgres-reseller \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=reseller_feed_middleware \
  -p 5432:5432 \
  -d postgres:15
```

### ⚠️ Important: Change the Password!

**Replace `your_secure_password` with a real password:**

```bash
docker run --name postgres-reseller \
  -e POSTGRES_PASSWORD=MySecurePass123! \
  -e POSTGRES_DB=reseller_feed_middleware \
  -p 5432:5432 \
  -d postgres:15
```

**Example with a password:**
```bash
docker run --name postgres-reseller \
  -e POSTGRES_PASSWORD=SuperSecret2024! \
  -e POSTGRES_DB=reseller_feed_middleware \
  -p 5432:5432 \
  -d postgres:15
```

### What This Command Does:

- `docker run` - Runs a Docker container
- `--name postgres-reseller` - Names the container "postgres-reseller"
- `-e POSTGRES_PASSWORD=...` - Sets the database password
- `-e POSTGRES_DB=reseller_feed_middleware` - Creates database automatically
- `-p 5432:5432` - Maps port 5432 (PostgreSQL default port)
- `-d` - Runs in background (detached mode)
- `postgres:15` - Uses PostgreSQL version 15

---

## ⏳ Step 4: Wait for Download and Start

**First time running this:**
- Docker will download PostgreSQL image (about 200-300 MB)
- This takes 1-5 minutes depending on your internet
- You'll see download progress in Terminal

**After download:**
- Container starts automatically
- You'll see a long string of letters/numbers (container ID)
- That means it's running! ✅

**Example output:**
```
Unable to find image 'postgres:15' locally
15: Pulling from library/postgres
...
Status: Downloaded newer image for postgres:15
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

The long string at the end is your container ID - that's normal!

---

## ✅ Step 5: Verify It's Running

Check if the container is running:

```bash
docker ps
```

**You should see:**
```
CONTAINER ID   IMAGE         COMMAND                  STATUS         PORTS                    NAMES
a1b2c3d4e5f6   postgres:15   "docker-entrypoint.s…"   Up 2 minutes   0.0.0.0:5432->5432/tcp   postgres-reseller
```

If you see `postgres-reseller` in the list with status "Up", it's working! ✅

---

## 🔗 Step 6: Get Your Connection String

**Your DATABASE_URL will be:**

```
postgresql://postgres:YOUR_PASSWORD@localhost:5432/reseller_feed_middleware
```

**Replace `YOUR_PASSWORD` with the password you used in Step 3.**

**Example:**
```
postgresql://postgres:SuperSecret2024!@localhost:5432/reseller_feed_middleware
```

---

## 📝 Step 7: Add to Your .env File

1. **Open your project folder** in a text editor
2. **Create or edit `.env` file**
3. **Add this line:**

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/reseller_feed_middleware
```

**Replace `YOUR_PASSWORD` with your actual password.**

**Example `.env` file:**
```env
DATABASE_URL=postgresql://postgres:SuperSecret2024!@localhost:5432/reseller_feed_middleware
PORT=3000
LOG_LEVEL=info
# ... other variables
```

---

## 🧪 Step 8: Test the Connection

Test if you can connect to the database:

```bash
# Test connection (replace YOUR_PASSWORD)
docker exec -it postgres-reseller psql -U postgres -d reseller_feed_middleware -c "SELECT version();"
```

**Or using psql directly (if you have it):**
```bash
psql postgresql://postgres:YOUR_PASSWORD@localhost:5432/reseller_feed_middleware -c "SELECT version();"
```

**You should see PostgreSQL version info** - that means it's working! ✅

---

## 🎯 Common Commands

### Stop the Container:
```bash
docker stop postgres-reseller
```

### Start the Container (if stopped):
```bash
docker start postgres-reseller
```

### View Logs:
```bash
docker logs postgres-reseller
```

### Remove the Container (if you want to start over):
```bash
docker stop postgres-reseller
docker rm postgres-reseller
```

### Connect to Database (Interactive):
```bash
docker exec -it postgres-reseller psql -U postgres -d reseller_feed_middleware
```

Then you can run SQL commands:
```sql
-- List tables
\dt

-- Exit
\q
```

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to Docker daemon"

**Solution:**
- Make sure Docker Desktop is running
- Check Docker icon in menu bar (Mac) or system tray (Windows)
- Click it and select "Start Docker"

### Problem: "Port 5432 is already in use"

**Solution:**
- Another PostgreSQL is already running on port 5432
- Stop it first, or use a different port:

```bash
# Use port 5433 instead
docker run --name postgres-reseller \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=reseller_feed_middleware \
  -p 5433:5432 \
  -d postgres:15
```

Then update DATABASE_URL to use port 5433:
```
postgresql://postgres:password@localhost:5433/reseller_feed_middleware
```

### Problem: Container keeps stopping

**Check logs:**
```bash
docker logs postgres-reseller
```

**Common causes:**
- Password too simple (PostgreSQL might reject it)
- Port conflict
- Docker out of memory

### Problem: Can't connect from your app

**Check:**
1. Container is running: `docker ps`
2. Password is correct in DATABASE_URL
3. Port matches (5432)
4. Database name matches (reseller_feed_middleware)

---

## ✅ Success Checklist

- [ ] Docker is installed and running
- [ ] Container is running (`docker ps` shows it)
- [ ] DATABASE_URL is set in `.env` file
- [ ] Can connect to database (test command works)
- [ ] Ready to run migrations!

---

## 🚀 Next Steps

After PostgreSQL is running:

1. **Run the migration:**
   ```bash
   npm run migrate:postgres
   ```

2. **Start your app:**
   ```bash
   npm run dev:all
   ```

3. **Check logs:**
   - Should see: `[DB] Using PostgreSQL database` ✅

---

**You're all set! 🎉** PostgreSQL is now running in Docker!

