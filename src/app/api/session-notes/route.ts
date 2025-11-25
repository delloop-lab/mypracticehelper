import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const NOTES_FILE = path.join(process.cwd(), 'data', 'session-notes.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

export async function GET() {
    try {
        ensureDataDir();

        if (!fs.existsSync(NOTES_FILE)) {
            return NextResponse.json([]);
        }

        const data = fs.readFileSync(NOTES_FILE, 'utf-8');
        const notes = JSON.parse(data);
        return NextResponse.json(notes);
    } catch (error) {
        console.error('Error fetching session notes:', error);
        return NextResponse.json({ error: 'Failed to fetch session notes' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        ensureDataDir();

        const notes = await request.json();
        fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving session notes:', error);
        return NextResponse.json({ error: 'Failed to save session notes' }, { status: 500 });
    }
}
