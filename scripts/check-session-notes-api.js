/**
 * Check what the session-notes API returns for Jolanda
 * Run with: node scripts/check-session-notes-api.js
 */

require('dotenv').config({ path: '.env.local' });

async function checkSessionNotesAPI() {
    console.log('🔍 Checking session-notes API response for Jolanda...\n');

    try {
        // Call the API (assuming dev server is running)
        const response = await fetch('http://localhost:3000/api/session-notes');
        
        if (!response.ok) {
            console.error('❌ API error:', response.status, response.statusText);
            return;
        }

        const allNotes = await response.json();
        
        // Filter for Jolanda
        const jolandaNotes = allNotes.filter((note) =>
            note.clientName?.toLowerCase().includes('jolanda')
        );

        console.log(`✅ Found ${jolandaNotes.length} session notes for Jolanda:\n`);

        // Group by session ID
        const bySession = {};
        jolandaNotes.forEach(note => {
            const sessionId = note.sessionId || note.session_id;
            if (!sessionId) {
                console.log('   Note without session ID:', note.id);
                return;
            }
            if (!bySession[sessionId]) {
                bySession[sessionId] = [];
            }
            bySession[sessionId].push(note);
        });

        Object.keys(bySession).forEach(sessionId => {
            const notes = bySession[sessionId];
            console.log(`--- Session ID: ${sessionId} ---`);
            console.log(`   Notes count: ${notes.length}`);
            notes.forEach((note, idx) => {
                console.log(`   Note ${idx + 1}:`);
                console.log(`      ID: ${note.id}`);
                console.log(`      Source: ${note.source || 'N/A'}`);
                console.log(`      Recording ID: ${note.recordingId || 'N/A'}`);
                console.log(`      Has Transcript: ${note.transcript ? 'YES' : 'NO'}`);
                console.log(`      Has Audio URL: ${note.audioURL || note.audio_url ? 'YES' : 'NO'}`);
                console.log(`      Has Content: ${note.content ? 'YES' : 'NO'}`);
            });
            console.log('');
        });

        // Check recordings API
        console.log('📹 Checking recordings API...\n');
        const recordingsResponse = await fetch('http://localhost:3000/api/recordings');
        
        if (recordingsResponse.ok) {
            const allRecordings = await recordingsResponse.json();
            const jolandaRecordings = allRecordings.filter((rec) =>
                rec.clientName?.toLowerCase().includes('jolanda')
            );

            console.log(`✅ Found ${jolandaRecordings.length} recordings for Jolanda:\n`);
            
            jolandaRecordings.forEach((rec, idx) => {
                console.log(`   Recording ${idx + 1}:`);
                console.log(`      ID: ${rec.id}`);
                console.log(`      Session ID: ${rec.sessionId || rec.session_id || 'NOT LINKED'}`);
                console.log(`      Created: ${rec.date || rec.created_at || 'N/A'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('   Make sure dev server is running: npm run dev');
    }
}

checkSessionNotesAPI().then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
