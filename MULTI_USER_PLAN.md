# Multi-User Support Implementation Plan

## Overview
Transform the single-user application into a multi-user system where each user has isolated data and settings.

## Current State Analysis

### Current Architecture
- **Authentication**: Hardcoded single user (`claire@claireschillaci.com`)
- **Data Storage**: Supabase database with tables: `clients`, `sessions`, `session_notes`, `recordings`, `payments`, `reminders`, `settings`
- **Data Isolation**: None - all users would see all data
- **Settings**: Single global settings record (`id: 'default'`)

### Key Challenges
1. No user management system
2. No data isolation between users
3. Settings are global, not per-user
4. All API endpoints fetch all data without user filtering

---

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Create Users Table
```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hashed password
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_users_email ON users(email);
```

#### 1.2 Add `user_id` Column to All Data Tables
```sql
-- Add user_id to all tables
ALTER TABLE clients ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE session_notes ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE recordings ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE reminders ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Settings table needs to change from single 'default' record to per-user
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- Migrate existing 'default' settings to first user (see migration script)
```

#### 1.3 Create Indexes for Performance
```sql
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_session_notes_user_id ON session_notes(user_id);
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_settings_user_id ON settings(user_id);
```

#### 1.4 Update Row Level Security (RLS) Policies
```sql
-- Drop existing "allow all" policies
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all operations on session_notes" ON session_notes;
DROP POLICY IF EXISTS "Allow all operations on recordings" ON recordings;
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
DROP POLICY IF EXISTS "Allow all operations on reminders" ON reminders;

-- Create user-scoped policies (using Supabase Auth)
-- Note: This assumes we'll use Supabase Auth. If using custom auth, we'll need different approach.

-- For now, we'll handle filtering in application code, but RLS can be added later
-- when Supabase Auth is integrated
```

---

### Phase 2: Authentication System

#### Option A: Supabase Auth (Recommended)
**Pros:**
- Built-in password hashing
- Email verification
- Password reset flows
- Session management
- OAuth providers support

**Cons:**
- Requires Supabase Auth setup
- More complex migration

#### Option B: Custom Auth (Simpler Migration)
**Pros:**
- Full control
- Easier migration from current system
- No additional Supabase features needed

**Cons:**
- Manual password hashing (bcrypt)
- Manual session management
- Need to implement password reset

**Recommendation**: Start with **Option B** for faster implementation, migrate to Supabase Auth later if needed.

#### 2.1 Create User Authentication API

**Files to Create:**
- `src/app/api/auth/register/route.ts` - User registration
- `src/app/api/auth/login/route.ts` - User login (replace current hardcoded)
- `src/app/api/auth/logout/route.ts` - User logout
- `src/app/api/auth/me/route.ts` - Get current user info
- `src/lib/auth.ts` - Auth utilities (password hashing, session management)

**Key Functions:**
```typescript
// src/lib/auth.ts
- hashPassword(password: string): Promise<string>
- verifyPassword(password: string, hash: string): Promise<boolean>
- createSession(userId: string): string
- verifySession(sessionToken: string): Promise<string | null> // returns userId
- getCurrentUserId(request: Request): Promise<string | null>
```

#### 2.2 Update Middleware
- Extract user_id from session token
- Store user_id in request context
- Redirect unauthenticated users to login

---

### Phase 3: API Updates - Add User Filtering

#### 3.1 Update All API Endpoints

**Pattern for each endpoint:**
```typescript
// Before
const { data } = await supabase.from('clients').select('*');

// After
const userId = await getCurrentUserId(request);
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('user_id', userId);
```

**Endpoints to Update:**
- `src/app/api/clients/route.ts`
- `src/app/api/appointments/route.ts`
- `src/app/api/session-notes/route.ts`
- `src/app/api/recordings/route.ts`
- `src/app/api/settings/route.ts`
- All other data-fetching endpoints

#### 3.2 Update Data Creation Endpoints
```typescript
// When creating new records, always include user_id
const userId = await getCurrentUserId(request);
const { data } = await supabase
  .from('clients')
  .insert({
    ...clientData,
    user_id: userId
  });
```

---

### Phase 4: Frontend Updates

#### 4.1 Update Login Page
- Replace hardcoded credentials with API call
- Handle registration flow (or admin-only user creation)
- Store user session token

