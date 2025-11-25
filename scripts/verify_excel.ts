
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_HEADERS = ['Name', 'Email', 'Phone', 'Session Fee', 'Currency', 'Notes'];
const TEMPLATE_ROWS = [
    ['John Doe', 'john@example.com', '555-0123', 80, 'EUR', 'Example client notes'],
    ['Jane Smith', 'jane@example.com', '555-0124', 100, 'USD', 'Another example']
];

function verifyExcelGeneration() {
    console.log("1. Preparing data...");
    const data = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];

    console.log("2. Creating workbook...");
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    console.log("3. Generating buffer (xlsx)...");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const outputPath = path.join(process.cwd(), 'verify_template.xlsx');
    console.log(`4. Saving to file: ${outputPath}`);
    fs.writeFileSync(outputPath, wbout);

    console.log("5. Reading file back to verify content...");
    const readWb = XLSX.readFile(outputPath);
    const readWs = readWb.Sheets[readWb.SheetNames[0]];
    const readData = XLSX.utils.sheet_to_json(readWs, { header: 1 });

    console.log("\n--- VERIFICATION RESULT ---");
    console.log("Sheet Names:", readWb.SheetNames);
    console.log("Data Rows:", readData.length);
    console.log("Content:");
    console.log(JSON.stringify(readData, null, 2));

    if (JSON.stringify(readData) === JSON.stringify(data)) {
        console.log("\nSUCCESS: Generated file content matches expected data exactly.");
    } else {
        console.error("\nFAILURE: Content mismatch!");
    }
}

verifyExcelGeneration();
