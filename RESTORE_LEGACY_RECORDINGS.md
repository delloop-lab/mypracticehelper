# Restore Legacy Recordings from Orphan Audio Files

This guide describes how to restore visibility of legacy audio files that exist in storage but have no corresponding row in the `recordings` table.

## Problem

- Legacy audio files exist at the **root** of the `audio` Supabase bucket (e.g. `1739123456789.webm`).
- There are **no** `recordings` rows linking them to clients, sessions, or transcripts.
- As a result, they do not appear in client cards, session notes, or the recordings list.
- The `/api/audio/{filename}` endpoint works for playback, but the UI has nothing to show.

## Solution

The script `scripts/restore-legacy-recordings.js`:

1. **Lists** all audio files at the bucket root (skips the `recordings/` folder used for new uploads).
2. **Identifies** files with no matching row (by `audio_url` or `id` from filename timestamp).
3. **Creates** new `recordings` rows only for orphan files.
4. **Preserves** any transcripts found in `session_notes` with matching `audio_url`.

## Safety (Non-Destructive)

- **No audio files** are moved, renamed, or deleted.
- **No existing recordings rows** are overwritten.
- **No existing transcripts** are modified.
- Only **INSERT** of missing rows. Safe to re-run (skips conflicts).

## Prerequisites

Ensure these migrations have been run:

- `migration-recordings-soft-delete.sql`
- `migration-add-recording-status-columns.sql`
- `migration-multi-user-step1.sql` (for `user_id` on recordings)
- `add-session-id-to-recordings.sql`

## Usage

### 1. Dry run (preview only)

```bash
npm run restore-legacy-recordings:dry-run
```

This shows which files would be restored and how many new rows would be inserted. No database changes.

### 2. Execute

```bash
npm run restore-legacy-recordings
```

## Post-Run Verification

After the script runs, verify the following:

### 1. Legacy recordings appear in client cards

- Open **Clients**.
- Unallocated recordings will show in the "Unallocated" section (or similar).
- Assign a client to a restored recording to confirm it links correctly.

### 2. Session notes show these recordings

- Open **Session Notes**.
- Recordings with transcripts should appear in the combined notes view.
- Newly restored recordings (without transcript) may appear as "pending" or minimal entries.

### 3. Playback works

- For a restored file like `1739123456789.webm`, open:

  ```
  https://your-app.vercel.app/api/audio/1739123456789.webm
  ```

- The audio should play without errors.

### 4. New recordings still work

- Create a new voice recording.
- Ensure it saves and appears as before.
- Confirm no regressions in the normal flow.

## Manual Checks (Optional)

```sql
-- Count restored vs total recordings
SELECT 
  COUNT(*) FILTER (WHERE audio_url LIKE '/api/audio/%' AND user_id IS NULL) as legacy_restored,
  COUNT(*) as total_active
FROM recordings 
WHERE deleted_at IS NULL;

-- Sample of recently created unallocated recordings
SELECT id, audio_url, transcript_status, allocation_status, created_at 
FROM recordings 
WHERE deleted_at IS NULL 
  AND client_id IS NULL 
  AND session_id IS NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

## Related Scripts

- `map-legacy-audio-urls.js` – Fills in `audio_url` for **existing** recordings rows that lack it.
- `restore-legacy-recordings.js` – Creates **new** rows for audio files with no row at all.

Run `map-legacy-audio` first if you have recordings rows without `audio_url`. Run `restore-legacy-recordings` when files exist in storage but have no row.
