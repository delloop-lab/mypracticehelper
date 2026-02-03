/**
 * Cleanup Script: Remove AI Clinical Assessment from Live Recordings
 * 
 * This script removes AI Clinical Assessment notes from recordings that were recorded live.
 * It does NOT delete any recordings or session notes - only updates the transcript JSON data.
 * 
 * Usage:
 *   node scripts/cleanup-live-recording-ai.js [--dry-run] [--backup]
 * 
 * Options:
 *   --dry-run: Show what would be changed without making changes
 *   --backup: Create a backup before making changes
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase credentials in .env.local');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes('--dry-run');
const shouldBackup = process.argv.includes('--backup') || !isDryRun;

async function cleanupLiveRecordingAI() {
    console.log('🔍 Finding recordings with AI Clinical Assessment...\n');

    try {
        // Fetch all recordings with transcripts
        const { data: recordings, error: fetchError } = await supabase
            .from('recordings')
            .select('id, title, client_id, transcript, audio_url, created_at')
            .not('transcript', 'is', null)
            .neq('transcript', '');

        if (fetchError) {
            throw fetchError;
        }

        if (!recordings || recordings.length === 0) {
            console.log('✅ No recordings found.');
            return;
        }

        console.log(`📊 Found ${recordings.length} recordings with transcripts\n`);

        // Filter recordings that have AI Clinical Assessment in notes
        const recordingsToClean = [];
        const debugInfo = [];
        
        for (const recording of recordings) {
            try {
                const transcriptData = JSON.parse(recording.transcript);
                let hasAIAssessment = false;
                let formatType = 'unknown';
                
                // Check new format: { transcript: string, notes: NoteSection[] }
                if (transcriptData && typeof transcriptData === 'object' && !Array.isArray(transcriptData)) {
                    if (Array.isArray(transcriptData.notes)) {
                        formatType = 'new_format';
                        hasAIAssessment = transcriptData.notes.some(
                            (note) => note && typeof note === 'object' && 
                            (note.title === 'AI Clinical Assessment' || note.title === 'AI-Structured Notes')
                        );
                    }
                }
                // Check old format: array of note sections directly
                else if (Array.isArray(transcriptData)) {
                    formatType = 'old_format_array';
                    hasAIAssessment = transcriptData.some(
                        (note) => note && typeof note === 'object' && 
                        (note.title === 'AI Clinical Assessment' || note.title === 'AI-Structured Notes')
                    );
                }
                
                // Get detailed info about the structure
                let notesCount = 0;
                let notesTitles = [];
                let hasTranscriptField = false;
                
                if (formatType === 'new_format' && transcriptData.notes) {
                    notesCount = transcriptData.notes.length;
                    notesTitles = transcriptData.notes.map(n => n?.title || 'no title');
                    hasTranscriptField = !!transcriptData.transcript;
                } else if (formatType === 'old_format_array') {
                    notesCount = transcriptData.length;
                    notesTitles = transcriptData.map(n => (typeof n === 'object' ? n?.title : 'string') || 'no title');
                }
                
                debugInfo.push({
                    id: recording.id,
                    formatType,
                    hasAIAssessment,
                    notesCount,
                    notesTitles,
                    hasTranscriptField,
                    transcriptPreview: recording.transcript.substring(0, 200),
                    fullStructure: JSON.stringify(transcriptData, null, 2).substring(0, 500)
                });
                
                if (hasAIAssessment) {
                    recordingsToClean.push({
                        ...recording,
                        transcriptData,
                        formatType
                    });
                }
            } catch (e) {
                // Skip recordings with invalid JSON
                debugInfo.push({
                    id: recording.id,
                    formatType: 'invalid_json',
                    hasAIAssessment: false,
                    error: e.message
                });
                continue;
            }
        }
        
        // Show debug info
        console.log('\n📋 Debug Info - All recordings checked:');
        debugInfo.forEach((info, idx) => {
            console.log(`\n  ${idx + 1}. ID: ${info.id.substring(0, 8)}...`);
            console.log(`     Format: ${info.formatType} | Has AI: ${info.hasAIAssessment}`);
            if (info.notesCount !== undefined) {
                console.log(`     Notes count: ${info.notesCount}`);
                console.log(`     Notes titles: ${info.notesTitles.join(', ') || 'none'}`);
                console.log(`     Has transcript field: ${info.hasTranscriptField}`);
            }
            if (info.error) {
                console.log(`     Error: ${info.error}`);
            }
            console.log(`     Transcript preview: ${info.transcriptPreview}...`);
            if (info.fullStructure) {
                console.log(`     Full structure:\n${info.fullStructure}...`);
            }
        });
        console.log('');

        if (recordingsToClean.length === 0) {
            console.log('✅ No recordings found with AI Clinical Assessment that need cleanup.');
            return;
        }

        console.log(`⚠️  Found ${recordingsToClean.length} recordings with AI Clinical Assessment:\n`);
        
        // Show preview
        recordingsToClean.slice(0, 5).forEach((rec, idx) => {
            console.log(`  ${idx + 1}. ID: ${rec.id}`);
            console.log(`     Title: ${rec.title || 'Untitled'}`);
            console.log(`     Created: ${new Date(rec.created_at).toLocaleDateString()}`);
            console.log(`     Notes count: ${rec.transcriptData.notes.length}`);
            console.log('');
        });

        if (recordingsToClean.length > 5) {
            console.log(`  ... and ${recordingsToClean.length - 5} more\n`);
        }

        if (isDryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made.');
            console.log(`   Would update ${recordingsToClean.length} recordings.`);
            return;
        }

        // Create backup if requested
        if (shouldBackup) {
            console.log('💾 Creating backup...');
            const backupData = recordingsToClean.map(r => ({
                id: r.id,
                original_transcript: r.transcript,
                updated_at: new Date().toISOString()
            }));

            // Save backup to a file
            const fs = require('fs');
            const backupFile = `backup-ai-cleanup-${Date.now()}.json`;
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
            console.log(`✅ Backup saved to ${backupFile}\n`);
        }

        // Update recordings
        console.log('🔄 Updating recordings...\n');
        let updatedCount = 0;
        let errorCount = 0;

        for (const recording of recordingsToClean) {
            try {
                const { transcriptData, formatType } = recording;
                let updatedTranscript;
                
                if (formatType === 'new_format') {
                    // New format: { transcript, notes }
                    const filteredNotes = transcriptData.notes.filter(
                        (note) => !(note && typeof note === 'object' && 
                        (note.title === 'AI Clinical Assessment' || note.title === 'AI-Structured Notes'))
                    );
                    
                    updatedTranscript = {
                        transcript: transcriptData.transcript || '',
                        notes: filteredNotes
                    };
                } else if (formatType === 'old_format_array') {
                    // Old format: array of notes directly
                    // Filter out AI Clinical Assessment, keep others
                    const filteredNotes = transcriptData.filter(
                        (note) => !(note && typeof note === 'object' && 
                        (note.title === 'AI Clinical Assessment' || note.title === 'AI-Structured Notes'))
                    );
                    
                    // Convert to new format
                    const transcriptText = filteredNotes
                        .map((n) => typeof n === 'string' ? n : (n.content || n.text || ''))
                        .join('\n\n');
                    
                    updatedTranscript = {
                        transcript: transcriptText,
                        notes: filteredNotes
                    };
                } else {
                    console.log(`⚠️  Skipping recording ${recording.id} - unknown format: ${formatType}`);
                    continue;
                }

                const { error: updateError } = await supabase
                    .from('recordings')
                    .update({ transcript: JSON.stringify(updatedTranscript) })
                    .eq('id', recording.id);

                if (updateError) {
                    console.error(`❌ Error updating recording ${recording.id}:`, updateError.message);
                    errorCount++;
                } else {
                    updatedCount++;
                    if (updatedCount % 10 === 0) {
                        console.log(`   Updated ${updatedCount}/${recordingsToClean.length}...`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing recording ${recording.id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n✅ Cleanup complete!');
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Total: ${recordingsToClean.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupLiveRecordingAI()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
