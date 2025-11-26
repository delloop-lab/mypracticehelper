import { NextResponse } from 'next/server';
import { getClients, saveClients } from '@/lib/storage';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const archived = searchParams.get('archived') === 'true';
        const clients = await getClients(archived);
        return NextResponse.json(clients);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const clients = await request.json();
        await saveClients(clients);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save clients' }, { status: 500 });
    }
}
