/**
 * Transcribe Yolanda's failed recording using OpenAI Whisper API
 * Run with: node scripts/transcribe-yolanda-recording.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!');
    process.exit(1);
}

if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY environment variable!');
    console.error('Add OPENAI_API_KEY to your .env.local file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const recordingId = '1770635744574'; // Jolanda's failed recording

async function transcribeRecording() {
    console.log(`🎙️  Transcribing recording ${recordingId}...\n`);

    try {
        // Step 1: Get recording info from database
        console.log('1. Fetching recording info from database...');
        const { data: recording, error: fetchError } = await supabase
            .from('recordings')
            .select('id, audio_url, transcript, client_id, duration, created_at')
            .eq('id', recordingId)
            .single();

        if (fetchError || !recording) {
            console.error('❌ Error fetching recording:', fetchError);
            return;
        }

        console.log(`✅ Found recording:`);
        console.log(`   Created: ${new Date(recording.created_at).toLocaleString()}`);
        console.log(`   Duration: ${recording.duration || 0} seconds`);
        console.log(`   Audio URL: ${recording.audio_url}`);
        console.log(`   Current transcript: "${recording.transcript || 'null'}"\n`);

        // Step 2: Download audio file from Supabase Storage
        console.log('2. Downloading audio file from storage...');
        const fileName = recording.audio_url?.replace('/api/audio/', '') || `${recordingId}.webm`;
        console.log(`   File name: ${fileName}`);

        const { data: audioData, error: downloadError } = await supabase.storage
            .from('audio')
            .download(fileName);

        if (downloadError || !audioData) {
            console.error('❌ Error downloading audio file:', downloadError);
            return;
        }

        // Convert blob to buffer
        const arrayBuffer = await audioData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`✅ Downloaded audio file (${(buffer.length / 1024 / 1024).toFixed(2)} MB)\n`);

        // Step 3: Save to temp file
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFilePath = path.join(tempDir, `${recordingId}.webm`);
        fs.writeFileSync(tempFilePath, buffer);
        console.log(`✅ Saved to temp file: ${tempFilePath}\n`);

        // Step 4: Call OpenAI Whisper API directly (no dev server needed)
        console.log('3. Calling OpenAI Whisper API directly...\n');
        
        // Use axios which handles multipart/form-data properly
        const axios = require('axios');
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', buffer, {
            filename: fileName,
            contentType: 'audio/webm'
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');

        let transcript = '';
        try {
            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            transcript = response.data.text || '';
        } catch (error) {
            // Clean up temp file before error handling
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                // Ignore cleanup errors
            }
            
            if (error.response) {
                console.error('❌ OpenAI API error:', error.response.status, error.response.statusText);
                console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.error('❌ Request error:', error.message);
            }
            return;
        }

        // Clean up temp file
        try {
            fs.unlinkSync(tempFilePath);
        } catch (e) {
            // Ignore cleanup errors
        }

        if (!transcript) {
            console.error('❌ Transcription returned empty result');
            return;
        }

        console.log(`✅ Transcription successful!`);
        console.log(`   Transcript length: ${transcript.length} characters`);
        console.log(`   Preview: ${transcript.substring(0, 200)}...\n`);

        // Step 5: Update database with new transcript
        console.log('4. Updating database with new transcript...');
        
        // Get current recordings to update
        const { data: allRecordings, error: getAllError } = await supabase
            .from('recordings')
            .select('*')
            .eq('client_id', recording.client_id);

        if (getAllError) {
            console.error('❌ Error fetching recordings:', getAllError);
            return;
        }

        // Find the recording and update it
        const recordingIndex = allRecordings.findIndex(r => r.id === recordingId);
        if (recordingIndex === -1) {
            console.error('❌ Recording not found in fetched list');
            return;
        }

        // Update transcript in the recording object
        // The transcript is stored as JSON: { transcript: string, notes: [] }
        const updatedRecording = {
            ...allRecordings[recordingIndex],
            transcript: JSON.stringify({
                transcript: transcript,
                notes: []
            })
        };

        // Save back to database
        const { data: savedRecordings, error: saveError } = await supabase
            .from('recordings')
            .select('id, transcript')
            .eq('client_id', recording.client_id);

        if (saveError) {
            console.error('❌ Error fetching recordings for update:', saveError);
            return;
        }

        // Update the specific recording
        const recordingsToSave = savedRecordings.map(r => {
            if (r.id === recordingId) {
                return {
                    ...r,
                    transcript: JSON.stringify({
                        transcript: transcript,
                        notes: []
                    })
                };
            }
            return r;
        });

        // Use the storage.ts saveRecordings logic - we need to map properly
        const { error: updateError } = await supabase
            .from('recordings')
            .update({
                transcript: JSON.stringify({
                    transcript: transcript,
                    notes: []
                })
            })
            .eq('id', recordingId);

        if (updateError) {
            console.error('❌ Error updating recording:', updateError);
            return;
        }

        console.log('✅ Database updated successfully!\n');

        // Step 6: Verify the update
        console.log('5. Verifying update...');
        const { data: verifyRecording, error: verifyError } = await supabase
            .from('recordings')
            .select('transcript')
            .eq('id', recordingId)
            .single();

        if (verifyError) {
            console.error('❌ Error verifying update:', verifyError);
        } else {
            try {
                const parsed = JSON.parse(verifyRecording.transcript);
                const savedTranscript = parsed.transcript || verifyRecording.transcript;
                console.log(`✅ Verification successful!`);
                console.log(`   Saved transcript length: ${savedTranscript.length} characters`);
                console.log(`   Preview: ${savedTranscript.substring(0, 200)}...`);
            } catch (e) {
                console.log(`✅ Verification successful!`);
                console.log(`   Transcript: ${verifyRecording.transcript.substring(0, 200)}...`);
            }
        }

        console.log('\n🎉 Transcription complete! The recording now has a transcript.');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        console.error(error.stack);
    }
}

transcribeRecording().then(() => {
    console.log('\n✅ Process complete!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
