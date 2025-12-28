# 🚀 Step-by-Step: Deploy to Render.com

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- [ ] GitHub account
- [ ] Render.com account (sign up at https://render.com)
- [ ] MongoDB database (MongoDB Atlas recommended: https://www.mongodb.com/cloud/atlas)

---

## Step 1: Prepare MongoDB Database

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a new cluster (Free tier: M0)

### 1.2 Configure Database Access
1. Go to **Database Access** → **Add New Database User**
2. Create username and password (save these!)
3. Set privileges: **Read and write to any database**

### 1.3 Configure Network Access
1. Go to **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (0.0.0.0/0)
   - This allows Render.com to connect

### 1.4 Get Connection String
1. Go to **Database** → Click **Connect**
2. Choose **Connect your application**
3. Copy the connection string
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority`
4. **Replace `<password>` with your actual password**
5. **Save this connection string** - you'll need it in Step 4

---

## Step 2: Push Code to GitHub

### 2.1 Initialize Git (if not already done)
```bash
cd "/Users/xureyre/Desktop/Fergana Backend"
git init
git add .
git commit -m "Production ready for Render"
```

### 2.2 Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `fergana-backend` (or your choice)
3. Set to **Private** (recommended) or **Public**
4. **Don't** initialize with README
5. Click **Create repository**

### 2.3 Push to GitHub
```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/fergana-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your GitHub username**

---

## Step 3: Create Render.com Account

1. Go to https://render.com
2. Click **Get Started for Free**
3. Sign up with GitHub (recommended) or email
4. Verify your email if needed

---

## Step 4: Deploy on Render.com

### Option A: Using Blueprint (render.yaml) - RECOMMENDED ⭐

#### 4.1 Create Blueprint
1. Go to Render Dashboard
2. Click **New** → **Blueprint**
3. Connect your GitHub account (if not connected)
4. Select your repository: `fergana-backend`
5. Click **Apply**

#### 4.2 Render will auto-detect `render.yaml`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Environment: `Node`

#### 4.3 Set Environment Variables
After the service is created, go to **Environment** tab and add:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Required |
| `MONGO_URL` | `mongodb+srv://...` | Your MongoDB connection string from Step 1.4 |
| `FRONTEND_URL` | `https://your-frontend.com` | Your frontend URL (or `http://localhost:3000` for testing) |
| `SECRET_TOKEN` | `your-secret-here` | Generate with: `openssl rand -base64 32` |
| `AUTH_TIMER` | `24` | Optional (defaults to 24 hours) |

**How to generate SECRET_TOKEN:**
```bash
openssl rand -base64 32
```

#### 4.4 Deploy
1. Click **Save Changes**
2. Render will automatically start building
3. Wait for deployment (2-5 minutes)

---

### Option B: Manual Setup

#### 4.1 Create Web Service
1. Go to Render Dashboard
2. Click **New** → **Web Service**
3. Connect GitHub (if not connected)
4. Select repository: `fergana-backend`
5. Click **Connect**

#### 4.2 Configure Service
Fill in the form:

- **Name**: `fergana-backend`
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `.` (leave empty)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

#### 4.3 Set Environment Variables
Click **Advanced** → **Add Environment Variable**:

Add these variables (same as Option A):

```
NODE_ENV=production
MONGO_URL=your_mongodb_connection_string_here
FRONTEND_URL=https://your-frontend-url.com
SECRET_TOKEN=your_generated_secret_token
AUTH_TIMER=24
```

#### 4.4 Create Service
1. Click **Create Web Service**
2. Render will start building automatically

---

## Step 5: Monitor Deployment

### 5.1 Watch Build Logs
1. Go to your service in Render
2. Click **Logs** tab
3. Watch for:
   ```
   ✓ npm install completed
   ✓ npm run build completed
   ✓ MongoDB connection succeed
   ✓ The server is running successfully on port: 10000
   ```

### 5.2 Check Service Status
- Status should show: **Live** (green)
- URL will be: `https://fergana-backend.onrender.com` (or your custom name)

---

## Step 6: Test Your Deployment

### 6.1 Test API Endpoint
Open in browser or use curl:
```bash
curl https://your-service.onrender.com/
```

### 6.2 Test Health (if you add health endpoint)
```bash
curl https://your-service.onrender.com/health
```

### 6.3 Test from Postman
1. Use your Render URL: `https://your-service.onrender.com`
2. Test endpoints:
   - `POST /member/signup`
   - `GET /qr/:tableId/menu`
   - etc.

---

## Step 7: Update Frontend

### 7.1 Update API Base URL
In your frontend code, update:
```javascript
// Before (local)
const API_URL = 'http://localhost:3003';

// After (production)
const API_URL = 'https://your-service.onrender.com';
```

### 7.2 Update Socket.io Connection
```javascript
import io from 'socket.io-client';

// Production
const socket = io('https://your-service.onrender.com', {
  auth: {
    token: yourAuthToken // For authenticated users
  },
  transports: ['websocket', 'polling']
});

// For anonymous QR customers
const socket = io('https://your-service.onrender.com', {
  transports: ['websocket', 'polling']
});
```

---

## Step 8: Configure Auto-Deploy (Optional)

1. Go to your service → **Settings**
2. Under **Auto-Deploy**, select:
   - **Yes** - Deploys on every push to `main` branch
   - **No** - Manual deploy only

---

## ✅ Deployment Complete!

Your backend is now live at: `https://your-service.onrender.com`

---

## 🔍 Troubleshooting

### Problem: Build Failed
**Solution:**
- Check build logs in Render
- Ensure all dependencies are in `package.json`
- Verify TypeScript compiles: `npm run build` locally

### Problem: MongoDB Connection Failed
**Solution:**
- Verify `MONGO_URL` is correct
- Check MongoDB Network Access allows 0.0.0.0/0
- Verify database user credentials

### Problem: Service Keeps Restarting
**Solution:**
- Check logs for errors
- Verify all required environment variables are set
- Check MongoDB connection

### Problem: CORS Errors
**Solution:**
- Set `FRONTEND_URL` environment variable correctly
- Include protocol: `https://your-frontend.com` (not just domain)

### Problem: WebSocket Not Working
**Solution:**
- Render supports WebSocket on same port
- Use `wss://` (secure WebSocket) in production
- Check Socket.io CORS configuration

---

## 📝 Quick Reference

### Your Render Service URL
```
https://your-service-name.onrender.com
```

### WebSocket URL
```
wss://your-service-name.onrender.com
```

### Environment Variables Needed
```
NODE_ENV=production
MONGO_URL=mongodb+srv://...
FRONTEND_URL=https://...
SECRET_TOKEN=...
AUTH_TIMER=24
```

### Useful Commands
```bash
# Test locally with production env
NODE_ENV=production MONGO_URL=... npm start

# Check build locally
npm run build

# View compiled files
ls dist/
```

---

## 🎉 Success!

Your backend is now deployed and ready for production use!

**Next Steps:**
1. Test all API endpoints
2. Update frontend to use production URL
3. Monitor logs for any issues
4. Set up custom domain (optional)

---

## 💡 Tips

- **Free Tier**: 750 hours/month (enough for most projects)
- **Spin Down**: Free tier services sleep after 15 min inactivity
- **First Request**: May take 30-60 seconds (cold start)
- **Logs**: Always check logs if something doesn't work
- **Environment Variables**: Never commit `.env` file (already in .gitignore ✅)

---

**Need Help?** Check Render documentation: https://render.com/docs

