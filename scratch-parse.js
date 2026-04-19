const fs = require('fs');
const html = fs.readFileSync('e:/Aplicativos e Sistemas/Automação Telegram/data/mercadolivre-linkbuilder-no-result.html', 'utf8');

// Find all inputs and their values
const inputs = [...html.matchAll(/<input[^>]*>/gi)];
console.log("INPUTS FOUND:", inputs.length);
inputs.forEach(m => console.log(m[0]));

// Find all textareas
const textareas = [...html.matchAll(/<textarea[^>]*>.*?<\/textarea>/gi)];
console.log("\nTEXTAREAS FOUND:", textareas.length);
textareas.forEach(m => console.log(m[0]));

// Look for error messages or hints about why it failed
const errors = [...html.matchAll(/class="[^"]*error[^"]*"[^>]*>(.*?)<\//gi)];
console.log("\nPOSSIBLE ERRORS:");
errors.forEach(m => console.log(m[1]));
