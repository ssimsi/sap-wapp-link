/**
 * PDF Document Renamer and Cleaner
 * 
 * This script:
 * 1. Extracts the correct document numbers from PDFs and renames them accordingly
 * 2. Deletes the original timestamp-named files after renaming
 * 3. Deletes any other files that don't start with "Factura_de_deudores" or "Entrega"
 * 
 * Supports:
 * - "Factura de deudores" (invoices) 
 * - "Entrega" (deliveries)
 * 
 * It filters out emission points (00060, 99999) and uses only the actual document number part.
 * 
 * Usage: node rename-invoice-pdfs.cjs
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// Directory containing the PDF files
const fcDir = './FC';

async function extractDocumentNumberFromPDF(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const text = data.text;
        
        // Look for the actual document number, filtering out emission points
        // Pattern: N°: 00060-00014845 -> we want just 00014845 (after the hyphen)
        const patterns = [
            // Look for emission point followed by document number, capture only the document number
            /\b\d{5}-(\d{8})\b/,     // Matches 00060-00014845, captures 00014845
            /\b\d{4}-(\d{8})\b/,     // Alternative format like 0060-12345678
            /\b\d{5}-(\d{7})\b/,     // Shorter document numbers
            // More specific patterns around N°
            /N°[:\s]*\d{4,5}-(\d{7,8})/,
            // Fallback - any emission point pattern
            /(?:00060|99999|00999)-(\d{7,8})/,
        ];
        
        console.log(`\n--- Processing: ${path.basename(pdfPath)} ---`);
        
        for (let pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                console.log(`Found document number: ${match[1]} (from full: ${match[0]})`);
                return match[1];
            }
        }
        
        console.log('No document number found with standard patterns');
        return null;
    } catch (error) {
        console.error(`Error processing PDF ${pdfPath}:`, error.message);
        return null;
    }
}

async function cleanupUnwantedFiles() {
    try {
        const files = fs.readdirSync(fcDir);
        
        // Find files that should be deleted:
        // 1. Files that don't start with "Factura_de_deudores_" or "Entrega_" 
        // 2. Old timestamp-named files
        const filesToDelete = files.filter(file => {
            if (!file.endsWith('.pdf')) return false;
            
            // Keep correctly named files
            if (file.startsWith('Factura_de_deudores_') || file.startsWith('Entrega_')) {
                return false;
            }
            
            // Delete everything else
            return true;
        });
        
        console.log(`Found ${filesToDelete.length} files to delete\n`);
        
        const deleted = [];
        const errors = [];
        
        for (const filename of filesToDelete) {
            const filePath = path.join(fcDir, filename);
            
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted: ${filename}`);
                deleted.push(filename);
            } catch (error) {
                console.log(`❌ Error deleting ${filename}: ${error.message}`);
                errors.push({ filename, error: error.message });
            }
        }
        
        return { deleted, errors };
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        return { deleted: [], errors: [{ filename: 'N/A', error: error.message }] };
    }
}

async function renameDocumentPDFs() {
    try {
        const files = fs.readdirSync(fcDir);
        
        // Step 1: Find document PDFs to process (both original and already renamed)
        const documentPDFs = files.filter(file => 
            (
                file.startsWith('Factura de deudores_') || 
                file.startsWith('Factura_de_deudores_') ||
                file.startsWith('Entrega_') ||
                file.startsWith('Entrega_de_')
            ) && file.endsWith('.pdf')
        );
        
        console.log(`Found ${documentPDFs.length} document PDFs to process (invoices and deliveries)\n`);
        
        const results = [];
        const processedFiles = new Set(); // Track files we've processed
        
        for (let i = 0; i < documentPDFs.length; i++) {
            const filename = documentPDFs[i];
            const filePath = path.join(fcDir, filename);
            
            console.log(`Processing ${i + 1}/${documentPDFs.length}: ${filename}`);
            
            const correctDocumentNumber = await extractDocumentNumberFromPDF(filePath);
            
            if (correctDocumentNumber) {
                // Determine the correct prefix based on file type
                let expectedFilename;
                if (filename.startsWith('Factura')) {
                    expectedFilename = `Factura_de_deudores_${correctDocumentNumber}.pdf`;
                } else if (filename.startsWith('Entrega')) {
                    expectedFilename = `Entrega_${correctDocumentNumber}.pdf`;
                } else {
                    console.log(`⚠️  Unknown document type: ${filename}`);
                    continue;
                }
                
                if (filename === expectedFilename) {
                    console.log(`✓ Already correctly named: ${filename}`);
                    results.push({
                        originalFile: filename,
                        newFile: filename,
                        documentNumber: correctDocumentNumber,
                        renamed: false,
                        status: 'already_correct'
                    });
                } else {
                    const newPath = path.join(fcDir, expectedFilename);
                    
                    // Check if target filename already exists
                    if (fs.existsSync(newPath)) {
                        console.log(`⚠️  Target file already exists: ${expectedFilename}`);
                        // Still mark original for deletion if it's a timestamp file
                        if (filename.match(/_(20\d{6}_\d{6})\.pdf$/)) {
                            processedFiles.add(filename); // Mark for deletion
                        }
                        results.push({
                            originalFile: filename,
                            newFile: expectedFilename,
                            documentNumber: correctDocumentNumber,
                            renamed: false,
                            status: 'target_exists'
                        });
                    } else {
                        // Rename the file
                        fs.renameSync(filePath, newPath);
                        console.log(`✓ Renamed: ${filename} → ${expectedFilename}`);
                        
                        // Mark original file for deletion if it was a timestamp file
                        if (filename.match(/_(20\d{6}_\d{6})\.pdf$/)) {
                            processedFiles.add(filename);
                        }
                        
                        results.push({
                            originalFile: filename,
                            newFile: expectedFilename,
                            documentNumber: correctDocumentNumber,
                            renamed: true,
                            status: 'renamed'
                        });
                    }
                }
            } else {
                console.log(`✗ Could not extract correct document number - file unchanged`);
                results.push({
                    originalFile: filename,
                    newFile: filename,
                    documentNumber: null,
                    renamed: false,
                    status: 'failed'
                });
            }
            
            console.log('-'.repeat(50));
        }
        
        // Step 2: Clean up unwanted files
        console.log('\n=== CLEANUP PHASE ===');
        const cleanupResults = await cleanupUnwantedFiles();
        
        // Save results to JSON for review
        const finalResults = {
            renaming: results,
            cleanup: cleanupResults,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync('./document-processing-results.json', JSON.stringify(finalResults, null, 2));
        
        console.log('\n=== FINAL SUMMARY ===');
        const renamed = results.filter(r => r.status === 'renamed');
        const alreadyCorrect = results.filter(r => r.status === 'already_correct');
        const targetExists = results.filter(r => r.status === 'target_exists');
        const failed = results.filter(r => r.status === 'failed');
        
        console.log(`Successfully renamed: ${renamed.length}`);
        console.log(`Already correct: ${alreadyCorrect.length}`);
        console.log(`Target exists (skipped): ${targetExists.length}`);
        console.log(`Failed to process: ${failed.length}`);
        console.log(`Files deleted in cleanup: ${cleanupResults.deleted.length}`);
        console.log(`Cleanup errors: ${cleanupResults.errors.length}`);
        
        if (renamed.length > 0) {
            console.log('\nFiles renamed with CORRECT document numbers:');
            renamed.forEach(r => {
                console.log(`${r.originalFile} → ${r.newFile} (Document: ${r.documentNumber})`);
            });
        }
        
        console.log(`\nResults saved to: document-processing-results.json`);
        
    } catch (error) {
        console.error('Error processing document PDFs:', error);
    }
}

// Run the script
renameDocumentPDFs();