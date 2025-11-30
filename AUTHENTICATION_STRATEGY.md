# Authentication Strategy: Current vs Future

## Current Setup (Custom Auth)

✅ **What we have:**
- Custom authentication with bcrypt password hashing
- Session tokens stored in cookies
- User management in `users` table
- Application-level filtering by `user_id`

✅ **Pros:**
- Full control
- Already implemented
- Works now

❌ **Cons:**
- No built-in password reset
- No email verification
- Manual session management
- Can't use RLS effectively

---

## Future: Supabase Auth (Recommended)

### Why Supabase Auth is Better for Multi-User:

1. **Built-in RLS Support**
   - RLS policies can automatically filter by `auth.uid()`
   - No need to manually filter in every query
   - Database-level security

2. **Built-in Features**
   - Email verification
   - Password reset flows
   - Magic link login
   - OAuth providers (Google, GitHub, etc.)

3. **Better Security**
   - Industry-standard JWT tokens
   - Automatic token refresh
   - Secure session management

4. **Less Code**
   - No need to manage sessions manually
   - No need to hash/verify passwords in app code
   - Supabase handles it all

---

## Migration Path (When Ready)

### Step 1: Enable Supabase Auth
```sql
-- Enable Supabase Auth (done in Supabase Dashboard)
-- Go to Authentication → Settings → Enable Email Auth
```

### Step 2: Migrate Users to Supabase Auth
```sql
-- Create users in Supabase Auth (via API or Dashboard)
-- Or use Supabase Auth signup endpoint
```

### Step 3: Update RLS Policies
```sql
-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ... etc

-- Create user-scoped policies
CREATE POLICY "Users can view own clients" ON clients
    FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own clients" ON clients
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own clients" ON clients
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own clients" ON clients
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- Repeat for all tables...
```

### Step 4: Update Application Code
- Replace custom auth with Supabase Auth client
- Remove manual `user_id` filtering (RLS handles it)
- Use `supabase.auth.getUser()` instead of custom session check

---

## Recommendation

### For Now (Current Setup):
✅ **Keep custom auth** - It works, don't break it
✅ **Disable RLS** - We're handling security in app code
✅ **Focus on features** - Get the app working

### Later (When Adding More Therapists):
✅ **Migrate to Supabase Auth** - Better long-term solution
✅ **Enable RLS** - Database-level security
✅ **Remove manual filtering** - Let RLS handle it

---

## Hybrid Approach (Alternative)

You could also:
1. Keep custom auth for now
2. Add Supabase Auth later for new users
3. Support both authentication methods
4. Gradually migrate users

But this adds complexity. Better to pick one approach.

---

## My Recommendation

**Short term:** Keep custom auth, disable RLS (what we're doing now)

**Long term:** Migrate to Supabase Auth when you:
- Need password reset functionality
- Want email verification
- Have multiple therapists
- Want OAuth login options

**Timeline:** Migrate when you have 2-3 therapists or need password reset features.

---

## Code Changes Needed for Supabase Auth Migration

### 1. Update Login Page
```typescript
// Instead of custom API call
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
});
```

### 2. Update API Endpoints
```typescript
// Instead of getCurrentUserId(request)
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;
```

### 3. Update RLS Policies
```sql
-- Automatic filtering by auth.uid()
-- No need for .eq('user_id', userId) in queries
```

### 4. Remove Manual Filtering
```typescript
// Before (custom auth)
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('user_id', userId); // Manual filter

// After (Supabase Auth + RLS)
const { data } = await supabase
  .from('clients')
  .select('*'); // RLS automatically filters
```

---

## Summary

**Current:** Custom auth ✅ (works, keep it)

**Future:** Supabase Auth ✅ (better, migrate when ready)

**Action:** Disable RLS for now, migrate to Supabase Auth later when you need its features.

