/**
 * Restore legacy recordings from orphan audio files in storage.
 *
 * Creates missing recordings rows for audio files at the audio bucket root that
 * have no corresponding database row. This restores visibility of legacy recordings
 * in client cards, session notes, and playback.
 *
 * SAFETY (fully non-destructive):
 * - Does NOT move, rename, or delete any audio files
 * - Does NOT overwrite existing recordings rows
 * - Does NOT modify existing transcripts
 * - Only INSERTs new rows for orphan files
 *
 * Usage: node scripts/restore-legacy-recordings.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isDryRun = process.argv.includes('--dry-run');

const AUDIO_EXT = /\.(webm|m4a|mp3|wav|mp4|ogg|mpeg)$/i;

/** List all audio files at the audio bucket root. Skips recordings/ folder (and any subfolders). */
async function listRootAudioFiles() {
    const { data, error } = await supabase.storage.from('audio').list('', { limit: 5000 });
    if (error) {
        console.error('❌ Error listing audio bucket:', error);
        throw error;
    }
    const files = (data || [])
        .filter((item) => item.name !== 'recordings' && AUDIO_EXT.test(item.name))
        .map((item) => item.name);
    console.log(`📁 Root audio files: ${files.length} (recordings/ folder excluded)`);
    return files;
}

/** Get all recording ids and audio_urls to detect which files already have rows. */
async function getExistingRecordingRefs() {
    let query = supabase.from('recordings').select('id, audio_url');
    const { data, error } = await query;
    if (error) {
        console.error('❌ Error fetching recordings:', error);
        throw error;
    }
    const byId = new Set();
    const byFilename = new Set();
    (data || []).forEach((r) => {
        byId.add(String(r.id).trim());
        if (r.audio_url) {
            const filename = r.audio_url.split('/').pop();
            if (filename) byFilename.add(filename);
        }
    });
    return { byId, byFilename };
}

/** Extract timestamp from filename like 1739123456789.webm. Returns null if not a valid timestamp. */
function timestampFromFilename(filename) {
    const base = filename.replace(AUDIO_EXT, '');
    if (!/^\d{10,15}$/.test(base)) return null;
    const ts = parseInt(base, 10);
    if (ts < 1000000000000 || ts > 99999999999999) return null; // ~2001–2286
    return base;
}

/** Check if a recording row exists for this filename. */
function hasMatchingRow(filename, { byId, byFilename }) {
    if (byFilename.has(filename)) return true;
    const ts = timestampFromFilename(filename);
    if (ts && byId.has(ts)) return true;
    return false;
}

/** Get transcript from session_notes if one exists with matching audio_url. */
async function getTranscriptFromSessionNotes(filename) {
    const { data, error } = await supabase
        .from('session_notes')
        .select('transcript, content')
        .ilike('audio_url', `%${filename}%`)
        .limit(1);
    if (error || !data || data.length === 0) return null;
    const note = data[0];
    const text = note.transcript || note.content || '';
    if (!text || String(text).trim() === '') return null;
    return JSON.stringify({ transcript: text.trim(), notes: [] });
}

async function run() {
    console.log('🔧 Restore Legacy Recordings from Orphan Audio Files\n');
    if (isDryRun) console.log('🔍 DRY RUN – no database changes will be made\n');

    const files = await listRootAudioFiles();
    const refs = await getExistingRecordingRefs();
    console.log(`📋 Existing recordings (non-deleted): ${refs.byId.size}\n`);

    const orphans = files.filter((f) => !hasMatchingRow(f, refs));
    console.log(`📌 Orphan files (no DB row): ${orphans.length}`);

    if (orphans.length === 0) {
        console.log('\n✅ No orphan files to restore. All root audio files already have recordings rows.');
        return;
    }

    if (orphans.length <= 10) {
        orphans.forEach((f) => console.log(`   - ${f}`));
    } else {
        orphans.slice(0, 5).forEach((f) => console.log(`   - ${f}`));
        console.log(`   ... and ${orphans.length - 5} more`);
    }

    const toInsert = [];
    for (const filename of orphans) {
        const ts = timestampFromFilename(filename);
        const id = ts || require('crypto').randomUUID();
        const audioUrl = `/api/audio/${filename}`;
        const createdAt = ts ? new Date(parseInt(ts, 10)).toISOString() : new Date().toISOString();

        let transcript = null;
        let transcriptStatus = 'pending';
        const sessionNoteTranscript = await getTranscriptFromSessionNotes(filename);
        if (sessionNoteTranscript) {
            transcript = sessionNoteTranscript;
            transcriptStatus = 'complete';
        }

        toInsert.push({
            id,
            audio_url: audioUrl,
            client_id: null,
            session_id: null,
            transcript: transcript,
            created_at: createdAt,
            title: 'Untitled Recording',
            duration: 0,
            recording_status: 'uploaded',
            transcript_status: transcriptStatus,
            allocation_status: 'unallocated',
            user_id: null
        });
    }

    console.log('\n📤 Would insert', toInsert.length, 'new recordings rows');
    if (toInsert.length > 0) {
        const withTranscript = toInsert.filter((r) => r.transcript).length;
        console.log(`   - With transcript from session_notes: ${withTranscript}`);
        console.log(`   - Without transcript (pending): ${toInsert.length - withTranscript}`);
    }

    if (!isDryRun && toInsert.length > 0) {
        console.log('\n📤 Inserting new recordings...');
        const minimalKeys = ['id', 'audio_url', 'client_id', 'transcript', 'created_at', 'title', 'duration'];
        for (const row of toInsert) {
            let { error } = await supabase.from('recordings').insert(row);
            if (error && error.code === '42703') {
                const minimal = minimalKeys.reduce((o, k) => ({ ...o, [k]: row[k] }), {});
                const res = await supabase.from('recordings').insert(minimal);
                error = res.error;
            }
            if (error) {
                if (error.code === '23505') {
                    console.log(`   ⏭️  Skipped ${row.id} (row already exists)`);
                } else {
                    console.error(`   ❌ Failed to insert ${row.id}:`, error.message);
                }
            } else {
                console.log(`   ✅ Inserted ${row.id} -> ${row.audio_url}`);
            }
        }
    }

    if (isDryRun && toInsert.length > 0) {
        console.log('\n📋 Would insert (sample):');
        toInsert.slice(0, 5).forEach((r) => {
            console.log(`   ${r.id} | ${r.audio_url} | transcript: ${r.transcript ? 'yes' : 'pending'}`);
        });
    }

    const { count: total } = await supabase.from('recordings').select('*', { count: 'exact', head: true });
    console.log('\n📊 Verification:');
    console.log(`   Total active recordings: ${total}`);
    console.log('\n   Next steps:');
    console.log('   1. Legacy recordings should appear in client cards and session notes.');
    console.log('   2. Test playback: GET /api/audio/<filename> for a few filenames.');
    console.log('   3. Assign clients/sessions via the UI to link orphan recordings.');
    console.log('   4. Use retry-transcription for any that need transcription.');
    console.log('\n✅ Done.');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
