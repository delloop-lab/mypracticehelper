# Recording Count Fix

## Problem
Recording counter not showing on client cards after assigning a recording to a client (e.g., Lilly).

## Root Cause
1. `getRecordings()` was returning recordings with `clientName` but not `client_id` or `clientId`
2. `getRecordingCount()` was only checking for `client_id` or `clientId` matching the client's ID
3. When recordings were assigned by name, the `client_id` wasn't being included in the returned object

## Fixes Applied

### 1. Fixed `getRecordings()` in `src/lib/storage.ts`
- Now includes both `client_id` and `clientId` in the returned recording object
- This ensures recordings can be matched by ID when counting

### 2. Enhanced `getRecordingCount()` in `src/app/clients/page.tsx`
- Now checks three conditions:
  1. `client_id === client.id` (from database)
  2. `clientId === client.id` (backward compatibility)
  3. `clientName === clientName` (fallback for name-based assignment)

This ensures recordings are counted even if:
- They were assigned by name and the ID mapping isn't perfect
- The recording has `clientName` but not `client_id` yet
- There's a timing issue where the ID hasn't been set yet

## How It Works Now

1. **Assign Recording**: User assigns recording to "Lilly Schillaci" by name
2. **Save Recording**: `saveRecordings()` maps `clientName` to `client_id` when saving to database
3. **Get Recordings**: `getRecordings()` returns recording with both `clientName` and `client_id`
4. **Count Recordings**: `getRecordingCount()` matches by ID or name
5. **Display Count**: Client card shows the correct count

## Testing

To verify the fix:
1. Go to Recordings page
2. Assign a recording to "Lilly Schillaci" (or any client)
3. Go to Clients page
4. Check the microphone icon counter next to the client's name
5. The count should show the number of recordings assigned to that client

## Additional Notes

- The `recordings-updated` event is dispatched when recordings are saved, which triggers a reload on the Clients page
- The window focus listener also reloads recordings when returning to the Clients page
- Both mechanisms ensure the count stays up to date







