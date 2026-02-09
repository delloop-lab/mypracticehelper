/**
 * Check database for Yolanda's recording transcript
 * Run with: node scripts/check-yolanda-transcript.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkYolandaTranscript() {
    console.log('🔍 Checking database for Yolanda\'s recordings...\n');

    try {
        // First, find Yolanda's client ID
        console.log('1. Finding Yolanda in clients table...');
        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('id, name')
            .ilike('name', '%yolanda%');

        if (clientsError) {
            console.error('❌ Error querying clients:', clientsError);
            return;
        }

        if (!clients || clients.length === 0) {
            console.log('⚠️  No client found with name containing "Yolanda"');
            console.log('Checking all recent recordings instead...\n');
            
            // Check all recent recordings
            const { data: allRecordings, error: recordingsError } = await supabase
                .from('recordings')
                .select(`
                    id,
                    client_id,
                    transcript,
                    audio_url,
                    duration,
                    created_at,
                    clients (name)
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (recordingsError) {
                console.error('❌ Error querying recordings:', recordingsError);
                return;
            }

            console.log(`\n📊 Found ${allRecordings.length} most recent recordings:\n`);
            allRecordings.forEach((rec, idx) => {
                console.log(`--- Recording ${idx + 1} ---`);
                console.log(`ID: ${rec.id}`);
                console.log(`Client: ${rec.clients?.name || 'Unassigned'}`);
                console.log(`Created: ${new Date(rec.created_at).toLocaleString()}`);
                console.log(`Duration: ${rec.duration || 0} seconds`);
                console.log(`Audio URL: ${rec.audio_url || 'Missing'}`);
                
                // Parse transcript
                let transcriptText = '';
                let transcriptLength = 0;
                if (rec.transcript) {
                    try {
                        const parsed = JSON.parse(rec.transcript);
                        if (typeof parsed === 'object' && parsed.transcript) {
                            transcriptText = parsed.transcript;
                            transcriptLength = transcriptText.length;
                        } else if (typeof parsed === 'string') {
                            transcriptText = parsed;
                            transcriptLength = transcriptText.length;
                        } else {
                            transcriptText = JSON.stringify(parsed);
                            transcriptLength = transcriptText.length;
                        }
                    } catch {
                        transcriptText = rec.transcript;
                        transcriptLength = transcriptText.length;
                    }
                }
                
                console.log(`Transcript Length: ${transcriptLength} characters`);
                if (transcriptLength === 0) {
                    console.log('⚠️  TRANSCRIPT IS EMPTY!');
                } else if (transcriptText === 'No transcript captured') {
                    console.log('⚠️  TRANSCRIPT SAYS: "No transcript captured"');
                } else {
                    console.log(`Transcript Preview: ${transcriptText.substring(0, 100)}${transcriptText.length > 100 ? '...' : ''}`);
                }
                console.log('');
            });
            
            return;
        }

        console.log(`✅ Found ${clients.length} client(s) matching "Yolanda":`);
        clients.forEach(c => console.log(`   - ${c.name} (ID: ${c.id})`));
        console.log('');

        // Query recordings for Yolanda
        const yolandaClientId = clients[0].id;
        console.log(`2. Checking recordings for client ID: ${yolandaClientId}...`);
        
        const { data: recordings, error: recordingsError } = await supabase
            .from('recordings')
            .select(`
                id,
                client_id,
                transcript,
                audio_url,
                duration,
                created_at,
                session_id
            `)
            .eq('client_id', yolandaClientId)
            .order('created_at', { ascending: false });

        if (recordingsError) {
            console.error('❌ Error querying recordings:', recordingsError);
            return;
        }

        if (!recordings || recordings.length === 0) {
            console.log('⚠️  No recordings found for Yolanda');
            return;
        }

        console.log(`✅ Found ${recordings.length} recording(s) for Yolanda:\n`);

        recordings.forEach((recording, idx) => {
            console.log(`--- Recording ${idx + 1} (Most Recent: ${idx === 0 ? 'YES' : 'NO'}) ---`);
            console.log(`ID: ${recording.id}`);
            console.log(`Created: ${new Date(recording.created_at).toLocaleString()}`);
            console.log(`Duration: ${recording.duration || 0} seconds`);
            console.log(`Session ID: ${recording.session_id || 'Not linked to session'}`);
            console.log(`Audio URL: ${recording.audio_url || 'Missing'}`);
            
            // Parse transcript
            let transcriptText = '';
            let transcriptLength = 0;
            let transcriptRaw = recording.transcript;
            
            if (recording.transcript) {
                try {
                    const parsed = JSON.parse(recording.transcript);
                    if (typeof parsed === 'object' && parsed.transcript) {
                        transcriptText = parsed.transcript;
                        transcriptLength = transcriptText.length;
                        console.log(`Transcript Format: JSON object with 'transcript' field`);
                    } else if (typeof parsed === 'string') {
                        transcriptText = parsed;
                        transcriptLength = transcriptText.length;
                        console.log(`Transcript Format: Plain string`);
                    } else {
                        transcriptText = JSON.stringify(parsed);
                        transcriptLength = transcriptText.length;
                        console.log(`Transcript Format: JSON object (other structure)`);
                    }
                } catch {
                    transcriptText = recording.transcript;
                    transcriptLength = transcriptText.length;
                    console.log(`Transcript Format: Plain text (not JSON)`);
                }
            } else {
                console.log(`Transcript: NULL or empty`);
            }
            
            console.log(`Transcript Length: ${transcriptLength} characters`);
            console.log(`Raw Transcript (first 200 chars): ${transcriptRaw ? transcriptRaw.substring(0, 200) : 'null'}...`);
            
            if (transcriptLength === 0) {
                console.log('⚠️  ⚠️  ⚠️  TRANSCRIPT IS EMPTY! ⚠️  ⚠️  ⚠️');
                console.log('   This means transcription failed - either SpeechRecognition or OpenAI Whisper failed');
            } else if (transcriptText === 'No transcript captured') {
                console.log('⚠️  ⚠️  ⚠️  TRANSCRIPT SAYS: "No transcript captured" ⚠️  ⚠️  ⚠️');
                console.log('   This means both transcription methods failed');
            } else {
                console.log(`✅ Transcript exists (${transcriptLength} characters)`);
                console.log(`Preview: ${transcriptText.substring(0, 150)}${transcriptText.length > 150 ? '...' : ''}`);
            }
            console.log('');
        });

        // Check session_notes table too
        console.log('3. Checking session_notes table for Yolanda...');
        const { data: sessionNotes, error: notesError } = await supabase
            .from('session_notes')
            .select(`
                id,
                client_id,
                session_id,
                transcript,
                audio_url,
                content,
                created_at
            `)
            .eq('client_id', yolandaClientId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (notesError) {
            console.error('❌ Error querying session_notes:', notesError);
        } else if (sessionNotes && sessionNotes.length > 0) {
            console.log(`✅ Found ${sessionNotes.length} session note(s) for Yolanda:\n`);
            sessionNotes.forEach((note, idx) => {
                console.log(`--- Session Note ${idx + 1} ---`);
                console.log(`ID: ${note.id}`);
                console.log(`Created: ${new Date(note.created_at).toLocaleString()}`);
                console.log(`Session ID: ${note.session_id || 'Not linked'}`);
                console.log(`Has Transcript: ${note.transcript ? 'YES' : 'NO'}`);
                console.log(`Transcript Length: ${note.transcript ? note.transcript.length : 0} characters`);
                console.log(`Has Audio URL: ${note.audio_url ? 'YES' : 'NO'}`);
                console.log(`Has Content: ${note.content ? 'YES' : 'NO'}`);
                if (note.transcript) {
                    console.log(`Transcript Preview: ${note.transcript.substring(0, 100)}${note.transcript.length > 100 ? '...' : ''}`);
                }
                console.log('');
            });
        } else {
            console.log('⚠️  No session notes found for Yolanda');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

checkYolandaTranscript().then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
