/**
 * Show audio files and transcriptions for a client by name.
 * Usage: node scripts/show-client-recordings.js "Sam Duarte"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const clientName = process.argv[2] || 'Sam Duarte';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseTranscript(raw) {
    if (!raw || typeof raw !== 'string') return '';
    try {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && typeof p.transcript === 'string') return p.transcript;
        if (Array.isArray(p)) return p.map(n => (typeof n === 'string' ? n : n?.content || n?.text || '')).join('\n\n').trim();
        return raw;
    } catch {
        return raw;
    }
}

async function run() {
    console.log(`\n📋 Audio files & transcriptions for: ${clientName}\n`);

    // Find client
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', `%${clientName}%`);

    if (clientsError) {
        console.error('❌ Error fetching clients:', clientsError);
        process.exit(1);
    }

    if (!clients || clients.length === 0) {
        console.log('⚠️  No client found matching "' + clientName + '"');
        const { data: all } = await supabase.from('clients').select('id, name').limit(20);
        if (all?.length) {
            console.log('\nClients in DB (sample):');
            all.forEach(c => console.log('   -', c.name));
        }
        process.exit(0);
    }

    const client = clients[0];
    const clientId = client.id;
    console.log(`✅ Client: ${client.name} (ID: ${clientId})\n`);

    // Recordings allocated to this client (client_id match)
    const { data: recordings, error: recError } = await supabase
        .from('recordings')
        .select('id, audio_url, transcript, created_at, client_id, session_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (recError) {
        console.error('❌ Error fetching recordings:', recError);
        process.exit(1);
    }

    const allRecs = recordings || [];

    console.log(`📁 Recordings (${allRecs.length}):\n`);
    allRecs.forEach((r, i) => {
        const url = r.audio_url || `/api/audio/${r.id}.webm`;
        const file = url.includes('/api/audio/') ? url.split('/api/audio/').pop()?.split('?')[0] : url;
        const transcript = parseTranscript(r.transcript);
        const preview = transcript ? transcript.substring(0, 150) + (transcript.length > 150 ? '...' : '') : '(no transcript)';
        console.log(`${i + 1}. ${file}`);
        console.log(`   Date: ${r.created_at || 'n/a'}`);
        console.log(`   Transcript: ${preview}`);
        console.log('');
    });

    // Session notes with audio
    const { data: notes, error: notesError } = await supabase
        .from('session_notes')
        .select('id, audio_url, transcript, content, created_at, client_id')
        .eq('client_id', clientId);

    if (!notesError && notes?.length) {
        const withAudio = notes.filter(n => n.audio_url);
        if (withAudio.length) {
            console.log(`\n📝 Session notes with audio (${withAudio.length}):\n`);
            withAudio.forEach((n, i) => {
                const file = n.audio_url?.split('/').pop() || n.audio_url;
                const text = n.transcript || n.content || '(no transcript)';
                const preview = text.substring(0, 150) + (text.length > 150 ? '...' : '');
                console.log(`${i + 1}. ${file}`);
                console.log(`   Date: ${n.created_at || 'n/a'}`);
                console.log(`   Content: ${preview}`);
                console.log('');
            });
        }
    }

    if (allRecs.length === 0 && (!notes?.length || !notes.some(n => n.audio_url))) {
        console.log('No audio files or transcriptions found for this client.\n');
    }

    console.log('---\n');
}

run().catch(err => {
    console.error('❌', err);
    process.exit(1);
});
