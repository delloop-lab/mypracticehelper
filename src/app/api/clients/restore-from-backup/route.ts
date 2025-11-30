import { NextResponse } from 'next/server';
import { saveClients } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

export async function POST() {
    try {
        // Read the local clients.json backup file
        const clientsFile = path.join(process.cwd(), 'data', 'clients.json');
        
        if (!fs.existsSync(clientsFile)) {
            return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
        }
        
        const clientsData = fs.readFileSync(clientsFile, 'utf8');
        const clients = JSON.parse(clientsData);
        
        // Find Claire and Lilli
        const lilli = clients.find((c: any) => 
            c.name && (c.name.toLowerCase().includes('lilli') || c.name.toLowerCase().includes('lilly'))
        );
        const claire = clients.find((c: any) => 
            c.name && c.name.toLowerCase().includes('claire')
        );
        
        const clientsToRestore = [lilli, claire].filter(Boolean);
        
        if (clientsToRestore.length === 0) {
            return NextResponse.json({ 
                error: 'Claire and Lilli not found in backup',
                availableClients: clients.map((c: any) => c.name)
            }, { status: 404 });
        }
        
        // Restore the clients
        await saveClients(clientsToRestore);
        
        return NextResponse.json({ 
            success: true, 
            restored: clientsToRestore.map((c: any) => c.name),
            message: `Restored ${clientsToRestore.length} client(s) from backup`
        });
        
    } catch (error: any) {
        console.error('Error restoring clients from backup:', error);
        return NextResponse.json({ 
            error: `Failed to restore: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}







