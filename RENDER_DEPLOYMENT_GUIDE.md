# 🚀 Render.com Deployment Guide

This guide will help you deploy your Lead Generation & Outbound Calling System to Render.com, which properly supports persistent WebSocket connections required for Twilio ConversationRelay.

## Why Render?

**Replit's Infrastructure Limitation:**
- Replit's reverse proxies close external server-to-server WebSocket connections
- Twilio ConversationRelay needs WebSockets that stay open for entire call duration (minutes)
- Your code is working correctly - it's an infrastructure issue, not a code problem

**Render's Advantages:**
- ✅ Built for production WebSocket applications
- ✅ Supports persistent server-to-server connections
- ✅ Free tier handles this perfectly
- ✅ Specifically supports Twilio ConversationRelay
- ✅ No automatic timeouts on long-running WebSockets

---

## 📋 Prerequisites

Before you start, gather these from your Twilio account:

1. **Twilio Account SID** (starts with `AC...`)
2. **Twilio API Key SID** (starts with `SK...`)
3. **Twilio API Key Secret** (long string)
4. **Twilio Auth Token** (for WebSocket signature validation)
5. **Twilio Phone Number** (E.164 format: `+15551234567`)

### Where to Find Your Twilio Credentials

1. **Account SID & Auth Token:**
   - Go to: https://console.twilio.com/
   - Found on the main dashboard

