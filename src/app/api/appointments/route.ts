import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'appointments.json');

function getAppointments() {
    if (!fs.existsSync(DATA_FILE_PATH)) {
        return [];
    }
    const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    try {
        return JSON.parse(fileContent);
    } catch (e) {
        return [];
    }
}

function saveAppointments(appointments: any[]) {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(appointments, null, 2));
}

export async function GET() {
    const appointments = getAppointments();
    return NextResponse.json(appointments);
}

export async function POST(request: Request) {
    try {
        const appointments = await request.json();
        saveAppointments(appointments);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save appointments' }, { status: 500 });
    }
}
