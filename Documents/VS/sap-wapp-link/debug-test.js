console.log('Script starting...');

try {
  console.log('About to import...');
  
  import('whatsapp-web.js').then((pkg) => {
    console.log('WhatsApp imported successfully');
    console.log('Types available:', Object.keys(pkg));
  }).catch(err => {
    console.error('Import error:', err);
  });
  
} catch (error) {
  console.error('Error:', error);
}

console.log('Script end reached');
