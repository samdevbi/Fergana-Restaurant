# 🚀 Deploy to Render.com - Quick Guide (Free Tier)

## ✅ You Already Have:
- ✅ MongoDB Atlas connected
- ✅ GitHub repo: `Fergana-Restaurant` pushed

## 🎯 Next Steps:

### Step 1: Create Render.com Account
1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. **Sign up with GitHub** (recommended - easier to connect repo)
4. Verify email if needed

---

### Step 2: Create Web Service (Free Tier Method) ⭐

#### 2.1 Create New Web Service
1. In Render Dashboard, click **"New"** → **"Web Service"**
2. If GitHub not connected, click **"Connect GitHub"** and authorize
3. Select your repository: **`Fergana-Restaurant`**
4. Click **"Connect"**

#### 2.2 Configure Service Settings
Fill in the form with these exact values:

- **Name**: `fergana-backend` (or your choice)
- **Environment**: `Node`
- **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
- **Branch**: `main` (or `master` if that's your branch)
- **Root Directory**: Leave **empty** (`.`)
- **Build Command**: `npm install --include=dev && npm run build`
- **Start Command**: `npm start`

#### 2.3 Choose Plan
- Select **"Free"** plan
- Click **"Create Web Service"**

#### 2.4 Set Environment Variables
After service is created, go to **"Environment"** tab and add:

| Key | Value | Where to Get |
|-----|-------|--------------|
| `NODE_ENV` | `production` | Type manually |
| `MONGO_URL` | `mongodb+srv://...` | From MongoDB Atlas (Database → Connect → Connect your application) |
| `FRONTEND_URL` | `https://dashboard.your-app.com` | **Dashboard URL** (for staff/owner/admin) |
| `CLIENT_URL` | `https://client.your-app.com` | **Client URL** (for customers/QR code users) |
| `SECRET_TOKEN` | `your-secret-here` | Generate with command below |
| `AUTH_TIMER` | `24` | Optional (defaults to 24) |

**Generate SECRET_TOKEN:**
```bash
openssl rand -base64 32
```
Or use any random string generator (32+ characters).

#### 2.5 Deploy
1. Click **"Save Changes"** after adding all environment variables
2. Render will automatically start building
3. Wait 2-5 minutes for deployment
4. Watch the **"Logs"** tab to see progress

**Note:** On free tier, service may "spin down" after 15 minutes of inactivity. First request after spin-down may take 30-60 seconds.

---

### Step 3: Verify Deployment

#### 3.1 Check Logs
Look for these success messages:
```
✓ npm install completed
✓ npm run build completed
✓ MongoDB connection succeed
✓ The server is running successfully on port: 10000
```

#### 3.2 Test Your API
Your service URL will be: `https://fergana-backend.onrender.com`

Test health endpoint:
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
- [ ] Blueprint created from `Fergana-Restaurant` repo
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
- Check logs in Render
- Ensure all files are pushed to GitHub
- Verify `package.json` has all dependencies

### MongoDB Connection Fails?
- Double-check `MONGO_URL` in environment variables
- Make sure MongoDB Atlas Network Access allows `0.0.0.0/0`
- Verify username/password in connection string

### Service Keeps Restarting?
- Check logs for errors
- Verify all environment variables are set correctly
- Check MongoDB connection

---

## 🎉 After Deployment

Your backend will be live at:
```
https://fergana-backend.onrender.com
```

WebSocket URL:
```
wss://fergana-backend.onrender.com
```

---

## 📱 Update Frontend

Update your frontend to use:
```javascript
const API_URL = 'https://fergana-backend.onrender.com';
const SOCKET_URL = 'https://fergana-backend.onrender.com';
```

---

**Ready?** Go to https://render.com and start deploying! 🚀

