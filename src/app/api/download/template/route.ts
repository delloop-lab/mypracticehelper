import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        const TEMPLATE_HEADERS = ['Name', 'Email', 'Phone', 'Session Fee', 'Currency', 'Notes'];
        const TEMPLATE_ROWS = [
            ['John Doe', 'john@example.com', '555-0123', 80, 'EUR', 'Example client notes'],
            ['Jane Smith', 'jane@example.com', '555-0124', 100, 'USD', 'Another example']
        ];

        const data = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        // Convert buffer to Uint8Array for Next.js response
        const excelBuffer = new Uint8Array(buf);

        return new NextResponse(excelBuffer, {
            headers: {
                'Content-Disposition': 'attachment; filename="client_import_template.xlsx"',
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Length': excelBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('Template download failed:', error);
        return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
    }
}
