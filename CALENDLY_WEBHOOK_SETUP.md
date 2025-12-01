# Calendly Webhook Setup Guide

## Method 1: Using the Helper Endpoint (Easiest)

### Step 1: Get Your Personal Access Token

1. Go to Calendly Developer Portal: https://calendly.com/integrations/api_webhooks/personal_access_tokens
2. Click **"Create Token"**
3. Name it: "My Practice Helper"
4. Select scopes:
   - ✅ `webhook:read`
   - ✅ `webhook:write`
5. Click **"Create"**
6. **Copy the token** (you'll only see it once!)

### Step 2: Get Your Organization URI

Make a GET request to get your organization info:

```bash
curl -X GET "https://api.calendly.com/users/me" \
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"
```

Look for `current_organization` in the response - it will look like:
```
"current_organization": "https://api.calendly.com/organizations/XXXXXXXX"
```

### Step 3: Create the Webhook

Use the helper endpoint:

```bash
curl -X POST "http://localhost:3000/api/calendly/create-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "YOUR_PERSONAL_ACCESS_TOKEN",
    "organizationUri": "https://api.calendly.com/organizations/XXXXXXXX",
    "webhookUrl": "https://your-app.vercel.app/api/calendly/webhook"
  }'
```

Or use a tool like Postman, or create a simple HTML page to make the request.

---

## Method 2: Direct API Call

### Step 1: Get Personal Access Token
(Same as Method 1, Step 1)

### Step 2: Create Webhook Directly

```bash
curl -X POST "https://api.calendly.com/webhook_subscriptions" \
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/calendly/webhook",
    "events": ["invitee.created", "invitee.canceled"],
    "organization": "https://api.calendly.com/organizations/XXXXXXXX",
    "scope": "organization"
  }'
```

### Step 3: Get the Signing Key

After creating the webhook, you'll get a response with a `signing_key`. 

**Add this to Vercel environment variables:**
- Name: `CALENDLY_WEBHOOK_SIGNING_KEY`
- Value: (the signing_key from the response)

---

## Method 3: Using Calendly UI (If Available)

Some Calendly accounts have a UI for webhooks:

1. Go to: https://calendly.com/integrations/api_webhooks/webhooks
2. Click **"Create Webhook"**
3. Enter your webhook URL: `https://your-app.vercel.app/api/calendly/webhook`
4. Select events: `invitee.created`, `invitee.canceled`
5. Save and copy the signing key

---

## After Creating the Webhook

1. **Add Signing Key to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `CALENDLY_WEBHOOK_SIGNING_KEY` = (the signing key from Calendly)

2. **Redeploy your app** (or push a new commit)

3. **Test it:**
   - Create a test booking in Calendly
   - Check your app - a new session should appear automatically!

---

## Troubleshooting

**Error: "Unauthorized"**
- Check that your Personal Access Token is correct
- Make sure token has webhook permissions

**Error: "Invalid organization"**
- Verify the organization URI is correct
- Try using `user` scope instead of `organization`

**Webhook not receiving events:**
- Verify webhook URL is publicly accessible
- Check Vercel logs for webhook requests
- Make sure signing key is set in environment variables






