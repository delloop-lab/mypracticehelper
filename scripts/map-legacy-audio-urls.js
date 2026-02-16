/**
 * Map legacy recordings to stored audio files.
 *
 * Populates audio_url for recordings where it is NULL, by matching recording.id
 * (timestamp from original upload) to filenames in the audio bucket root.
 *
 * - Does NOT move, rename, or overwrite any files
 * - Does NOT modify transcripts
 * - Does NOT overwrite audio_url if already set
 *
 * Usage: node scripts/map-legacy-audio-urls.js [--dry-run]
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

/** List all files in audio bucket root (exclude recordings/ folder and other subfolders) */
async function listRootAudioFiles() {
    const { data, error } = await supabase.storage.from('audio').list('', { limit: 5000 });
    if (error) {
        console.error('❌ Error listing audio bucket:', error);
        throw error;
    }
    const files = (data || [])
        .filter((item) => item.name !== 'recordings' && /\.(webm|m4a|mp3|wav|mp4|ogg|mpeg)$/i.test(item.name))
        .map((item) => item.name);
    console.log(`📁 Root audio files: ${files.length} (excluded recordings/ folder)`);
    return new Set(files);
}

/** Get recordings where audio_url is NULL or empty */
async function getRecordingsNeedingAudioUrl() {
    const { data, error } = await supabase
        .from('recordings')
        .select('id, audio_url, created_at');
    if (error) {
        console.error('❌ Error fetching recordings:', error);
        throw error;
    }
    const needsUrl = (data || []).filter((r) => !r.audio_url || String(r.audio_url || '').trim() === '');
    return needsUrl;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Match recording to filename. Legacy id = timestamp string like 1739123456789. Skip UUIDs. */
function findMatchingFile(recordingId, fileSet) {
    const idStr = String(recordingId).trim();
    if (UUID_REGEX.test(idStr)) return null; // New recordings use UUID, files are in recordings/
    const candidates = [`${idStr}.webm`, `${idStr}.m4a`, `${idStr}.mp3`, `${idStr}.wav`];
    for (const name of candidates) {
        if (fileSet.has(name)) return name;
    }
    return null;
}

async function run() {
    console.log('🔗 Map Legacy Recordings to Audio Files\n');
    if (isDryRun) console.log('🔍 DRY RUN - no changes will be made\n');

    const fileSet = await listRootAudioFiles();
    const recordings = await getRecordingsNeedingAudioUrl();
    console.log(`📋 Recordings with null/empty audio_url: ${recordings.length}\n`);

    const updates = [];
    const noMatch = [];

    for (const rec of recordings) {
        const filename = findMatchingFile(rec.id, fileSet);
        if (filename) {
            const audioUrl = `/api/audio/${filename}`;
            updates.push({ id: rec.id, audio_url: audioUrl, filename });
        } else {
            noMatch.push({ id: rec.id, created_at: rec.created_at });
        }
    }

    console.log(`✅ Matched: ${updates.length}`);
    if (updates.length > 0) {
        console.log('   Sample:', updates.slice(0, 3).map((u) => `${u.id} -> ${u.filename}`));
    }
    if (noMatch.length > 0) {
        console.log(`\n⚠️  No matching file: ${noMatch.length}`);
        noMatch.slice(0, 5).forEach((r) => console.log(`   - ${r.id} (created: ${r.created_at})`));
    }

    if (!isDryRun && updates.length > 0) {
        console.log('\n📤 Updating recordings...');
        for (const u of updates) {
            const { error } = await supabase
                .from('recordings')
                .update({ audio_url: u.audio_url })
                .eq('id', u.id);
            if (error) {
                console.error(`   ❌ Failed to update ${u.id}:`, error.message);
            }
        }
        console.log(`   Updated ${updates.length} recordings.`);
    }

    if (isDryRun && updates.length > 0) {
        console.log('\n📋 Would update:');
        updates.forEach((u) => console.log(`   ${u.id} -> audio_url = '${u.audio_url}'`));
    }

    // Verification: count with audio_url set
    const { count: total } = await supabase.from('recordings').select('*', { count: 'exact', head: true });
    const { count: withUrl } = await supabase.from('recordings').select('*', { count: 'exact', head: true }).not('audio_url', 'is', null);
    console.log('\n📊 Verification:');
    console.log(`   Total recordings: ${total}`);
    console.log(`   With audio_url set: ${withUrl}`);
    console.log('\n   Test playback: GET /api/audio/<filename> for a few legacy recordings.');
    console.log('✅ Done.');
}

run().then(() => process.exit(0)).catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
