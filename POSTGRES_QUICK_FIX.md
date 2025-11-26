# 🔧 Quick Fix: createdb Command Not Found

## Problem

You're getting: `zsh: command not found: createdb`

This means PostgreSQL's command-line tools aren't in your PATH.

---

## ✅ Solution: Add PostgreSQL to PATH

### Step 1: Find Where PostgreSQL is Installed

```bash
# Check if PostgreSQL is installed via Homebrew
brew list postgresql@15

# Or find the installation path
brew --prefix postgresql@15
```

### Step 2: Add to PATH

**For Apple Silicon Macs (M1/M2/M3):**
```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**For Intel Macs:**
```bash
echo 'export PATH="/usr/local/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Step 3: Verify It Works

```bash
# Check if createdb is now available
which createdb

# Should show: /opt/homebrew/opt/postgresql@15/bin/createdb
# or: /usr/local/opt/postgresql@15/bin/createdb

# Now create the database
createdb reseller_feed_middleware
```

---

## 🔄 Alternative: Use psql Instead

If you don't want to modify PATH, you can use `psql` directly:

### Method 1: Using psql with full path

```bash
# For Apple Silicon:
/opt/homebrew/opt/postgresql@15/bin/psql postgres -c "CREATE DATABASE reseller_feed_middleware;"

# For Intel:
/usr/local/opt/postgresql@15/bin/psql postgres -c "CREATE DATABASE reseller_feed_middleware;"
```

### Method 2: Interactive psql

```bash
# Connect to PostgreSQL
psql postgres

# If psql also not found, use full path:
# /opt/homebrew/opt/postgresql@15/bin/psql postgres

# Then in psql, run:
CREATE DATABASE reseller_feed_middleware;

# Exit
\q
```

---

## 🐳 Alternative: Use Docker (Easiest)

If you have Docker, this is the easiest way:

```bash
# Run PostgreSQL in Docker (creates database automatically)
docker run --name postgres-reseller \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=reseller_feed_middleware \
  -p 5432:5432 \
  -d postgres:15

# Your DATABASE_URL will be:
# postgresql://postgres:your_secure_password@localhost:5432/reseller_feed_middleware
```

---

## ✅ Verify Database Was Created

```bash
# List all databases
psql postgres -l

# Or if psql not in PATH:
/opt/homebrew/opt/postgresql@15/bin/psql postgres -l

# You should see reseller_feed_middleware in the list
```

---

## 🎯 Quick Reference

**After adding to PATH:**
```bash
createdb reseller_feed_middleware  # Create database
dropdb reseller_feed_middleware    # Delete database
psql reseller_feed_middleware      # Connect to database
```

**Without PATH (using full path):**
```bash
# Apple Silicon
/opt/homebrew/opt/postgresql@15/bin/createdb reseller_feed_middleware

# Intel
/usr/local/opt/postgresql@15/bin/createdb reseller_feed_middleware
```

---

**That's it! Your database should be created now. 🎉**

