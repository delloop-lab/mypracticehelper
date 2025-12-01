# Multi-User SQL Migration Instructions

## ⚠️ IMPORTANT: Read Before Running

This migration is **SAFE** and **NON-BREAKING**. It adds the necessary database structure for multi-user support without breaking existing functionality.

### What This Does:
1. ✅ Creates `users` table for storing user accounts
2. ✅ Adds `user_id` columns to all data tables (NULLABLE - won't break existing data)
3. ✅ Creates indexes for performance
4. ✅ Updates settings table to support per-user settings

### What This Does NOT Do:
- ❌ Does NOT migrate existing data (that's Step 2, after auth code is ready)
- ❌ Does NOT break existing functionality
- ❌ Does NOT require app code changes yet

---

## Step 1: Run Database Schema Migration

### File: `migration-multi-user-step1.sql`

**What to do:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `migration-multi-user-step1.sql`
3. Click "Run" or press Ctrl+Enter
4. Verify no errors occurred

**Expected Result:**
- ✅ `users` table created
- ✅ `user_id` columns added to: clients, sessions, session_notes, recordings, payments, reminders
- ✅ `user_id` column added to settings table
- ✅ Indexes created for performance

**Verification:**
Run these queries to verify:
```sql
-- Check users table exists
SELECT * FROM users LIMIT 1;

-- Check user_id columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clients' AND column_name = 'user_id';

-- Should return: user_id | text | YES (nullable is correct)
```

---

## Step 2: Create First User (DO NOT RUN YET)

### File: `migration-multi-user-step2-create-first-user.sql`

**⚠️ DO NOT RUN THIS YET**

This step should only be run **AFTER**:
1. ✅ Step 1 is complete
2. ✅ Authentication code is implemented (password hashing)
3. ✅ You have generated the bcrypt hash for password '22Picnic!'

**What it does:**
- Creates the first user account (Claire)
- Assigns all existing data to that user
- Migrates settings from 'default' to the user

**When to run:**
After we implement the authentication system and can generate password hashes.

---

## Current Status After Step 1

After running Step 1:
- ✅ Database is ready for multi-user support
- ✅ App continues to work normally (user_id columns are NULL, which is fine)
- ✅ No breaking changes
- ✅ Ready for authentication code implementation

---

## Next Steps (After SQL Migration)

1. ✅ **Database Schema** (Step 1 SQL) ← YOU ARE HERE
2. ⏳ **Authentication Code** (password hashing, login API)
3. ⏳ **Create First User** (Step 2 SQL with real password hash)
4. ⏳ **Update API Endpoints** (add user filtering)
5. ⏳ **Update Frontend** (login page, settings)

---

## Rollback Plan (If Needed)

If you need to rollback Step 1:

```sql
-- Remove user_id columns (WARNING: Only if no data was migrated)
ALTER TABLE clients DROP COLUMN IF EXISTS user_id;
ALTER TABLE sessions DROP COLUMN IF EXISTS user_id;
ALTER TABLE session_notes DROP COLUMN IF EXISTS user_id;
ALTER TABLE recordings DROP COLUMN IF EXISTS user_id;
ALTER TABLE payments DROP COLUMN IF EXISTS user_id;
ALTER TABLE reminders DROP COLUMN IF EXISTS user_id;
ALTER TABLE settings DROP COLUMN IF EXISTS user_id;

-- Drop users table (WARNING: Only if no users created)
DROP TABLE IF EXISTS users;
```

**Note:** This is safe because user_id columns are NULLABLE and we haven't migrated data yet.

---

## Questions?

- **Will this break my app?** No, all user_id columns are nullable
- **Can I run Step 2 now?** No, wait for auth code implementation
- **What if I make a mistake?** Step 1 is safe and reversible (see rollback plan)
- **When can I test?** After Step 1, the app works normally. Full testing after Step 2.



