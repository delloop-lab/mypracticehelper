import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone', 'DOB', 'AKA'];
        const TEMPLATE_ROWS = [
            ['John', 'Doe', 'john@example.com', '+61 412 900 002', '1985-05-15', 'Johnny'],
            ['Jane', 'Smith', 'jane@example.com', '+61 412 900 003', '1990-08-22', 'Jane']
        ];

        const data = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
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
