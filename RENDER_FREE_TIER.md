# 🚀 Deploy to Render.com - Free Tier Guide

## ✅ Prerequisites (You Have These):
- ✅ MongoDB Atlas connected
- ✅ GitHub repo: `Fergana-Restaurant` pushed

---

## Step-by-Step Deployment (Free Tier)

### Step 1: Sign Up for Render.com
1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. **Sign up with GitHub** (recommended)
4. Verify your email if needed

---

### Step 2: Create Web Service

1. **In Render Dashboard:**
   - Click **"New"** button (top right)
   - Select **"Web Service"**

2. **Connect GitHub:**
   - If not connected, click **"Connect GitHub"**
   - Authorize Render to access your repositories
   - Select your repository: **`Fergana-Restaurant`**
   - Click **"Connect"**

---

### Step 3: Configure Service

Fill in these settings:

| Field | Value |
|-------|-------|
| **Name** | `fergana-backend` |
| **Environment** | `Node` |
| **Region** | Choose closest (e.g., `Oregon (US West)`) |
| **Branch** | `main` (or `master`) |
| **Root Directory** | Leave **empty** |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm start` |

**Plan Selection:**
- Select **"Free"** plan
- Click **"Create Web Service"**

---

### Step 4: Set Environment Variables

After service is created:

1. Go to **"Environment"** tab (left sidebar)
2. Click **"Add Environment Variable"**
3. Add these variables one by one:

#### Required Variables:

| Key | Value | How to Get |
|-----|-------|------------|
| `NODE_ENV` | `production` | Type manually |
| `MONGO_URL` | `mongodb+srv://...` | From MongoDB Atlas:<br>Database → Connect → Connect your application |
| `FRONTEND_URL` | `https://dashboard.your-app.com` | **Dashboard URL** (for staff/owner/admin) |
| `CLIENT_URL` | `https://client.your-app.com` | **Client URL** (for customers/QR code users) |
| `SECRET_TOKEN` | `your-secret-here` | Generate with:<br>`openssl rand -base64 32` |

#### Optional Variable:

| Key | Value |
|-----|-------|
| `AUTH_TIMER` | `24` |

**How to Generate SECRET_TOKEN:**
```bash
openssl rand -base64 32
```
Or use any online random string generator (32+ characters).

4. Click **"Save Changes"** after adding all variables

---

### Step 5: Monitor Deployment

1. Go to **"Logs"** tab
2. Watch for these success messages:

```
✓ npm install completed
✓ npm run build completed
✓ MongoDB connection succeed
✓ The server is running successfully on port: 10000
```

3. Wait 2-5 minutes for deployment to complete
4. Status should show: **"Live"** (green)

---

### Step 6: Test Your Deployment

Your service URL will be:
```
https://fergana-backend.onrender.com
```

**Test Health Endpoint:**
Open in browser or use curl:
```
https://fergana-backend.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "service": "Fergana Backend API"
}
```

---

## 📝 Quick Checklist

- [ ] Render.com account created
- [ ] GitHub connected to Render
- [ ] Web Service created from `Fergana-Restaurant` repo
- [ ] Service configured:
  - [ ] Name: `fergana-backend`
  - [ ] Environment: `Node`
  - [ ] Build Command: `npm install && npm run build`
  - [ ] Start Command: `npm start`
  - [ ] Plan: `Free`
- [ ] Environment variables set:
  - [ ] `NODE_ENV=production`
  - [ ] `MONGO_URL=your_mongodb_connection_string`
  - [ ] `FRONTEND_URL=your_dashboard_url` (staff/owner/admin)
  - [ ] `CLIENT_URL=your_client_url` (customers/QR code)
  - [ ] `SECRET_TOKEN=your_generated_token`
- [ ] Deployment successful (green "Live" status)
- [ ] Health endpoint tested

---

## 🔍 Troubleshooting

### Build Fails?
- **Check logs** in Render dashboard
- Ensure all files are pushed to GitHub
- Verify `package.json` has all dependencies
- Check TypeScript compilation: `npm run build` works locally

### MongoDB Connection Fails?
- Double-check `MONGO_URL` in environment variables
- Make sure MongoDB Atlas **Network Access** allows `0.0.0.0/0`
- Verify username/password in connection string
- Test connection string locally

### Service Keeps Restarting?
- Check logs for errors
- Verify all environment variables are set correctly
- Check MongoDB connection
- Look for TypeScript errors in build logs

### Service is "Unavailable"?
- Free tier services **spin down** after 15 min inactivity
- First request after spin-down takes 30-60 seconds
- This is normal for free tier

### CORS Errors?
- Set both `FRONTEND_URL` (dashboard) and `CLIENT_URL` (client) environment variables
- Include full URL with protocol: `https://your-frontend.com`
- Not just domain name
- Both URLs are automatically allowed for CORS

---

## 💡 Free Tier Notes

- **750 hours/month** (enough for most projects)
- **Service spins down** after 15 minutes of inactivity
- **First request** after spin-down may take 30-60 seconds (cold start)
- **Auto-deploy** on every push to `main` branch (can enable in Settings)
- **Logs** available for debugging

---

## 🎉 After Deployment

Your backend will be live at:
```
https://fergana-backend.onrender.com
```

**WebSocket URL:**
```
wss://fergana-backend.onrender.com
```

---

## 📱 Update Frontend

Update your frontend code:

```javascript
// API Base URL
const API_URL = 'https://fergana-backend.onrender.com';

// Socket.io Connection
import io from 'socket.io-client';

const socket = io('https://fergana-backend.onrender.com', {
  auth: {
    token: yourAuthToken // For authenticated users
  },
  transports: ['websocket', 'polling']
});
```

---

## ✅ Success!

Your backend is now deployed and ready for production! 🚀

**Need Help?** Check Render documentation: https://render.com/docs

