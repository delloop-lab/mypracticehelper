# Calendly Webhook Setup - Simple Guide

## What You Need:
1. ✅ Your Calendly account
2. ✅ Your Vercel app URL (e.g., `https://mypracticehelper.vercel.app`)
3. ✅ 5 minutes

---

## Step-by-Step Instructions:

### Step 1: Open the Setup Tool
1. Open the file `calendly-webhook-setup.html` in your browser
2. (Or I can create a page in your app if you prefer)

### Step 2: Get Your Personal Access Token
1. Click this link: https://calendly.com/integrations/api_webhooks/personal_access_tokens
2. Click **"Create Token"** button
3. Name it: "My Practice Helper"
4. **Copy the token** (you'll only see it once!)
5. Paste it into the setup tool

### Step 3: Get Your Organization URI
1. In the setup tool, click **"Get My Organization URI"** button
2. It will automatically find your organization
3. The URI will appear in the field

### Step 4: Enter Your Webhook URL
1. Replace `your-app.vercel.app` with your actual Vercel domain
2. Example: `https://mypracticehelper.vercel.app/api/calendly/webhook`

### Step 5: Create the Webhook
1. Click **"Create Webhook Subscription"** button
2. If successful, you'll see a signing key
3. **Copy that signing key**

### Step 6: Add Signing Key to Vercel
1. Go to: https://vercel.com/dashboard
2. Click your project: `mypracticehelper`
3. Go to: **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `CALENDLY_WEBHOOK_SIGNING_KEY`
   - **Value**: (paste the signing key you copied)
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development
5. Click **Save**

### Step 7: Redeploy
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**

---

## That's It! 🎉

Now when someone books an appointment in Calendly:
- ✅ A new client will be created (if they don't exist)
- ✅ A session will be created automatically
- ✅ It will appear in your app immediately

---

## Test It:
1. Create a test booking in Calendly
2. Check your app - a new session should appear!

---

## Need Help?
If something doesn't work:
1. Check Vercel logs for errors
2. Make sure environment variables are set
3. Verify the webhook URL is correct

