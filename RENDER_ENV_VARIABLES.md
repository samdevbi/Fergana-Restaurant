# 🔐 Environment Variables for Render.com (Free Tier)

## Required Environment Variables

Set these in your Render.com dashboard under **Environment** tab:

### 1. `NODE_ENV`
- **Value**: `production`
- **Purpose**: Sets the environment to production
- **Required**: ✅ Yes

```
NODE_ENV=production
```

---

### 2. `MONGO_URL`
- **Value**: Your MongoDB Atlas connection string
- **Purpose**: Database connection
- **Required**: ✅ Yes
- **How to get**:
  1. Go to MongoDB Atlas
  2. Click **Database** → **Connect**
  3. Choose **"Connect your application"**
  4. Copy the connection string
  5. Replace `<password>` with your database password
  6. Replace `<dbname>` with your database name (optional)

**Example:**
```
MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fergana?retryWrites=true&w=majority
```

---

### 3. `FRONTEND_URL`
- **Value**: Your dashboard/admin frontend URL
- **Purpose**: CORS and WebSocket for staff/owner/admin dashboard
- **Required**: ✅ Yes
- **Format**: Full URL with protocol

**Examples:**
```
# Production
FRONTEND_URL=https://dashboard.your-restaurant.com

# Development/Testing
FRONTEND_URL=http://localhost:3000
```

---

### 4. `CLIENT_URL`
- **Value**: Your customer/client frontend URL
- **Purpose**: CORS and WebSocket for customer-facing app, QR code generation
- **Required**: ✅ Yes
- **Format**: Full URL with protocol

**Examples:**
```
# Production
CLIENT_URL=https://your-restaurant.com

# Development/Testing
CLIENT_URL=http://localhost:3001
```

**Note**: If you have the same URL for both, set both to the same value.

---

### 5. `SECRET_TOKEN`
- **Value**: A secure random string (32+ characters)
- **Purpose**: JWT token signing secret
- **Required**: ✅ Yes
- **How to generate**:
  ```bash
  openssl rand -base64 32
  ```
  Or use any online random string generator (32+ characters)

**Example:**
```
SECRET_TOKEN=K8j3mN9pQ2rT5vX8zA1bC4dE7fG0hI3jK6lM9nO2pQ5rS8tU1vW4xY7zA0bC3d
```

**⚠️ Important**: Keep this secret! Never commit it to Git.

---

## Optional Environment Variables

### 6. `AUTH_TIMER`
- **Value**: Number (hours)
- **Purpose**: JWT token expiration time in hours
- **Required**: ❌ No (defaults to 24 hours)
- **Default**: `24`

**Example:**
```
AUTH_TIMER=24
```

---

### 7. `PORT`
- **Value**: Port number
- **Purpose**: Server port (Render sets this automatically)
- **Required**: ❌ No (Render provides automatically)
- **Note**: Render automatically sets this, you don't need to set it manually

---

## 📋 Complete Environment Variables List for Render

Copy and paste these into Render.com **Environment** tab:

```
NODE_ENV=production
MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fergana?retryWrites=true&w=majority
FRONTEND_URL=https://dashboard.your-restaurant.com
CLIENT_URL=https://your-restaurant.com
SECRET_TOKEN=your-generated-secret-token-here
AUTH_TIMER=24
```

---

## 🔧 How to Set in Render.com

### Step-by-Step:

1. **Go to your Render service**
   - Click on your service name (e.g., `fergana-backend`)

2. **Open Environment tab**
   - Click **"Environment"** in the left sidebar

3. **Add each variable**
   - Click **"Add Environment Variable"**
   - Enter **Key** and **Value**
   - Click **"Save Changes"**
   - Repeat for each variable

4. **Deploy**
   - After adding all variables, Render will automatically redeploy
   - Or click **"Manual Deploy"** → **"Deploy latest commit"**

---

## ✅ Verification Checklist

Before deploying, make sure you have:

- [ ] `NODE_ENV=production`
- [ ] `MONGO_URL` - Your MongoDB Atlas connection string
- [ ] `FRONTEND_URL` - Dashboard/admin URL
- [ ] `CLIENT_URL` - Customer/client URL
- [ ] `SECRET_TOKEN` - Generated secure token (32+ chars)
- [ ] `AUTH_TIMER=24` (optional, but recommended)

---

## 🧪 Testing Your Environment Variables

After deployment, test your API:

1. **Health Check:**
   ```
   https://your-service.onrender.com/health
   ```

2. **Should return:**
   ```json
   {
     "status": "ok",
     "timestamp": "2024-...",
     "service": "Fergana Backend API"
   }
   ```

3. **Check Logs:**
   - Go to **"Logs"** tab in Render
   - Look for: `MongoDB connection succeed`
   - Look for: `The server is running successfully`

---

## 🔒 Security Notes

1. **Never commit `.env` file** ✅ (already in .gitignore)
2. **Use strong SECRET_TOKEN** (32+ characters)
3. **Keep MongoDB password secure**
4. **Use HTTPS URLs** in production
5. **Don't share environment variables** publicly

---

## 📝 Quick Reference

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | ✅ Yes | `production` |
| `MONGO_URL` | ✅ Yes | `mongodb+srv://...` |
| `FRONTEND_URL` | ✅ Yes | `https://dashboard.app.com` |
| `CLIENT_URL` | ✅ Yes | `https://app.com` |
| `SECRET_TOKEN` | ✅ Yes | `K8j3mN9pQ2rT5v...` |
| `AUTH_TIMER` | ❌ No | `24` |
| `PORT` | ❌ No | (Auto-set by Render) |

---

## 🆘 Troubleshooting

### MongoDB Connection Fails?
- ✅ Check `MONGO_URL` is correct
- ✅ Verify password in connection string
- ✅ Check MongoDB Atlas Network Access (allow 0.0.0.0/0)

### CORS Errors?
- ✅ Verify `FRONTEND_URL` and `CLIENT_URL` are set correctly
- ✅ Include full URL with protocol (`https://` not just domain)
- ✅ No trailing slash

### Authentication Fails?
- ✅ Check `SECRET_TOKEN` is set
- ✅ Verify token is 32+ characters
- ✅ Ensure same token is used consistently

---

**Ready to deploy!** 🚀

