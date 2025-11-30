# 🔍 Vercel Environment Variables Checklist

## ✅ CRITICAL - Required for App to Work

These **MUST** be set in Vercel or the app will fail:

### 1. Supabase Database (REQUIRED)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - **Example**: `https://wlhtgcoecwtftwqdtxhe.supabase.co`
  - **Where to get**: Supabase Dashboard → Settings → API → Project URL
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - **Where to get**: Supabase Dashboard → Settings → API → anon public key
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

### 2. SMTP Email Configuration (REQUIRED for email features)
- [ ] `SMTP_USER`
  - **Example**: `help@mypracticehelper.com`
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

- [ ] `SMTP_PASS`
  - **Example**: `YourEmailPassword123!`
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

## ⚠️ IMPORTANT - Should be Set (have defaults but recommended)

- [ ] `SMTP_HOST`
  - **Default**: `smtp.ionos.com`
  - **Set to**: `smtp.ionos.com` (or your SMTP server)
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

- [ ] `SMTP_PORT`
  - **Default**: `587`
  - **Set to**: `587` (or your SMTP port)
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

- [ ] `SMTP_FROM`
  - **Default**: Uses `SMTP_USER` value
  - **Set to**: `help@mypracticehelper.com` (or same as SMTP_USER)
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

- [ ] `SMTP_FROM_NAME`
  - **Default**: `Claire Schillaci`
  - **Set to**: `My Practice Helper` (or your preferred name)
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

## 🔒 OPTIONAL - For Additional Features

### Cron Job Security (Recommended)
- [ ] `CRON_SECRET`
  - **Purpose**: Protects the cron endpoint from unauthorized access
  - **Set to**: Any random secure string (e.g., `your-secret-token-here`)
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

### AI Transcription (If using OpenAI)
- [ ] `OPENAI_API_KEY`
  - **Purpose**: For AI-powered transcription features
  - **Where to get**: OpenAI Dashboard → API Keys
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

### Calendly Integration (If using Calendly)
- [ ] `CALENDLY_CLIENT_ID`
- [ ] `CALENDLY_CLIENT_SECRET`
- [ ] `CALENDLY_WEBHOOK_SIGNING_KEY`
  - **Environments**: ✅ Production, ✅ Preview, ✅ Development

## 📋 How to Add Variables in Vercel

1. Go to: https://vercel.com/dashboard
2. Select your project: `mypracticehelper`
3. Click **Settings** → **Environment Variables**
4. For each variable:
   - Click **Add New**
   - Enter the **Name** (exactly as shown above)
   - Enter the **Value**
   - Select environments: ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**
5. After adding all variables, **Redeploy** your application

## 🧪 How to Verify

After adding variables and redeploying:

1. Visit: `https://your-app.vercel.app/api/diagnose`
   - This will show if Supabase is configured correctly

2. Test email functionality:
   - Try the contact form
   - Check if reminder emails work

3. Check Vercel logs:
   - Go to **Deployments** → Click on latest deployment → **Logs**
   - Look for any errors related to missing environment variables

## 🚨 Common Issues

### Build Succeeds but App Doesn't Work
- **Cause**: Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Fix**: Add both Supabase variables and redeploy

### Email Features Don't Work
- **Cause**: Missing `SMTP_USER` or `SMTP_PASS`
- **Fix**: Add SMTP credentials and redeploy

### "SMTP credentials not configured" Error
- **Cause**: `SMTP_USER` or `SMTP_PASS` is missing or empty
- **Fix**: Verify both are set correctly in Vercel

## 📝 Quick Reference

**Minimum Required Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SMTP_USER=help@mypracticehelper.com
SMTP_PASS=your-password
```

**Recommended Full Set:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SMTP_HOST=smtp.ionos.com
SMTP_PORT=587
SMTP_USER=help@mypracticehelper.com
SMTP_PASS=your-password
SMTP_FROM=help@mypracticehelper.com
SMTP_FROM_NAME=My Practice Helper
CRON_SECRET=your-secret-token
```



