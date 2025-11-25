---
description: Deploy My Practice Helper online with GitHub, Supabase, and Vercel
---

# Deploy My Practice Helper Online

This workflow guides you through deploying your application online using GitHub for version control, Supabase for backend services, and Vercel for hosting.

## Prerequisites
- GitHub account (active ✓)
- Supabase account (active ✓)
- Vercel account (free - we'll create this)

## Phase 1: Set Up Supabase Backend

### 1.1 Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: my-practice-helper
   - **Database Password**: (save this securely!)
   - **Region**: Choose closest to your users
4. Click "Create new project" (takes ~2 minutes)

### 1.2 Get Supabase Credentials
1. In your Supabase project, go to **Settings** → **API**
2. Copy these values (you'll need them later):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 1.3 Create Database Tables
1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query and run this SQL:

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
  duration INTEGER, -- in minutes
  type TEXT, -- 'initial', 'follow-up', etc.
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
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
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

-- Enable Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later with auth)
CREATE POLICY "Allow all operations on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on session_notes" ON session_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on recordings" ON recordings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
```

## Phase 2: Set Up GitHub Repository

### 2.1 Initialize Git Repository
// turbo
```bash
git init
```

### 2.2 Create .gitignore
Create a `.gitignore` file (if it doesn't exist) with:
```
node_modules/
.next/
.env*.local
.vercel
*.log
.DS_Store
```

### 2.3 Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `my-practice-helper`
3. Keep it **Private** (contains sensitive healthcare app code)
4. Don't initialize with README (we already have code)
5. Click "Create repository"

### 2.4 Push Code to GitHub
// turbo
```bash
git add .
git commit -m "Initial commit: My Practice Helper"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/my-practice-helper.git
git push -u origin main
```

## Phase 3: Install Supabase Client

### 3.1 Install Supabase Package
// turbo
```bash
npm install @supabase/supabase-js
```

### 3.2 Create Environment Variables File
Create `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Phase 4: Deploy to Vercel

### 4.1 Create Vercel Account
1. Go to https://vercel.com/signup
2. Sign up with your GitHub account
3. Authorize Vercel to access your repositories

### 4.2 Import Project
1. Click "Add New..." → "Project"
2. Import your `my-practice-helper` repository
3. Configure project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: .next

### 4.3 Add Environment Variables
In Vercel project settings, add:
- `NEXT_PUBLIC_SUPABASE_URL` = (your Supabase URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase anon key)

### 4.4 Deploy
1. Click "Deploy"
2. Wait 2-3 minutes for build to complete
3. Your app will be live at: `https://my-practice-helper.vercel.app`

## Phase 5: Configure Custom Domain (Optional)

### 5.1 In Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 5.2 Update Supabase
1. In Supabase dashboard → Authentication → URL Configuration
2. Add your Vercel URL to allowed redirect URLs

## Post-Deployment Checklist

- [ ] Test all features on live site
- [ ] Verify Supabase connection works
- [ ] Test client creation/editing
- [ ] Test session scheduling
- [ ] Test voice notes recording
- [ ] Test payments/revenue tracking
- [ ] Set up proper authentication (currently using simple auth)
- [ ] Configure HIPAA compliance settings
- [ ] Set up automated backups
- [ ] Monitor error logs in Vercel dashboard

## Continuous Deployment

Every time you push to GitHub `main` branch, Vercel will automatically:
1. Build your app
2. Run tests (if configured)
3. Deploy to production

To deploy changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

## Troubleshooting

### Build fails on Vercel
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set

### Database connection fails
- Verify Supabase credentials in environment variables
- Check Supabase project is active
- Review RLS policies if getting permission errors

### App loads but features don't work
- Check browser console for errors
- Verify API routes are working
- Check Supabase logs for database errors
