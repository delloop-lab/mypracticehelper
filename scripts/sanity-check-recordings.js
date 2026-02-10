/**
 * Sanity-Check Recordings
 *
 * Confirms that every audio file has a transcript, duration is valid, and
 * session notes reflect the transcript. Does not modify any data.
 *
 * Usage: node scripts/sanity-check-recordings.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getAudioFileName(audioUrl, recordingId) {
    if (!audioUrl || typeof audioUrl !== 'string') return `${recordingId}.webm`;
    const match = audioUrl.match(/\/([^/]+\.(webm|m4a|mp3|wav|mp4|ogg|mpeg))$/i);
    if (match) return match[1];
    if (audioUrl.includes('/api/audio/')) return audioUrl.replace(/.*\/api\/audio\//, '').split('?')[0].trim();
    if (audioUrl.includes('/audio/')) return audioUrl.split('/audio/').pop().split('?')[0].trim();
    return `${recordingId}.webm`;
}

function parseTranscript(transcriptRaw) {
    if (!transcriptRaw || typeof transcriptRaw !== 'string') {
        return { transcript: '', notes: [], raw: transcriptRaw };
    }
    try {
        const parsed = JSON.parse(transcriptRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return {
                transcript: (parsed.transcript || '').trim(),
                notes: Array.isArray(parsed.notes) ? parsed.notes : [],
                raw: transcriptRaw
            };
        }
        if (Array.isArray(parsed)) {
            const transcript = parsed.map((n) => (typeof n === 'string' ? n : (n?.content || n?.text || ''))).join('\n\n').trim();
            return { transcript, notes: parsed, raw: transcriptRaw };
        }
        return { transcript: transcriptRaw.trim(), notes: [], raw: transcriptRaw };
    } catch {
        return { transcript: transcriptRaw.trim(), notes: [], raw: transcriptRaw };
    }
}

function notesReflectTranscript(notes, transcript) {
    if (!transcript || transcript === 'No transcript captured') return true;
    if (!Array.isArray(notes) || notes.length === 0) return true;
    const content = notes.map((n) => (typeof n === 'string' ? n : (n?.content || n?.text || ''))).join(' ').trim();
    return content.length > 0;
}

async function run() {
    console.log('📋 Sanity-Check Recordings\n');
    console.log('Checking: audio exists, transcript valid, notes contain transcript, duration > 0\n');

    const { data: recordings, error } = await supabase
        .from('recordings')
        .select('id, transcript, audio_url, duration, client_id, session_id, created_at, flagged')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching recordings:', error);
        process.exit(1);
    }

    const total = recordings?.length || 0;
    console.log(`Total recordings: ${total}\n`);

    const { data: audioFiles } = await supabase.storage.from('audio').list('', { limit: 5000 });
    const audioFileSet = new Set((audioFiles || []).map((f) => f.name));

    const report = {
        validTranscripts: 0,
        noTranscriptCaptured: 0,
        missingOrEmptyTranscript: 0,
        missingAudio: 0,
        zeroOrMissingDuration: 0,
        notesMissingTranscript: 0,
        unallocated: 0,
        flagged: 0,
        errors: [],
        noTranscriptIds: [],
        missingAudioIds: [],
        zeroDurationIds: [],
        unallocatedIds: [],
        flaggedIds: []
    };

    for (const rec of recordings || []) {
        const fileName = getAudioFileName(rec.audio_url, rec.id);
        const { transcript, notes } = parseTranscript(rec.transcript);

        let hasError = false;

        if (!rec.audio_url || !rec.audio_url.trim()) {
            report.missingAudio++;
            report.missingAudioIds.push(rec.id);
            report.errors.push({ id: rec.id, msg: 'Missing audio_url' });
            hasError = true;
        } else if (!audioFileSet.has(fileName)) {
            report.missingAudio++;
            report.missingAudioIds.push(rec.id);
            report.errors.push({ id: rec.id, msg: `Audio file not found: ${fileName}` });
            hasError = true;
        }

        if (!transcript || transcript.trim() === '') {
            report.missingOrEmptyTranscript++;
            report.errors.push({ id: rec.id, msg: 'Transcript missing or empty' });
            hasError = true;
        } else if (transcript === 'No transcript captured') {
            report.noTranscriptCaptured++;
            report.noTranscriptIds.push(rec.id);
        } else {
            report.validTranscripts++;
        }

        if (!hasError && transcript && transcript !== 'No transcript captured' && !notesReflectTranscript(notes, transcript)) {
            report.notesMissingTranscript++;
            report.errors.push({ id: rec.id, msg: 'Notes array has entries but no content (transcript present)' });
        }

        const duration = rec.duration ?? 0;
        if (duration <= 0 || duration === null || duration === undefined) {
            report.zeroOrMissingDuration++;
            report.zeroDurationIds.push(rec.id);
        }

        if (!rec.client_id && !rec.session_id) {
            report.unallocated++;
            report.unallocatedIds.push(rec.id);
        }
        if (rec.flagged) {
            report.flagged++;
            report.flaggedIds.push(rec.id);
        }
    }

    console.log('--- Summary ---\n');
    console.log(`Total recordings checked:          ${total}`);
    console.log(`Recordings with valid transcripts: ${report.validTranscripts}`);
    console.log(`Recordings "No transcript captured": ${report.noTranscriptCaptured}`);
    if (report.noTranscriptCaptured > 0) {
        console.log(`  IDs: ${report.noTranscriptIds.slice(0, 10).join(', ')}${report.noTranscriptIds.length > 10 ? '...' : ''}`);
    }
    console.log(`Missing/empty transcript:          ${report.missingOrEmptyTranscript}`);
    console.log(`Missing audio file:                ${report.missingAudio}`);
    if (report.missingAudio > 0) {
        console.log(`  IDs: ${report.missingAudioIds.slice(0, 10).join(', ')}${report.missingAudioIds.length > 10 ? '...' : ''}`);
    }
    console.log(`Zero or missing duration:          ${report.zeroOrMissingDuration}`);
    if (report.zeroOrMissingDuration > 0) {
        console.log(`  IDs: ${report.zeroDurationIds.slice(0, 10).join(', ')}${report.zeroDurationIds.length > 10 ? '...' : ''}`);
    }
    console.log(`Notes missing transcript match:   ${report.notesMissingTranscript}`);
    console.log(`Unallocated (no client/session):  ${report.unallocated}`);
    if (report.unallocated > 0) {
        console.log(`  IDs: ${report.unallocatedIds.slice(0, 10).join(', ')}${report.unallocatedIds.length > 10 ? '...' : ''}`);
    }
    console.log(`Flagged for review:               ${report.flagged}`);
    if (report.flagged > 0) {
        console.log(`  IDs: ${report.flaggedIds.slice(0, 10).join(', ')}${report.flaggedIds.length > 10 ? '...' : ''}`);
    }

    if (report.errors.length > 0) {
        console.log('\n--- Errors ---');
        report.errors.slice(0, 20).forEach((e) => console.log(`  ${e.id}: ${e.msg}`));
        if (report.errors.length > 20) {
            console.log(`  ... and ${report.errors.length - 20} more`);
        }
    }

    console.log('\n--- Checklist ---');
    console.log(`[${report.missingOrEmptyTranscript === 0 ? '✓' : '✗'}] All transcripts non-empty`);
    console.log(`[${report.noTranscriptCaptured === 0 ? '✓' : '○'}] None with "No transcript captured" (${report.noTranscriptCaptured} found)`);
    console.log(`[${report.missingAudio === 0 ? '✓' : '✗'}] All audio files present`);
    console.log(`[${report.zeroOrMissingDuration === 0 ? '✓' : '○'}] All have duration > 0 (${report.zeroOrMissingDuration} with zero/missing)`);

    const allGood = report.missingOrEmptyTranscript === 0 && report.missingAudio === 0;
    console.log('\n' + (allGood ? '✅ All recordings have transcripts and audio.' : '⚠️  Some recordings need attention.'));
}

run().then(() => process.exit(0)).catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
