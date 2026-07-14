const fs = require('fs');
const pngToIco = require('png-to-ico'); // This is the module object
const path = require('path');

const inputPath = path.join(__dirname, 'assets', 'icon.png');
const outputPath = path.join(__dirname, 'assets', 'icon.ico');

console.log(`Converting ${inputPath} to ${outputPath}...`);

if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
}

// Access the default export
const convert = pngToIco.default || pngToIco;

convert(inputPath)
    .then(buf => {
        fs.writeFileSync(outputPath, buf);
        console.log(`Successfully created icon.ico (${buf.length} bytes)`);
    })
    .catch(err => {
        console.error('Error converting icon:', err);
        process.exit(1);
    });