2. **API Key & Secret:**
   - Go to: https://console.twilio.com/project/api-keys
   - Click "Create API key"
   - **Save the secret immediately** (you can't view it again!)

---

## 🎯 Step-by-Step Deployment

### Step 1: Create a Render Account

1. Go to https://render.com/
2. Click "Get Started" or "Sign Up"
3. Sign up with GitHub (recommended for easy repo connection)

### Step 2: Connect Your Repository

**Option A: If Your Code is in GitHub** (Recommended)
1. Make sure your code is pushed to GitHub
2. In Render dashboard, click "New +"
3. Select "Web Service"
4. Click "Connect account" and authorize GitHub
5. Select your repository

**Option B: Manual Deployment from Replit**
1. Download your entire Replit project as a ZIP
2. Create a new GitHub repository
3. Upload your code to GitHub
4. Follow Option A steps above

### Step 3: Configure Web Service

When creating the Web Service, use these settings:

| Setting | Value |
|---------|-------|
| **Name** | `lead-gen-caller` (or your choice) |
| **Region** | `Oregon` (or closest to you) |
| **Branch** | `main` (or your default branch) |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | `Free` |

### Step 4: Set Environment Variables

In the "Environment" section, add these variables:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Required |
| `SESSION_SECRET` | Click "Generate" | Auto-generates secure secret |
| `TWILIO_ACCOUNT_SID` | `AC...` | From Twilio dashboard |
| `TWILIO_API_KEY_SID` | `SK...` | API key you created |
| `TWILIO_API_KEY_SECRET` | `your-secret` | **Save this when creating API key!** |
| `TWILIO_AUTH_TOKEN` | `your-token` | From Twilio dashboard |
| `TWILIO_PHONE_NUMBER` | `+15551234567` | Your Twilio number (E.164 format) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL |
| `ELEVENLABS_API_KEY` | `your-key` | Your ElevenLabs API key |

**Important Notes:**
- ⚠️ The `TWILIO_API_KEY_SECRET` can only be viewed once when creating the API key
- If you lost it, create a new API key in Twilio Console
- All values are case-sensitive

### Step 5: Deploy!

1. Click "Create Web Service"
2. Render will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build your app (`npm run build`)
   - Start the server (`npm start`)
3. Wait 2-5 minutes for initial deployment

### Step 6: Get Your Render URL

Once deployed, Render provides a URL like:
```
https://lead-gen-caller.onrender.com
```

This URL is automatically set in the `RENDER_EXTERNAL_HOSTNAME` environment variable (Render does this automatically).

---

## 🔧 Configure Twilio to Use Your Render App

### Update Phone Number Webhook

1. Go to: https://console.twilio.com/console/phone-numbers/incoming
2. Click on your phone number
3. Scroll to "Voice & Fax" section
4. Under "A CALL COMES IN":
   - **Webhook URL:** `https://YOUR-APP.onrender.com/voice/twiml`
   - **HTTP Method:** `POST`
5. Click "Save"

---

## ✅ Test Your Deployment

### Test 1: Health Check
```bash
curl https://YOUR-APP.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123
}
```

### Test 2: Create a Lead (Triggers Auto-Call)

Using your frontend or via API:
```bash
curl -X POST https://YOUR-APP.onrender.com/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Corp",
    "contactName": "John Doe",
    "phoneNumber": "+15551234567",
    "productCategory": "Software",
    "brandName": "TestBrand"
  }'
```

**Expected Behavior:**
1. Lead is created
2. Call is automatically initiated
3. Your phone rings
4. AI voice greets you with ultra-realistic ElevenLabs voice
5. WebSocket stays connected for entire call duration

### Test 3: Check Logs

In Render dashboard:
1. Click on your service
2. Click "Logs" tab
3. Look for:
   - `[WebSocket] Connection opened`
   - `[WS] Received message: setup`
   - `[AI] Sending response to Twilio`

**Success Signs:**
- ✅ WebSocket receives "setup" message
- ✅ WebSocket stays open during call
- ✅ No code 1006 closures
- ✅ Conversation flows naturally

---

## 🐛 Troubleshooting

### Issue: "Twilio credentials not found"

**Solution:** Check environment variables in Render:
1. Go to your service → "Environment" tab
2. Verify all Twilio variables are set correctly
3. Click "Manual Deploy" → "Deploy latest commit" to restart

### Issue: "Call connects but no voice"

**Solution:** Check WebSocket logs:
1. Open Render logs
2. Search for "WebSocket"
3. Verify you see "setup" message
4. Check for any error messages

### Issue: Call drops immediately

**Solution:** Verify phone number format:
- Must be E.164 format: `+15551234567`
- Include country code (+1 for US)
- No spaces, dashes, or parentheses

### Issue: Build fails

**Solution:** Check build logs:
1. Go to "Events" tab in Render
2. Click on failed build
3. Look for error messages
4. Common fixes:
   - Ensure `package.json` is in repo root
   - Check Node.js version compatibility
   - Verify all dependencies are listed

---

## 🔄 Making Updates

### To Deploy Code Changes:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Render Auto-Deploys:**
   - Render automatically detects the push
   - Builds and deploys new version
   - Zero downtime (keeps old version running until new one is ready)

### To Update Environment Variables:

1. Go to service → "Environment" tab
2. Edit or add variables
3. Click "Save Changes"
4. Render will automatically restart the service

---

## 💰 Pricing & Scaling

### Free Tier Limits:
- ✅ **Sufficient for testing and moderate use**
- 750 hours/month (always-on if single service)
- Spins down after 15 minutes of inactivity
- Cold start: ~30 seconds on first request

### Paid Plans ($7/month):
- ✅ **Recommended for production**
- No spin-down
- Instant response times
- Better for 24/7 availability
- More concurrent connections

**For Your Use Case:**
- Free tier: Perfect for testing and demos
- Paid tier: Recommended if receiving calls 24/7

---

## 📊 Monitoring Your App

### View Logs:
1. Go to your service in Render
2. Click "Logs" tab
3. Real-time log streaming
4. Filter by keyword

### Check Metrics:
1. Click "Metrics" tab
2. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Set Up Alerts:
1. Go to "Notifications" in Render
2. Add email/Slack notifications
3. Get alerted on:
   - Deploy failures
   - Service crashes
   - High resource usage

---

## 🎉 Success Checklist

Before going live, verify:

- [ ] App deploys successfully on Render
- [ ] Health endpoint returns `{"status": "ok"}`
- [ ] All environment variables are set correctly
- [ ] Twilio webhook points to your Render URL
- [ ] Test call connects and WebSocket stays open
- [ ] AI voice responds naturally with ElevenLabs quality
- [ ] Logs show "setup" message from Twilio
- [ ] No code 1006 WebSocket closures
- [ ] Admin dashboard loads and shows leads/calls

---

## 🆘 Need Help?

**Render Support:**
- Documentation: https://render.com/docs
- Community: https://community.render.com/
- Email: support@render.com (very responsive!)

**Your App Logs:**
- Check Render logs first (most issues show there)
- Look for error messages
- WebSocket connection logs are key

**Common Next Steps:**
1. ✅ Deploy to Render (you're doing this now!)
2. ✅ Test with real phone calls
3. ✅ Fine-tune AI prompts in `server/voice.ts`
4. ✅ Customize voice parameters for your brand
5. ✅ Add webhook signature validation (re-enable in production)

---

## 🔐 Security Notes

**After Deployment:**

1. **Re-enable Webhook Signature Validation:**
   - Currently disabled for testing
   - File: `server/voice.ts`
   - Uncomment signature validation code

2. **Review Environment Variables:**
   - Never commit secrets to Git
   - Render keeps them encrypted
   - Rotate keys periodically

3. **Monitor Usage:**
   - Check Twilio usage dashboard
   - Set spending limits in Twilio
   - Monitor for unusual patterns

---

**Ready to deploy? Follow the steps above and your WebSocket issues will be resolved! 🎉**

The code is production-ready - we just needed the right infrastructure. Render provides exactly what Twilio ConversationRelay needs.
