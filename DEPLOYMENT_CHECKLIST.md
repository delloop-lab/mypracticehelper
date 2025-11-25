# 🚀 My Practice Helper - Deployment Checklist

**Status**: Ready to Deploy! ✅ Code is pushed to GitHub

---

## ✅ COMPLETED STEPS

- [x] Installed Supabase client package
- [x] Created `.gitignore` file
- [x] Created `.env.local.example` template
- [x] Created Supabase client utility (`src/lib/supabase.ts`)
- [x] Created comprehensive README.md
- [x] Committed all changes to Git
- [x] Pushed code to GitHub: https://github.com/delloop-lab/mypracticehelper

---

## 📋 NEXT STEPS (Do These Now)

### STEP 1: Set Up Supabase Database (10 minutes)

**Current Status**: You need to sign in to Supabase

1. **Sign in to Supabase**
   - Go to: https://supabase.com/dashboard
   - Sign in with your account
   
2. **Create New Project**
   - Click "New Project" button
   - Fill in:
     - **Name**: `my-practice-helper`
     - **Database Password**: Create a strong password (SAVE THIS!)
     - **Region**: Choose closest to you (e.g., `us-east-1`)
   - Click "Create new project"
   - ⏱️ Wait 2-3 minutes for setup

3. **Get Your Credentials**
   - Go to: **Settings** → **API**
   - Copy these TWO values:
     - ✏️ **Project URL**: `https://xxxxxxxxx.supabase.co`
     - ✏️ **anon public key**: `eyJhbGc...` (long string)

4. **Create Database Tables**
   - Go to: **SQL Editor** (left sidebar)
   - Click "New Query"
   - Copy and paste this SQL:

```sql
-- Enable Row Level Security
ALTER DATABASE postgres SET timezone TO 'UTC';

-- Clients table
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Sessions table
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER,
  type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Session notes table
CREATE TABLE session_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Recordings table
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT,
  transcript TEXT,
  audio_url TEXT,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Payments table
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Reminders table
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now)
CREATE POLICY "Allow all operations on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on session_notes" ON session_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on recordings" ON recordings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
```

   - Click "Run" button
   - ✅ Verify: You should see "Success. No rows returned"

---

### STEP 2: Create Local Environment File (2 minutes)

1. **Create `.env.local` file**
   - In your project root: `c:\projects\therapist`
   - Create a new file called `.env.local`
   - Add these lines (use YOUR credentials from Step 1):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

2. **Save the file**

---

### STEP 3: Deploy to Vercel (5 minutes)

1. **Sign Up for Vercel**
   - Go to: https://vercel.com/signup
   - Click "Continue with GitHub"
   - Authorize Vercel to access your repositories

2. **Import Your Project**
   - Click "Add New..." → "Project"
   - Find and select: `mypracticehelper`
   - Click "Import"

3. **Configure Build Settings**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - Leave other settings as default

4. **Add Environment Variables**
   - Click "Environment Variables" section
   - Add these TWO variables:
     
     **Variable 1:**
     - Name: `NEXT_PUBLIC_SUPABASE_URL`
     - Value: (paste your Supabase URL)
     
     **Variable 2:**
     - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Value: (paste your Supabase anon key)

5. **Deploy!**
   - Click "Deploy" button
   - ⏱️ Wait 2-3 minutes for build
   - 🎉 Your app will be live!

---

## 🎯 YOUR LIVE APP URLS

After deployment, you'll have:

- **Live App**: `https://mypracticehelper.vercel.app`
- **GitHub Repo**: https://github.com/delloop-lab/mypracticehelper
- **Supabase Dashboard**: https://supabase.com/dashboard

---

## 🔄 Future Updates

Every time you want to update your live app:

```bash
git add .
git commit -m "Description of changes"
git push origin master
```

Vercel will automatically rebuild and deploy! 🚀

---

## ✅ Post-Deployment Testing

Once deployed, test these features:
- [ ] Create a new client
- [ ] Schedule a session
- [ ] Record a voice note
- [ ] Add a payment
- [ ] Create a reminder
- [ ] Upload a document

---

## 🆘 Need Help?

- **Supabase Issues**: Check https://supabase.com/docs
- **Vercel Issues**: Check https://vercel.com/docs
- **Build Errors**: Check Vercel deployment logs

---

**You're almost there! Just follow Steps 1-3 above and you'll be live! 🚀**
