# Render.com Deployment Guide

## Prerequisites

1. **MongoDB Database**: 
   - Create a MongoDB database (MongoDB Atlas recommended)
   - Get your connection string (MONGO_URL)

2. **Render.com Account**: 
   - Sign up at https://render.com

---

## Step 1: Prepare Your Code

✅ Your code is now production-ready with:
- Production build scripts
- CORS configuration
- Environment variable validation
- Proper error handling
- 0.0.0.0 binding for Render

---

## Step 2: Push to GitHub

```bash
git add .
git commit -m "Production ready for Render"
git push origin main
```

---

## Step 3: Deploy on Render.com

### Option A: Using render.yaml (Recommended)

1. Go to Render Dashboard
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Review and deploy

### Option B: Manual Setup

1. **Create New Web Service**:
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

2. **Configure Build Settings**:
   - **Name**: `fergana-backend` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `.` (root)

3. **Set Environment Variables**:
   Click "Environment" tab and add:

   ```
   NODE_ENV=production
   MONGO_URL=your_mongodb_connection_string
   FRONTEND_URL=https://your-frontend-url.com
   SECRET_TOKEN=your_jwt_secret_token
   AUTH_TIMER=24
   PORT=10000 (Render sets this automatically, but you can specify)
   ```

   **Important**: 
   - Replace `your_mongodb_connection_string` with your actual MongoDB connection string
   - Replace `your-frontend-url.com` with your frontend URL
   - Replace `your_jwt_secret_token` with a strong secret (use `openssl rand -base64 32`)

4. **Advanced Settings**:
   - **Auto-Deploy**: `Yes` (deploys on every push)
   - **Health Check Path**: `/` (or create a health endpoint)

---

## Step 4: Environment Variables

### Required Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `FRONTEND_URL` | Your frontend URL | `https://your-app.com` |
| `SECRET_TOKEN` | JWT secret token | `your-secret-token-here` |
| `NODE_ENV` | Environment | `production` |

### Optional Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_TIMER` | JWT expiration (hours) | `24` |
| `PORT` | Server port | `3003` (Render sets automatically) |

---

## Step 5: Verify Deployment

1. **Check Logs**:
   - Go to your service in Render
   - Click "Logs" tab
   - Look for: "MongoDB connection succeed"
   - Look for: "The server is running successfully"

2. **Test API**:
   ```bash
   curl https://your-service.onrender.com/member/restaurant
   ```

3. **Test WebSocket**:
   - Your WebSocket URL will be: `wss://your-service.onrender.com`
   - Test connection from frontend

---

## Step 6: Update Frontend

Update your frontend Socket.io connection:

```javascript
// Production
const socket = io('https://your-service.onrender.com', {
  auth: { token: yourToken }
});

// Or use environment variable
const socket = io(process.env.REACT_APP_BACKEND_URL, {
  auth: { token: yourToken }
});
```

---

## Troubleshooting

### Issue: "MongoDB connection failed"
- **Solution**: Check MONGO_URL in environment variables
- Make sure MongoDB Atlas allows connections from Render IPs (0.0.0.0/0)

### Issue: "Port already in use"
- **Solution**: Render sets PORT automatically, don't hardcode it

### Issue: "CORS errors"
- **Solution**: Set FRONTEND_URL environment variable correctly

### Issue: "Build failed"
- **Solution**: Check build logs, ensure all dependencies are in package.json

### Issue: "Service keeps restarting"
- **Solution**: Check logs for errors, verify all environment variables are set

---

## Production Checklist

- [x] Environment variables configured
- [x] MongoDB connection string set
- [x] CORS configured for frontend URL
- [x] Build scripts configured
- [x] Error handling in place
- [x] Server binds to 0.0.0.0
- [x] Health check endpoint (optional but recommended)

---

## Health Check Endpoint (Optional)

Add to `src/router.ts`:

```typescript
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
```

---

## Security Notes

1. **Never commit `.env` file** (already in .gitignore ✅)
2. **Use strong SECRET_TOKEN** (32+ characters)
3. **Set FRONTEND_URL** to your actual frontend domain
4. **Enable MongoDB authentication**
5. **Use HTTPS** (Render provides automatically)

---

## Cost Optimization

- Render free tier: 750 hours/month
- Use "Spin down" for free tier (service sleeps after inactivity)
- Consider paid tier for 24/7 uptime

---

## Support

If you encounter issues:
1. Check Render logs
2. Check MongoDB connection
3. Verify environment variables
4. Test locally with production env vars

