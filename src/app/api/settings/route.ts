import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

const DEFAULT_SETTINGS = {
    calendlyUrl: "",
    appointmentTypes: [
        { name: "Initial Consultation", duration: 60, fee: 80, enabled: true },
        { name: "Follow-up Session", duration: 60, fee: 80, enabled: true },
        { name: "Therapy Session", duration: 60, fee: 80, enabled: true },
        { name: "Couples Therapy Session", duration: 60, fee: 100, enabled: true },
        { name: "Family Therapy", duration: 60, fee: 80, enabled: true },
        { name: "Discovery Session", duration: 30, fee: 0, enabled: true },
    ],
    defaultDuration: 60,
    defaultFee: 80,
    currency: "EUR",
};

async function ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

export async function GET() {
    try {
        await ensureDataDirectory();

        try {
            const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
            return NextResponse.json(JSON.parse(data));
        } catch {
            // If file doesn't exist, return defaults
            return NextResponse.json(DEFAULT_SETTINGS);
        }
    } catch (error) {
        console.error('Error reading settings:', error);
        return NextResponse.json(DEFAULT_SETTINGS);
    }
}

export async function POST(request: Request) {
    try {
        await ensureDataDirectory();
        const settings = await request.json();
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}
