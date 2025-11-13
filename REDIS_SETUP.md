# Redis Setup Guide

## Quick Answer: Do you need Redis?

**No, Redis is optional!** The app works without it, but caching won't work (you'll see warnings).

## Option 1: Skip Redis (Easiest) ⚠️

Just don't set any Redis environment variables. The app will work fine, but:
- ❌ No caching (slower responses)
- ❌ More API calls (higher costs)
- ✅ No setup needed
- ✅ Works immediately

## Option 2: Cloud Redis (Recommended for Teams) ☁️

### Using Redis Cloud (Free Tier: 30MB)

1. **Sign up**: https://redis.com/try-free/
2. **Create a database**:
   - Choose a cloud provider (AWS, GCP, Azure)
   - Select a region close to you
   - Choose "Free" tier
3. **Get connection URL**:
   - Go to your database dashboard
   - Copy the "Public endpoint" URL
   - Format: `redis://default:password@host:port`
4. **Add to `.env`**:
   ```env
   REDIS_URL=redis://default:your-password@your-host:port
   ```
5. **Share with team**: Everyone uses the same `REDIS_URL` in their `.env`

### Using Upstash (Free Tier: 10,000 commands/day)

1. **Sign up**: https://upstash.com/
2. **Create Redis database**:
   - Click "Create Database"
   - Choose region
   - Select "Free" tier
3. **Get connection URL**:
   - Click on your database
   - Copy the "Redis URL"
   - Format: `redis://default:password@host:port`
4. **Add to `.env`**:
   ```env
   REDIS_URL=redis://default:your-password@your-host:port
   ```

### Using Railway (Alternative)

1. **Sign up**: https://railway.app/
2. **Create Redis service**:
   - New Project → Add Service → Redis
3. **Get connection URL**:
   - Click on Redis service
   - Copy the "REDIS_URL" from variables
4. **Add to `.env`**:
   ```env
   REDIS_URL=redis://default:password@host:port
   ```

## Option 3: Local Redis (Solo Development) 💻

Each developer runs Redis on their own machine:

### macOS
```bash
# Install Redis
brew install redis

# Start Redis (runs in background)
brew services start redis

# Or run manually
redis-server
```

### Linux
```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis

# Enable on boot (optional)
sudo systemctl enable redis
```

### Windows
```bash
# Install via WSL or use Docker
docker run -d -p 6379:6379 redis:alpine
```

Then in `.env` (or leave empty for default `localhost:6379`):
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Option 4: Shared Local Redis (Not Recommended) ⚠️

If one person runs Redis on their laptop for the team:

1. **On the Redis host machine**:
   ```bash
   # Edit Redis config to allow external connections
   # macOS: /opt/homebrew/etc/redis.conf
   # Linux: /etc/redis/redis.conf
   
   # Change:
   bind 127.0.0.1
   # To:
   bind 0.0.0.0
   
   # Add password (important for security!)
   requirepass your-secure-password
   
   # Restart Redis
   brew services restart redis  # macOS
   sudo systemctl restart redis  # Linux
   ```

2. **Find the host IP**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

3. **Configure firewall** (allow port 6379)

4. **Everyone else sets in `.env`**:
   ```env
   REDIS_URL=redis://:your-secure-password@192.168.1.100:6379
   ```

⚠️ **Security Warning**: This exposes Redis to your local network. Only use on trusted networks!

## Verification

Test Redis connection:
```bash
# Using redis-cli
redis-cli ping
# Should return: PONG

# Or test with your connection URL
redis-cli -u redis://your-redis-url ping
```

## Troubleshooting

### "Redis is required but not configured"
- Set `REDIS_URL` or `REDIS_HOST` in `.env`
- Or skip Redis (app works without it)

### "Failed to connect to Redis"
- Check if Redis is running: `redis-cli ping`
- Verify connection URL is correct
- Check firewall/network settings
- For cloud Redis: verify credentials and network access

### "Connection refused"
- Redis might not be running
- Wrong host/port
- Firewall blocking connection

## Best Practice for Teams

**Use Option 2 (Cloud Redis)** - One shared Redis instance:
- ✅ Everyone benefits from shared cache
- ✅ No setup needed for each developer
- ✅ Always available
- ✅ Secure by default
- ✅ Free tier available

## Environment Variables

```env
# Option 1: Full URL (recommended)
REDIS_URL=redis://default:password@host:port

# Option 2: Separate host/port
REDIS_HOST=localhost
REDIS_PORT=6379

# Option 3: With password
REDIS_URL=redis://:password@host:port
```

## Summary

- **Solo development**: Local Redis (Option 3) or skip it (Option 1)
- **Team development**: Cloud Redis (Option 2) - everyone uses same `REDIS_URL`
- **Production**: Cloud Redis (Option 2) - use paid tier for better performance

