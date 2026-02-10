/**
 * ONE-TIME LEGACY MIGRATION: Fix recordings with transcript === "No transcript captured"
 *
 * This script targets ONLY recordings where the transcript field contains the placeholder
 * "No transcript captured" (meaning both WebKit Speech Recognition and initial Whisper
 * fallback failed). It does NOT modify or delete any existing valid transcripts, and
 * does NOT touch any audio files - only updates the transcript JSON data.
 *
 * Session notes API reads from the recordings table; updating a recording's transcript
 * here automatically fixes how it appears in session notes. No session_notes table edits.
 * All recordings (including migrated ones) continue to show correctly via existing API logic.
 *
 * Usage: node scripts/migrate-legacy-no-transcript-recordings.js [--dry-run]
 *   --dry-run: List recordings that would be updated without making changes
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const FormData = require('form-data');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ANON_KEY)');
    process.exit(1);
}
if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY. Add to .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isDryRun = process.argv.includes('--dry-run');

/**
 * Extract storage filename from audio_url.
 * Handles /api/audio/{filename}, Supabase storage URLs, and bare filenames.
 */
function getAudioFileName(audioUrl, recordingId) {
    if (!audioUrl || typeof audioUrl !== 'string') return `${recordingId}.webm`;
    const match = audioUrl.match(/\/([^/]+\.(webm|m4a|mp3|wav|mp4|ogg|mpeg))$/i);
    if (match) return match[1];
    if (audioUrl.includes('/api/audio/')) return audioUrl.replace(/.*\/api\/audio\//, '').split('?')[0].trim();
    if (audioUrl.includes('/audio/')) return audioUrl.split('/audio/').pop().split('?')[0].trim();
    if (/^[^/]+\.(webm|m4a|mp3|wav|mp4|ogg|mpeg)$/i.test(audioUrl.trim())) return audioUrl.trim();
    return `${recordingId}.webm`;
}

/**
 * Check if a recording's transcript is the "No transcript captured" placeholder.
 * Transcript is stored as JSON: { transcript: string, notes: NoteSection[] }
 */
function isNoTranscriptCaptured(transcriptRaw) {
    if (!transcriptRaw || typeof transcriptRaw !== 'string') return false;
    try {
        const parsed = JSON.parse(transcriptRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return (parsed.transcript || '').trim() === 'No transcript captured';
        }
        return transcriptRaw.trim() === 'No transcript captured';
    } catch {
        return transcriptRaw.trim() === 'No transcript captured';
    }
}

/**
 * Transcribe audio buffer via OpenAI Whisper. Returns transcript string or null on failure.
 */
async function transcribeWithWhisper(buffer, fileName) {
    const formData = new FormData();
    formData.append('file', buffer, {
        filename: fileName || 'audio.webm',
        contentType: 'audio/webm'
    });
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    try {
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const transcript = (response.data && response.data.text) || '';
        return transcript.trim() || null;
    } catch (err) {
        if (err.response) {
            console.error(`   Whisper API error: ${err.response.status}`, err.response.data?.error?.message || '');
        } else {
            console.error(`   Whisper error:`, err.message);
        }
        return null;
    }
}

/**
 * Parse existing transcript JSON to preserve notes structure when updating.
 */
function parseTranscriptPayload(transcriptRaw) {
    try {
        const parsed = JSON.parse(transcriptRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { transcript: parsed.transcript || '', notes: Array.isArray(parsed.notes) ? parsed.notes : [] };
        }
        return { transcript: '', notes: [] };
    } catch {
        return { transcript: '', notes: [] };
    }
}

async function runMigration() {
    console.log('📋 Legacy migration: recordings with "No transcript captured"\n');
    console.log('Scope: Only updates transcript data. No audio files modified. No valid transcripts touched.\n');

    // Query all recordings with non-empty transcript (to include "No transcript captured")
    const { data: allRecordings, error: fetchError } = await supabase
        .from('recordings')
        .select('id, audio_url, transcript, client_id, created_at')
        .not('transcript', 'is', null)
        .neq('transcript', '');

    if (fetchError) {
        console.error('❌ Error fetching recordings:', fetchError);
        process.exit(1);
    }

    const legacyRecordings = (allRecordings || []).filter((r) => isNoTranscriptCaptured(r.transcript));
    console.log(`Found ${legacyRecordings.length} recording(s) with "No transcript captured"\n`);

    if (legacyRecordings.length === 0) {
        console.log('✅ Nothing to migrate.');
        return { updated: 0, failed: 0 };
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < legacyRecordings.length; i++) {
        const rec = legacyRecordings[i];
        const fileName = getAudioFileName(rec.audio_url, rec.id);
        console.log(`[${i + 1}/${legacyRecordings.length}] ${rec.id} (${fileName})`);

        if (isDryRun) {
            console.log('   [DRY-RUN] Would transcribe and update');
            continue;
        }

        // Download audio from Supabase storage (no audio files modified - read only)
        const { data: audioData, error: downloadError } = await supabase.storage
            .from('audio')
            .download(fileName);

        if (downloadError || !audioData) {
            console.log(`   ⚠️  Audio file not found, skipping (${downloadError?.message || 'no data'})`);
            failed++;
            continue;
        }

        const arrayBuffer = await audioData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const transcript = await transcribeWithWhisper(buffer, fileName);
        if (!transcript) {
            console.log('   ⚠️  Transcription failed, keeping "No transcript captured"');
            failed++;
            if (i < legacyRecordings.length - 1) await new Promise((r) => setTimeout(r, 1500));
            continue;
        }

        const existing = parseTranscriptPayload(rec.transcript);
        const newPayload = {
            transcript,
            notes: existing.notes
        };

        const { error: updateError } = await supabase
            .from('recordings')
            .update({ transcript: JSON.stringify(newPayload) })
            .eq('id', rec.id);

        if (updateError) {
            console.log(`   ❌ DB update failed:`, updateError.message);
            failed++;
            if (i < legacyRecordings.length - 1) await new Promise((r) => setTimeout(r, 1500));
            continue;
        }

        console.log(`   ✅ Updated (${transcript.length} chars)`);
        updated++;
        if (i < legacyRecordings.length - 1) await new Promise((r) => setTimeout(r, 1500));
    }

    return { updated, failed };
}

runMigration()
    .then(({ updated, failed }) => {
        const total = updated + failed;
        console.log('\n--- Summary ---');
        console.log(`Recordings with real transcript: ${updated}`);
        console.log(`Recordings still "No transcript captured": ${failed}`);
        if (isDryRun) {
            console.log(`(Dry run - no changes were made)`);
        }
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