#### 4.2 Update Settings Page
- Fetch settings for current user (not 'default')
- Save settings with user_id
- Display user's own email (editable)

#### 4.3 Update All Data Fetching
- Ensure all API calls include authentication
- Handle 401 errors (redirect to login)

---

### Phase 5: Migration Strategy

#### 5.1 Create Migration Script
```sql
-- migration-to-multi-user.sql

-- Step 1: Create first user from existing email
INSERT INTO users (email, password_hash, first_name, last_name)
VALUES (
  'claire@claireschillaci.com',
  '$2b$10$...', -- Hash of '22Picnic!'
  'Claire',
  'Schillaci'
)
RETURNING id;

-- Step 2: Assign all existing data to first user
-- (Run after getting user_id from step 1)
UPDATE clients SET user_id = '<user_id_from_step_1>';
UPDATE sessions SET user_id = '<user_id_from_step_1>';
UPDATE session_notes SET user_id = '<user_id_from_step_1>';
UPDATE recordings SET user_id = '<user_id_from_step_1>';
UPDATE payments SET user_id = '<user_id_from_step_1>';
UPDATE reminders SET user_id = '<user_id_from_step_1>';

-- Step 3: Migrate settings
UPDATE settings SET user_id = '<user_id_from_step_1>' WHERE id = 'default';
-- Or create new settings record per user
```

#### 5.2 Data Migration Considerations
- **Existing Data**: All current data belongs to first user
- **Settings**: Migrate 'default' settings to first user
- **Backwards Compatibility**: Ensure existing users can still log in

---

### Phase 6: User Management Features

#### 6.1 User Registration (Optional)
- Allow new users to register
- Or admin-only user creation

#### 6.2 User Profile Management
- Edit email, name
- Change password
- Delete account (with data cleanup)

#### 6.3 Admin Features (Future)
- User list
- User management
- System settings

---

## Implementation Order

### Step 1: Database Schema (Critical Path)
1. Create `users` table
2. Add `user_id` columns to all tables
3. Create indexes
4. Run migration script for existing data

### Step 2: Authentication System
1. Create auth utilities (`src/lib/auth.ts`)
2. Create auth API endpoints
3. Update middleware to use new auth
4. Update login page

### Step 3: API Updates
1. Create helper function `getCurrentUserId()`
2. Update all GET endpoints to filter by user_id
3. Update all POST/PUT/DELETE endpoints to include user_id
4. Update settings API to be per-user

### Step 4: Frontend Updates
1. Update login flow
2. Update settings page
3. Test data isolation

### Step 5: Testing & Migration
1. Test with multiple users
2. Verify data isolation
3. Run production migration
4. Verify existing user can still access data

---

## Security Considerations

1. **Password Security**: Use bcrypt with salt rounds >= 10
2. **Session Security**: Use secure, httpOnly cookies
3. **SQL Injection**: Use parameterized queries (Supabase handles this)
4. **Data Isolation**: Always filter by user_id in queries
5. **RLS Policies**: Consider enabling Supabase RLS for defense in depth

---

## Testing Checklist

- [ ] New user can register
- [ ] User can log in with email/password
- [ ] User only sees their own clients
- [ ] User only sees their own sessions
- [ ] User only sees their own settings
- [ ] Creating new data assigns correct user_id
- [ ] Existing user (Claire) can still log in
- [ ] Existing data is accessible to first user
- [ ] Logout works correctly
- [ ] Session expires correctly
- [ ] Unauthorized access is blocked

---

## Rollback Plan

If issues arise:
1. Keep old authentication as fallback
2. Make user_id nullable initially
3. Gradual migration (dual-write pattern)
4. Database backup before migration

---

## Estimated Timeline

- **Phase 1 (Database)**: 2-3 hours
- **Phase 2 (Auth)**: 4-6 hours
- **Phase 3 (API)**: 6-8 hours
- **Phase 4 (Frontend)**: 3-4 hours
- **Phase 5 (Migration)**: 2-3 hours
- **Testing**: 4-6 hours

**Total**: ~21-30 hours

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Database Schema)
3. Test migration script on staging
4. Implement authentication system
5. Update APIs incrementally
6. Test thoroughly before production deployment

