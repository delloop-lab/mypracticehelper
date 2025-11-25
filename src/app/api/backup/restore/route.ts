import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const backup = await request.json();

        // Validate backup structure
        if (!backup.metadata || !backup.clients || !backup.appointments) {
            return NextResponse.json(
                { error: 'Invalid backup file structure' },
                { status: 400 }
            );
        }

        const dataDir = path.join(process.cwd(), 'data');

        // Ensure data directory exists
        await fs.mkdir(dataDir, { recursive: true });

        // Create a backup of current data before restoring
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(dataDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });

        // Read current data
        const currentData = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                appName: 'My Practice Helper (Pre-Restore Backup)',
            },
            clients: await fs.readFile(path.join(dataDir, 'clients.json'), 'utf-8').catch(() => '[]'),
            appointments: await fs.readFile(path.join(dataDir, 'appointments.json'), 'utf-8').catch(() => '[]'),
            sessionNotes: await fs.readFile(path.join(dataDir, 'session-notes.json'), 'utf-8').catch(() => '[]'),
            recordings: await fs.readFile(path.join(dataDir, 'recordings.json'), 'utf-8').catch(() => '[]'),
        };

        // Save pre-restore backup
        await fs.writeFile(
            path.join(backupDir, `pre-restore-${timestamp}.json`),
            JSON.stringify(currentData, null, 2)
        );

        // Restore data from backup
        await Promise.all([
            fs.writeFile(
                path.join(dataDir, 'clients.json'),
                JSON.stringify(backup.clients, null, 2)
            ),
            fs.writeFile(
                path.join(dataDir, 'appointments.json'),
                JSON.stringify(backup.appointments, null, 2)
            ),
            fs.writeFile(
                path.join(dataDir, 'session-notes.json'),
                JSON.stringify(backup.sessionNotes || [], null, 2)
            ),
            fs.writeFile(
                path.join(dataDir, 'recordings.json'),
                JSON.stringify(backup.recordings || [], null, 2)
            ),
        ]);

        return NextResponse.json({
            success: true,
            message: 'Backup restored successfully',
            restoredCounts: {
                clients: backup.clients.length,
                appointments: backup.appointments.length,
                sessionNotes: backup.sessionNotes?.length || 0,
                recordings: backup.recordings?.length || 0,
            }
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        return NextResponse.json(
            { error: 'Failed to restore backup' },
            { status: 500 }
        );
    }
}
