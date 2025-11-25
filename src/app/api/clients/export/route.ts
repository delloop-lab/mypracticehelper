import { NextResponse } from 'next/server';
import { getClients } from '@/lib/storage';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    try {
        let wb;
        let filename;

        if (type === 'template') {
            const templateData = [
                {
                    name: "John Doe",
                    email: "john@example.com",
                    phone: "+1234567890",
                    sessionFee: 80,
                    currency: "EUR",
                    notes: "Prefers morning sessions"
                },
                {
                    name: "Jane Smith",
                    email: "jane@example.com",
                    phone: "+0987654321",
                    sessionFee: 100,
                    currency: "EUR",
                    notes: "Couples therapy client"
                }
            ];

            const ws = XLSX.utils.json_to_sheet(templateData);
            ws['!cols'] = [
                { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 30 }
            ];

            wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Clients");
            filename = 'client_import_template.xlsx';

        } else if (type === 'export') {
            const clients = await getClients();
            const exportData = clients.map((client: any) => ({
                name: client.name,
                email: client.email || '',
                phone: client.phone || '',
                sessionFee: client.sessionFee || 80,
                currency: client.currency || 'EUR',
                notes: client.notes || ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            ws['!cols'] = [
                { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 30 }
            ];

            wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Clients");

            const date = new Date().toISOString().split('T')[0];
            filename = `clients_export_${date}.xlsx`;

        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        });

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
