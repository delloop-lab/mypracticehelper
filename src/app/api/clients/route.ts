import { NextResponse } from 'next/server';
import { getClients, saveClients } from '@/lib/storage';
import { checkAuthentication } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            const { searchParams } = new URL(request.url);
            const archived = searchParams.get('archived') === 'true';
            const clients = await getClients(archived, null);
            return NextResponse.json(clients);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const archived = searchParams.get('archived') === 'true';
        const clients = await getClients(archived, userId);
        return NextResponse.json(clients);
    } catch (error) {
        console.error('[Clients API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // For fallback auth, we need to create the user first or use a temporary ID
        // For now, reject saves if user doesn't exist (they need to run migration)
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clients = await request.json();
        await saveClients(clients, userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Clients API] Error saving:', error);
        return NextResponse.json({ error: 'Failed to save clients' }, { status: 500 });
    }
}
