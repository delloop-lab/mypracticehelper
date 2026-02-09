/**
 * Check Jolanda's sessions for recording/note discrepancies
 * Run with: node scripts/check-jolanda-sessions.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkJolandaSessions() {
    console.log('🔍 Checking Jolanda\'s sessions for discrepancies...\n');

    try {
        // Find Jolanda's client ID
        console.log('1. Finding Jolanda Iseli in clients table...');
        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('id, name')
            .ilike('name', '%jolanda%');

        if (clientsError) {
            console.error('❌ Error querying clients:', clientsError);
            return;
        }

        if (!clients || clients.length === 0) {
            console.log('⚠️  No client found with name containing "Jolanda"');
            return;
        }

        const jolandaClientId = clients[0].id;
        console.log(`✅ Found: ${clients[0].name} (ID: ${jolandaClientId})\n`);

        // Find sessions for February 9th and February 2nd
        console.log('2. Finding sessions for February 9th and February 2nd...');
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, date, duration, type')
            .eq('client_id', jolandaClientId)
            .gte('date', '2026-02-01T00:00:00Z')
            .lte('date', '2026-02-10T23:59:59Z')
            .order('date', { ascending: false });

        if (sessionsError) {
            console.error('❌ Error querying sessions:', sessionsError);
            return;
        }

        if (!sessions || sessions.length === 0) {
            console.log('⚠️  No sessions found for February');
            return;
        }

        console.log(`✅ Found ${sessions.length} session(s) in February:\n`);

        // Check each session
        for (const session of sessions) {
            const sessionDate = new Date(session.date);
            const dateStr = sessionDate.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
            
            console.log(`--- Session: ${dateStr} ---`);
            console.log(`Session ID: ${session.id}`);
            console.log(`Date: ${session.date}`);
            console.log(`Duration: ${session.duration || 0} mins`);
            console.log(`Type: ${session.type || 'N/A'}`);

            // Check recordings linked to this session
            const { data: recordings, error: recordingsError } = await supabase
                .from('recordings')
                .select('id, transcript, audio_url, duration, created_at')
                .eq('session_id', session.id)
                .order('created_at', { ascending: false });

            if (recordingsError) {
                console.error(`   ❌ Error querying recordings:`, recordingsError);
            } else {
                console.log(`\n   📹 Recordings linked to session: ${recordings?.length || 0}`);
                if (recordings && recordings.length > 0) {
                    recordings.forEach((rec, idx) => {
                        console.log(`      Recording ${idx + 1}:`);
                        console.log(`         ID: ${rec.id}`);
                        console.log(`         Created: ${new Date(rec.created_at).toLocaleString()}`);
                        console.log(`         Duration: ${rec.duration || 0} seconds`);
                        console.log(`         Audio URL: ${rec.audio_url ? 'Present' : 'Missing'}`);
                        
                        // Check transcript
                        let transcriptLength = 0;
                        if (rec.transcript) {
                            try {
                                const parsed = JSON.parse(rec.transcript);
                                if (typeof parsed === 'object' && parsed.transcript) {
                                    transcriptLength = parsed.transcript.length;
                                } else if (typeof parsed === 'string') {
                                    transcriptLength = parsed.length;
                                }
                            } catch {
                                transcriptLength = rec.transcript.length;
                            }
                        }
                        console.log(`         Transcript: ${transcriptLength > 0 ? `${transcriptLength} chars` : 'Empty'}`);
                    });
                }
            }

            // Check recordings by client_id (might be linked by client, not session)
            const { data: clientRecordings, error: clientRecordingsError } = await supabase
                .from('recordings')
                .select('id, session_id, transcript, audio_url, duration, created_at')
                .eq('client_id', jolandaClientId)
                .is('session_id', null) // Recordings without session_id
                .order('created_at', { ascending: false });

            // Also check recordings that might be near this session date
            const sessionStart = new Date(session.date);
            sessionStart.setHours(0, 0, 0, 0);
            const sessionEnd = new Date(session.date);
            sessionEnd.setHours(23, 59, 59, 999);

            const { data: dateRangeRecordings, error: dateRangeError } = await supabase
                .from('recordings')
                .select('id, session_id, transcript, audio_url, duration, created_at')
                .eq('client_id', jolandaClientId)
                .gte('created_at', sessionStart.toISOString())
                .lte('created_at', sessionEnd.toISOString())
                .order('created_at', { ascending: false });

            if (!dateRangeError && dateRangeRecordings && dateRangeRecordings.length > 0) {
                console.log(`\n   📹 Recordings created on same date (not linked to session): ${dateRangeRecordings.length}`);
                dateRangeRecordings.forEach((rec, idx) => {
                    console.log(`      Recording ${idx + 1}:`);
                    console.log(`         ID: ${rec.id}`);
                    console.log(`         Session ID: ${rec.session_id || 'NOT LINKED'}`);
                    console.log(`         Created: ${new Date(rec.created_at).toLocaleString()}`);
                });
            }

            // Check session_notes linked to this session
            const { data: sessionNotes, error: notesError } = await supabase
                .from('session_notes')
                .select('id, transcript, audio_url, content, created_at')
                .eq('session_id', session.id)
                .order('created_at', { ascending: false });

            if (notesError) {
                console.error(`   ❌ Error querying session_notes:`, notesError);
            } else {
                console.log(`\n   📝 Session notes linked to session: ${sessionNotes?.length || 0}`);
                if (sessionNotes && sessionNotes.length > 0) {
                    sessionNotes.forEach((note, idx) => {
                        console.log(`      Note ${idx + 1}:`);
                        console.log(`         ID: ${note.id}`);
                        console.log(`         Created: ${new Date(note.created_at).toLocaleString()}`);
                        console.log(`         Has Transcript: ${note.transcript ? 'YES' : 'NO'}`);
                        console.log(`         Has Audio URL: ${note.audio_url ? 'YES' : 'NO'}`);
                        console.log(`         Has Content: ${note.content ? 'YES' : 'NO'}`);
                    });
                }
            }

            // Check session_notes by client_id for same date
            const { data: dateRangeNotes, error: dateRangeNotesError } = await supabase
                .from('session_notes')
                .select('id, session_id, transcript, audio_url, content, created_at')
                .eq('client_id', jolandaClientId)
                .gte('created_at', sessionStart.toISOString())
                .lte('created_at', sessionEnd.toISOString())
                .order('created_at', { ascending: false });

            if (!dateRangeNotesError && dateRangeNotes && dateRangeNotes.length > 0) {
                console.log(`\n   📝 Session notes created on same date: ${dateRangeNotes.length}`);
                dateRangeNotes.forEach((note, idx) => {
                    console.log(`      Note ${idx + 1}:`);
                    console.log(`         ID: ${note.id}`);
                    console.log(`         Session ID: ${note.session_id || 'NOT LINKED'}`);
                    console.log(`         Created: ${new Date(note.created_at).toLocaleString()}`);
                    console.log(`         Has Transcript: ${note.transcript ? 'YES' : 'NO'}`);
                    console.log(`         Has Audio URL: ${note.audio_url ? 'YES' : 'NO'}`);
                });
            }

            console.log('\n');
        }

        // Summary: Check all recordings for Jolanda
        console.log('3. Summary - All recordings for Jolanda:');
        const { data: allRecordings, error: allRecordingsError } = await supabase
            .from('recordings')
            .select('id, session_id, transcript, audio_url, duration, created_at')
            .eq('client_id', jolandaClientId)
            .order('created_at', { ascending: false });

        if (!allRecordingsError && allRecordings) {
            console.log(`   Total recordings: ${allRecordings.length}`);
            const withSessionId = allRecordings.filter(r => r.session_id);
            const withoutSessionId = allRecordings.filter(r => !r.session_id);
            console.log(`   Linked to sessions: ${withSessionId.length}`);
            console.log(`   Not linked to sessions: ${withoutSessionId.length}`);
            
            // Group by session_id
            const bySession = {};
            allRecordings.forEach(rec => {
                const key = rec.session_id || 'unlinked';
                if (!bySession[key]) {
                    bySession[key] = [];
                }
                bySession[key].push(rec);
            });
            
            console.log('\n   Recordings by session:');
            Object.keys(bySession).forEach(key => {
                if (key === 'unlinked') {
                    console.log(`      Unlinked: ${bySession[key].length} recording(s)`);
                } else {
                    console.log(`      Session ${key}: ${bySession[key].length} recording(s)`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        console.error(error.stack);
    }
}

checkJolandaSessions().then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
