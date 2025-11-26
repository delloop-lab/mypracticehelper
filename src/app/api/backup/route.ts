import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getClients } from '@/lib/storage';
import archiver from 'archiver';
import { Readable } from 'stream';
import { PassThrough } from 'stream';

export async function GET() {
    // Return empty list as local backups are not supported in cloud mode
    return NextResponse.json({ backups: [] });
}

export async function POST() {
    try {
        console.log('[Backup API] Starting backup creation...');
        
        // 1. Fetch all clients (including archived) - fetch directly from DB to get ALL
        const { data: allClientsRaw, error: clientsError } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (clientsError) {
            console.error('[Backup API] Error fetching clients:', clientsError);
        }
        
        // Map from Supabase format to app format (same logic as getClients)
        const clients = (allClientsRaw || []).map((client: any) => {
            // Parse metadata
            let metadata: any = {};
            if (client.metadata) {
                try {
                    metadata = typeof client.metadata === 'string' ? JSON.parse(client.metadata) : client.metadata;
                } catch {
                    metadata = {};
                }
            }
            
            return {
                id: client.id,
                name: client.name || '',
                email: client.email || '',
                phone: client.phone || '',
                notes: client.notes || '',
                nextAppointment: metadata.nextAppointment || '',
                recordings: 0,
                sessions: metadata.sessions || 0,
                documents: metadata.documents || [],
                relationships: metadata.relationships || [],
                firstName: metadata.firstName || client.name?.split(' ')[0] || '',
                lastName: metadata.lastName || client.name?.split(' ').slice(1).join(' ') || '',
                preferredName: metadata.preferredName || '',
                currency: metadata.currency || 'EUR',
                sessionFee: metadata.sessionFee || 0,
                dateOfBirth: metadata.dateOfBirth || '',
                mailingAddress: metadata.mailingAddress || '',
                emergencyContact: metadata.emergencyContact || undefined,
                medicalConditions: metadata.medicalConditions || '',
                currentMedications: metadata.currentMedications || '',
                doctorInfo: metadata.doctorInfo || undefined,
                archived: client.archived || false,
                archivedAt: client.archived_at || undefined
            };
        });
        console.log(`[Backup API] Fetched ${clients.length} clients (including archived)`);
        
        // 2. Fetch all sessions/appointments
        const { data: allSessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: false });
        
        if (sessionsError) {
            console.error('[Backup API] Error fetching sessions:', sessionsError);
        }
        
        // Get client map for mapping client_id to clientName
        const { data: allClientsForMap } = await supabase.from('clients').select('id, name');
        const clientMap = new Map((allClientsForMap || []).map((c: any) => [c.id, c.name]));
        
        // Convert sessions to appointments format
        const appointments = (allSessions || []).map((session: any) => {
            let metadata: any = {};
            try {
                if (session.metadata && typeof session.metadata === 'object') {
                    metadata = session.metadata;
                } else if (session.metadata && typeof session.metadata === 'string') {
                    metadata = JSON.parse(session.metadata);
                }
            } catch (e) {
                metadata = {};
            }
            
            // Extract date and time
            const dateTime = new Date(session.date);
            const date = dateTime.toISOString().split('T')[0];
            const time = dateTime.toTimeString().split(' ')[0].substring(0, 5);
            
            return {
                id: session.id,
                clientName: clientMap.get(session.client_id) || 'Unknown Client',
                date: date,
                time: time,
                duration: session.duration || 60,
                type: session.type || 'Therapy Session',
                status: metadata.status || 'confirmed',
                notes: session.notes || '',
                clinicalNotes: '',
                fee: metadata.fee,
                currency: metadata.currency || 'EUR',
                paymentStatus: metadata.paymentStatus || 'unpaid',
                paymentMethod: metadata.paymentMethod
            };
        });
        console.log(`[Backup API] Fetched ${appointments.length} appointments`);
        
        // 3. Fetch all session notes
        const { data: allNotes, error: notesError } = await supabase
            .from('session_notes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (notesError) {
            console.error('[Backup API] Error fetching session notes:', notesError);
        }
        
        // Get sessions map for mapping session_id to sessionDate
        const { data: allSessionsForMap } = await supabase.from('sessions').select('id, date, client_id');
        const sessionMap = new Map();
        (allSessionsForMap || []).forEach((s: any) => {
            sessionMap.set(s.id, { date: s.date, client_id: s.client_id });
        });
        
        // Convert session notes to frontend format
        const sessionNotes = (allNotes || []).map((note: any) => {
            const sessionInfo = sessionMap.get(note.session_id);
            const clientName = clientMap.get(note.client_id) || 
                              (sessionInfo ? clientMap.get(sessionInfo.client_id) : null) || 
                              'Unknown Client';
            
            return {
                id: note.id,
                clientName: clientName,
                sessionDate: sessionInfo ? sessionInfo.date : note.created_at,
                content: note.content || '',
                attachments: [],
                createdDate: note.created_at || note.createdDate || new Date().toISOString()
            };
        });
        console.log(`[Backup API] Fetched ${sessionNotes.length} session notes`);
        
        // 4. Fetch all recordings
        const { data: allRecordings, error: recordingsError } = await supabase
            .from('recordings')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (recordingsError) {
            console.error('[Backup API] Error fetching recordings:', recordingsError);
        }
        
        // Convert recordings to frontend format
        const recordings = (allRecordings || []).map((recording: any) => {
            // Parse transcript if it's JSON
            let notes = [];
            if (recording.transcript) {
                try {
                    const parsed = JSON.parse(recording.transcript);
                    if (Array.isArray(parsed)) {
                        notes = parsed;
                    } else {
                        notes = [{ title: 'Session Notes', content: recording.transcript }];
                    }
                } catch {
                    notes = [{ title: 'Session Notes', content: recording.transcript }];
                }
            }
            
            return {
                id: recording.id,
                clientName: clientMap.get(recording.client_id) || 'Unknown Client',
                date: recording.created_at ? new Date(recording.created_at).toISOString().split('T')[0] : '',
                notes: notes,
                duration: recording.duration || 0,
                url: recording.url || '',
                transcript: recording.transcript || ''
            };
        });
        console.log(`[Backup API] Fetched ${recordings.length} recordings`);
        
        // 5. Create ZIP file with separate JSON files
        console.log('[Backup API] Creating ZIP archive...');
        
        return new Promise<NextResponse>((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });
            
            const chunks: Buffer[] = [];
            
            archive.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            
            archive.on('end', () => {
                const zipBuffer = Buffer.concat(chunks);
                console.log('[Backup API] ZIP archive created successfully');
                console.log(`[Backup API] ZIP size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                console.log(`[Backup API] Summary: ${clients.length} clients, ${appointments.length} appointments, ${sessionNotes.length} notes, ${recordings.length} recordings`);
                
                resolve(new NextResponse(zipBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': `attachment; filename="therapist-backup-${new Date().toISOString().split('T')[0]}.zip"`,
                        'Content-Length': zipBuffer.length.toString()
                    }
                }));
            });
            
            archive.on('error', (err) => {
                console.error('[Backup API] Archive error:', err);
                reject(err);
            });
            
            // Create separate JSON files for each data type
            const backupData = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                summary: {
                    clients: clients.length,
                    appointments: appointments.length,
                    sessionNotes: sessionNotes.length,
                    recordings: recordings.length
                }
            };
            
            // Add metadata file
            archive.append(JSON.stringify(backupData, null, 2), { name: 'backup-metadata.json' });
            
            // Add clients file
            archive.append(JSON.stringify(clients, null, 2), { name: 'clients.json' });
            
            // Add appointments file
            archive.append(JSON.stringify(appointments, null, 2), { name: 'appointments.json' });
            
            // Add session notes file
            archive.append(JSON.stringify(sessionNotes, null, 2), { name: 'session-notes.json' });
            
            // Add recordings file
            archive.append(JSON.stringify(recordings, null, 2), { name: 'recordings.json' });
            
            // Finalize the archive
            archive.finalize();
        });
        
    } catch (error: any) {
        console.error('[Backup API] Error creating backup:', error);
        return NextResponse.json({
            error: `Failed to create backup: ${error?.message || 'Unknown error'}`,
            stack: error?.stack
        }, { status: 500 });
    }
}

export async function DELETE() {
    return NextResponse.json({
        error: 'Not supported'
    }, { status: 501 });
}

