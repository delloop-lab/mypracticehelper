# 🚨 CRITICAL: Fix Production Database Connection

## Problem
Production is showing no data because **Supabase environment variables are missing** in Vercel.

## Solution: Add Environment Variables to Vercel

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (the same one you use locally)
3. Go to **Settings** → **API**
4. Copy these TWO values:
   - **Project URL**: `https://xxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string starting with `eyJ`)

### Step 2: Add to Vercel

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: `mypracticehelper`
3. Go to **Settings** → **Environment Variables**
4. Add these TWO variables:

   **Variable 1:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Paste your Supabase Project URL
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development
   
   **Variable 2:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Paste your Supabase anon public key
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

5. Click **Save**

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger auto-deploy

### Step 4: Verify

After redeploy, visit:
- `https://your-app.vercel.app/api/diagnose`

This will show you if Supabase is properly configured.

## Important Notes

- ✅ Use the **SAME Supabase project** as your local development
- ✅ Make sure your Supabase database has data (check in Supabase dashboard)
- ✅ Verify Row Level Security (RLS) policies allow access (check Supabase → Authentication → Policies)

## Check Your Local .env.local

Your local `.env.local` file should have:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Use the **exact same values** in Vercel environment variables.








