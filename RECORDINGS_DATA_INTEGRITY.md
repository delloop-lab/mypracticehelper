# Recordings: Data Integrity Rules

> **Anyone working on recordings or audio: read this first.**

---

## Data Integrity Rules

These rules are **non-negotiable**. All recording and audio logic must conform.

### 1. Every audio file exists

Every recording row must reference an audio file that exists in storage. No orphaned records.

- Verify before displaying or processing.
- If a file is missing, report it; do not delete the row or overwrite.

### 2. Every recording row has a transcript

Every recording must have a non-empty transcript field.

- Valid: real transcript text from Whisper or WebKit Speech Recognition.
- Valid placeholder when transcription fails: `"No transcript captured"`.
- Invalid: `null`, empty string, or missing field.

### 3. Audio is never overwritten or deleted

- **Never delete** audio files from storage.
- **Never overwrite** existing audio files.
- New recordings use unique IDs so uploads do not collide.
- Migrations and transcription retries update metadata (transcript, notes) only—they never touch the audio blob.

---

## Related

- `scripts/sanity-check-recordings.js` — Validates these rules.
- `scripts/migrate-legacy-no-transcript-recordings.js` — Fixes placeholder transcripts; updates DB only, never audio.
