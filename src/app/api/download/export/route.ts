import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getClients } from '@/lib/storage';

export async function GET() {
    try {
        const clients = await getClients();

        const data = clients.map((client: any) => ({
            Name: client.name,
            Email: client.email,
            Phone: client.phone,
            'Session Fee': client.sessionFee,
            Currency: client.currency,
            Notes: client.notes,
            'Total Sessions': client.sessions
        }));

        const ws = XLSX.utils.json_to_sheet(data);
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
        console.error('Export download failed:', error);
        return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
    }
}
