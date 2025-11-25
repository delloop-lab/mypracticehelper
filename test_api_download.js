const http = require('http');
const fs = require('fs');
const path = require('path');

const url = 'http://localhost:3001/api/download/template';
const outputPath = path.join(__dirname, 'downloaded_template.xlsx');

console.log(`Fetching ${url}...`);

http.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Headers:', res.headers);

    if (res.statusCode !== 200) {
        console.error('Request failed.');
        res.resume();
        return;
    }

    const file = fs.createWriteStream(outputPath);
    res.pipe(file);

    file.on('finish', () => {
        file.close();
        console.log(`File downloaded to ${outputPath}`);
        const stats = fs.statSync(outputPath);
        console.log(`File size: ${stats.size} bytes`);
        if (stats.size > 0) {
            console.log('SUCCESS: File created and has content.');
        } else {
            console.error('FAILURE: File is empty.');
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
