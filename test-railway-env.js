#!/usr/bin/env node

// Simple environment variable test for Railway
console.log('🔍 Railway Environment Variable Test');
console.log('=====================================');

console.log('\n📊 Environment Summary:');
console.log(`Total variables: ${Object.keys(process.env).length}`);

console.log('\n🔑 SAP Variables:');
const sapVars = Object.keys(process.env).filter(key => key.includes('SAP'));
console.log('SAP-related vars:', sapVars);

console.log('\n📝 VITE Variables:');
const viteVars = Object.keys(process.env).filter(key => key.includes('VITE'));
console.log('VITE-related vars:', viteVars);

console.log('\n📱 Custom Variables:');
const customVars = Object.keys(process.env).filter(key => 
  key.startsWith('ADMIN') || 
  key.startsWith('EMAIL') || 
  key.startsWith('WHATSAPP') || 
  key.startsWith('SESSION') || 
  key.startsWith('TEST')
);
console.log('Custom vars:', customVars);

console.log('\n🚂 Railway Variables:');
const railwayVars = Object.keys(process.env).filter(key => key.startsWith('RAILWAY'));
console.log('Railway vars:', railwayVars);

console.log('\n🔍 Specific Variable Values:');
console.log(`VITE_SAP_DATABASE: "${process.env.VITE_SAP_DATABASE}" (length: ${process.env.VITE_SAP_DATABASE?.length || 0})`);
console.log(`VITE_SAP_USERNAME: "${process.env.VITE_SAP_USERNAME}" (length: ${process.env.VITE_SAP_USERNAME?.length || 0})`);
console.log(`VITE_SAP_PASSWORD: ${process.env.VITE_SAP_PASSWORD ? `"${process.env.VITE_SAP_PASSWORD}" (length: ${process.env.VITE_SAP_PASSWORD.length})` : 'NOT SET'}`);
console.log(`WHATSAPP_PHONE_NUMBER: ${process.env.WHATSAPP_PHONE_NUMBER || 'NOT SET'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);

console.log('\n✅ Environment test complete');
