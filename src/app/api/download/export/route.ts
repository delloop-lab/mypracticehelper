import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getClients } from '@/lib/storage';
import { checkAuthentication } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        console.log('[Export API] Starting export request');
        // Authenticate user
        const authResult = await checkAuthentication(request);
        console.log('[Export API] Auth result:', { userId: authResult.userId, isFallback: authResult.isFallback });
        
        // Handle fallback authentication for legacy users
        if (authResult.isFallback && authResult.userEmail === 'claire@claireschillaci.com') {
            console.log('[Export API] Fallback auth detected, using legacy data');
            const clients = await getClients(false, null);
            const data = clients.map((client: any) => {
                // Extract first and last name from client data
                let firstName = client.firstName || '';
                let lastName = client.lastName || '';
                
                // If firstName/lastName not in metadata, try to parse from name
                if (!firstName && !lastName && client.name) {
                    const nameParts = client.name.trim().split(/\s+/);
                    firstName = nameParts[0] || '';
                    lastName = nameParts.slice(1).join(' ') || '';
                }
                
                return {
                    'First Name': firstName || '',
                    'Last Name': lastName || '',
                    Email: client.email || '',
                    Phone: client.phone || '',
                    DOB: client.dateOfBirth || '',
                    AKA: client.preferredName || ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 15 }
            ];
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Clients");

            const date = new Date().toISOString().split('T')[0];
            const filename = `clients_export_${date}.xlsx`;

            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            const excelBuffer = new Uint8Array(buf);

            return new NextResponse(excelBuffer, {
                headers: {
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Length': excelBuffer.length.toString(),
                },
            });
        }
        
        if (!authResult.userId) {
            console.log('[Export API] No userId, returning 401');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = authResult.userId;
        console.log('[Export API] Fetching clients for userId:', userId);
        const clients = await getClients(false, userId);
        console.log('[Export API] Found clients:', clients.length);

        const data = clients.map((client: any) => {
            // Extract first and last name from client data
            let firstName = client.firstName || '';
            let lastName = client.lastName || '';
            
            // If firstName/lastName not in metadata, try to parse from name
            if (!firstName && !lastName && client.name) {
                const nameParts = client.name.trim().split(/\s+/);
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            }
            
            return {
                'First Name': firstName || '',
                'Last Name': lastName || '',
                Email: client.email || '',
                Phone: client.phone || '',
                DOB: client.dateOfBirth || '',
                AKA: client.preferredName || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        
        // Set column widths for better readability
        ws['!cols'] = [
            { wch: 15 }, // First Name
            { wch: 15 }, // Last Name
            { wch: 30 }, // Email
            { wch: 18 }, // Phone
            { wch: 12 }, // DOB
            { wch: 15 }  // AKA
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clients");

        const date = new Date().toISOString().split('T')[0];
        const filename = `clients_export_${date}.xlsx`;

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        // Convert buffer to Uint8Array for Next.js response
        const excelBuffer = new Uint8Array(buf);

        return new NextResponse(excelBuffer, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Length': excelBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('[Export API] Export download failed:', error);
        console.error('[Export API] Error details:', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
    }
}
