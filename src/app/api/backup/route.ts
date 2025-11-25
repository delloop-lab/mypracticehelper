import { NextResponse } from 'next/server';
import { getClients } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

// Ensure backup directory exists
async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating backup directory:', error);
    }
}

export async function GET() {
    try {
        await ensureBackupDir();

        // List all backup files
        const files = await fs.readdir(BACKUP_DIR);
        const backups = await Promise.all(
            files
                .filter(f => f.endsWith('.json'))
                .map(async (file) => {
                    const filePath = path.join(BACKUP_DIR, file);
                    const stats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    return {
                        timestamp: data.metadata?.timestamp || stats.mtime.toISOString(),
                        size: stats.size,
                        clientsCount: data.clients?.length || 0,
                        appointmentsCount: data.appointments?.length || 0,
                        notesCount: data.sessionNotes?.length || 0,
                        recordingsCount: data.recordings?.length || 0,
                    };
                })
        );

        // Sort by timestamp descending
        backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({ backups });
    } catch (error) {
        console.error('Error listing backups:', error);
        return NextResponse.json({ backups: [] });
    }
}

export async function POST() {
    try {
        await ensureBackupDir();

        // Read all data files
        const dataDir = path.join(process.cwd(), 'data');

        const [clients, appointments, sessionNotes, recordings] = await Promise.all([
            fs.readFile(path.join(dataDir, 'clients.json'), 'utf-8').catch(() => '[]'),
            fs.readFile(path.join(dataDir, 'appointments.json'), 'utf-8').catch(() => '[]'),
            fs.readFile(path.join(dataDir, 'session-notes.json'), 'utf-8').catch(() => '[]'),
            fs.readFile(path.join(dataDir, 'recordings.json'), 'utf-8').catch(() => '[]'),
        ]);

        const backup = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                appName: 'My Practice Helper',
            },
            clients: JSON.parse(clients),
            appointments: JSON.parse(appointments),
            sessionNotes: JSON.parse(sessionNotes),
            recordings: JSON.parse(recordings),
        };

        // Save backup to file
        const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filePath = path.join(BACKUP_DIR, filename);
        await fs.writeFile(filePath, JSON.stringify(backup, null, 2));

        return NextResponse.json({
            success: true,
            backup,
            message: 'Backup created successfully'
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        return NextResponse.json(
            { error: 'Failed to create backup' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const timestamp = searchParams.get('timestamp');

        if (!timestamp) {
            return NextResponse.json(
                { error: 'Timestamp required' },
                { status: 400 }
            );
        }

        await ensureBackupDir();

        // Find and delete the backup file with matching timestamp
        const files = await fs.readdir(BACKUP_DIR);

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(BACKUP_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);

                if (data.metadata?.timestamp === timestamp) {
                    await fs.unlink(filePath);
                    return NextResponse.json({ success: true });
                }
            }
        }

        return NextResponse.json(
            { error: 'Backup not found' },
            { status: 404 }
        );
    } catch (error) {
        console.error('Error deleting backup:', error);
        return NextResponse.json(
            { error: 'Failed to delete backup' },
            { status: 500 }
        );
    }
}
