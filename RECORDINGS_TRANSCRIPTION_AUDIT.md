# Recording & Transcription System Audit

**Date:** 2025-02-10  
**Scope:** Full audit of recording storage, transcription, allocation, and delete behaviour.  
**Constraint:** Audit and protect only. No refactor, no migration of legacy data.

---

## 1. Current Structure

### 1.1 Supabase Storage Buckets

| Bucket | Purpose | Allowed Operations |
|--------|---------|-------------------|
| `audio` | Voice recordings (webm, m4a, mp3, wav, mp4, ogg, mpeg) | Upload (signed URL or direct), Download, List |
| `documents` | Client documents, company logos | Upload, Download, Remove (logos only) |

**Audio bucket:** No automatic cleanup. No scheduled removal.

### 1.2 File Naming Format

| Source | Format | Example | Unique? |
|--------|--------|---------|---------|
| Live recording (voice-notes) | `{Date.now()}.webm` | `1739123456789.webm` | No – timestamp can collide if two saves in same ms |
| Legacy FormData upload | `{metadata.id}.webm` | Same as above | Same |
| Retry-transcription | Uses existing `audio_url` / `{id}.webm` | No new file | N/A |

**Storage path:** Flat – files at root of `audio` bucket, no subdirectories.

### 1.3 How File Paths Are Stored in the Database

| Column | Table | Format | Example |
|--------|-------|--------|---------|
| `audio_url` | `recordings` | `/api/audio/{filename}` or full Supabase URL | `/api/audio/1739123456789.webm` |
| `audio_url` | `recordings` | Stored by storage.ts as `r.audioURL \|\| r.audioUrl` | Same |

**Playback:** `/api/audio/[filename]` downloads from Supabase `audio` bucket using filename.

### 1.4 Where Transcripts Are Stored

| Location | Table | Column | Format |
|----------|-------|--------|--------|
| Primary | `recordings` | `transcript` | JSON: `{ transcript: string, notes: NoteSection[] }` |
| Session notes | `session_notes` | `transcript` | Plain text (for notes copied from recordings) |

**Transcript JSON variants:**
- New: `{ transcript: "…", notes: [{ title, content }] }`
- Legacy: Array of note sections directly
- Legacy: Plain string

### 1.5 How Allocation to Clients Is Stored

| Column | Table | Purpose |
|--------|-------|---------|
| `client_id` | `recordings` | Links to `clients.id` (ON DELETE SET NULL) |
| `session_id` | `recordings` | Links to `sessions.id` |
| `client_id` | `session_notes` | Links to `clients.id` |
| `session_id` | `session_notes` | Links to `sessions.id` |

**Unallocated:** Recording with `client_id IS NULL` and `session_id IS NULL`.

### 1.6 Current Delete Behaviour

| Component | Behaviour | Storage Files Deleted? |
|-----------|-----------|------------------------|
| `DELETE /api/recordings?id=X` | **Hard delete** – removes row from `recordings` | **No** – audio files left in storage |
| `session_notes` DELETE | Hard delete session note row | N/A (session notes only) |
| GDPR client delete | Deletes client; sets `recordings.client_id = null` | **No** – recordings kept, unlinked |
| `saveAudioFile` | `upsert: true` – **overwrites** if same filename | Yes – overwrite in place |

### 1.7 Background Jobs

| Job | Schedule | Touches Recordings/Transcripts? |
|-----|----------|---------------------------------|
| `/api/cron/admin-reminders` | `0 2 * * *` (2am daily) | No |

**No background jobs modify recordings or transcripts.**

---

## 2. Code That Modifies Recordings/Storage

### 2.1 File Renames

**None found.** No code renames storage objects.

### 2.2 File Overwrites

| Location | Behaviour |
|----------|-----------|
| `lib/storage.ts` – `saveAudioFile` | `upsert: true` – overwrites file if same `fileName` |
| Voice-notes upload to signed URL | `x-upsert: true` header – overwrites if same path |
| Direct upload path | Same `{recordingId}.webm` filename as metadata id |

**Risk:** Same `Date.now()` id in rapid succession could overwrite a previous file.

### 2.3 Transcript Regeneration

| Location | Behaviour |
|----------|-----------|
| `POST /api/recordings/retry-transcription` | Fetches audio, sends to Whisper, **updates** `recordings.transcript` |
| `scripts/migrate-legacy-no-transcript-recordings.js` | One-time – only for "No transcript captured" placeholder |
| `scripts/cleanup-live-recording-ai.js` | Updates transcript JSON (removes AI assessment from live recordings) |

**retry-transcription** is user-initiated. Scripts are manual, not scheduled.

### 2.4 Automatic Cleanup / File Removal

| Location | Behaviour |
|----------|-----------|
| `settings/upload-logo` | `storage.from('documents').remove([oldLogo])` – **documents** bucket only, logos |
| Recordings API DELETE | Database row only – **no** storage delete |
| GDPR delete | No storage delete |

**No automatic removal of audio files.**

---

## 3. Identified Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Hard delete loses metadata/history | High | Replace with soft delete (`deleted_at`) |
| `upsert: true` can overwrite audio | Medium | Documented; no change per audit scope |
| `Date.now()` id collisions | Low | Rare; document only |
| retry-transcription overwrites transcript | Low | User-initiated; expected |
| Manual scripts alter transcripts | Low | Audit only; run manually |

---

## 4. Protective Guardrails Applied

1. **Recordings DELETE replaced with soft delete** – `deleted_at` set instead of row removal. Audio files never touched.
2. **No storage delete** – No code deletes audio files from `audio` bucket.
3. **GET /api/recordings** – Excludes rows where `deleted_at IS NOT NULL`.
4. **session-notes API** – Excludes soft-deleted recordings from session notes view.
5. **storage.getRecordings** – Excludes soft-deleted.
6. **retry-transcription** – Rejects soft-deleted recordings (404).
7. **PATCH (assign)** – Rejects soft-deleted recordings (404).
8. **Legacy data** – Unchanged; no migration of paths, transcripts, or allocations.

**Migration required:** Run `migration-recordings-soft-delete.sql` before deploying. Adds `deleted_at` column.

---

## 5. Confirmation

- [x] Legacy recordings and transcripts remain accessible.
- [x] No refactor of storage paths, transcript content, or allocation.
- [x] Hard delete disabled for recordings (soft delete only).
- [x] No physical storage files deleted by application code.
- [x] Existing files and DB rows untouched.
