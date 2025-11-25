const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

try {
    console.log('Starting XLSX generation test...');

    const TEMPLATE_HEADERS = ['Name', 'Email', 'Phone', 'Session Fee', 'Currency', 'Notes'];
    const TEMPLATE_ROWS = [
        ['John Doe', 'john@example.com', '555-0123', 80, 'EUR', 'Example client notes'],
        ['Jane Smith', 'jane@example.com', '555-0124', 100, 'USD', 'Another example']
    ];

    const data = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    console.log('Workbook created. Writing to buffer...');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    console.log(`Buffer created. Size: ${buf.length} bytes`);

    const outputPath = path.join(__dirname, 'test_output.xlsx');
    fs.writeFileSync(outputPath, buf);

    console.log(`Successfully wrote file to ${outputPath}`);

} catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
}
