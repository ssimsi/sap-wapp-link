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

// Directory containing the PDF files (source)
const originalsDir = './downloaded-pdfs/ORIGINALS';
// Directory where renamed files will be moved (destination)
const downloadedDir = './downloaded-pdfs';

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
        const files = fs.readdirSync(originalsDir);
        
        // Find files that should be deleted from ORIGINALS after processing:
        // 1. Files that don't start with "Factura de deudores" or "Entrega" 
        // 2. Successfully processed timestamp-named files
        const filesToDelete = files.filter(file => {
            if (!file.endsWith('.pdf')) return false;
            
            // Keep files that haven't been processed yet
            if (file.startsWith('Factura de deudores_') || file.startsWith('Entrega_')) {
                return true; // These will be deleted after successful processing
            }
            
            // Delete non-invoice/delivery files
            return true;
        });
        
        console.log(`Found ${filesToDelete.length} files to clean up from ORIGINALS\n`);
        
        const deleted = [];
        const errors = [];
        
        // Only delete files that were successfully processed
        for (const filename of filesToDelete) {
            const filePath = path.join(originalsDir, filename);
            
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted from ORIGINALS: ${filename}`);
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
        const files = fs.readdirSync(originalsDir);
        
        // Step 1: Find document PDFs to process from ORIGINALS folder
        const documentPDFs = files.filter(file => 
            (
                file.startsWith('Factura de deudores_') || 
                file.startsWith('Factura de deudores - ') ||  // Support hyphen format
                file.startsWith('Entrega_') ||
                file.startsWith('Entrega - ')  // Support hyphen format
            ) && file.endsWith('.pdf')
        );
        
        console.log(`Found ${documentPDFs.length} document PDFs to process from ORIGINALS folder\n`);
        
        const results = [];
        const processedFiles = new Set(); // Track files we've processed
        
        for (let i = 0; i < documentPDFs.length; i++) {
            const filename = documentPDFs[i];
            const sourceFilePath = path.join(originalsDir, filename);
            
            console.log(`Processing ${i + 1}/${documentPDFs.length}: ${filename}`);
            
            const correctDocumentNumber = await extractDocumentNumberFromPDF(sourceFilePath);
            
            if (correctDocumentNumber) {
                // Determine the correct prefix based on file type
                let expectedFilename;
                if (filename.startsWith('Factura de deudores')) {
                    expectedFilename = `Factura_de_deudores_${correctDocumentNumber}.pdf`;
                } else if (filename.startsWith('Entrega')) {
                    expectedFilename = `Entrega_${correctDocumentNumber}.pdf`;
                } else {
                    console.log(`⚠️  Unknown document type: ${filename}`);
                    continue;
                }
                
                // Target path in downloaded-pdfs folder
                const targetPath = path.join(downloadedDir, expectedFilename);
                
                // Check if target filename already exists in downloaded-pdfs
                if (fs.existsSync(targetPath)) {
                    console.log(`⚠️  Target file already exists in downloaded-pdfs: ${expectedFilename}`);
                    // Still mark original for deletion since it's processed
                    processedFiles.add(filename);
                    results.push({
                        originalFile: filename,
                        newFile: expectedFilename,
                        documentNumber: correctDocumentNumber,
                        renamed: false,
                        status: 'target_exists'
                    });
                } else {
                    // Copy file to downloaded-pdfs with correct name
                    fs.copyFileSync(sourceFilePath, targetPath);
                    console.log(`✓ Copied and renamed: ${filename} → ${expectedFilename}`);
                    
                    // Mark original file for deletion
                    processedFiles.add(filename);
                    
                    results.push({
                        originalFile: filename,
                        newFile: expectedFilename,
                        documentNumber: correctDocumentNumber,
                        renamed: true,
                        status: 'copied_and_renamed'
                    });
                }
            } else {
                console.log(`✗ Could not extract correct document number - file skipped`);
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
        
        // Step 2: Clean up ORIGINALS folder - delete processed files and any non-invoice/delivery files
        console.log('\n=== CLEANUP PHASE ===');
        console.log(`Deleting ${processedFiles.size} successfully processed files from ORIGINALS...`);
        
        const deleted = [];
        const errors = [];
        
        // Delete successfully processed files
        for (const filename of processedFiles) {
            const filePath = path.join(originalsDir, filename);
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Deleted processed file: ${filename}`);
                deleted.push(filename);
            } catch (error) {
                console.log(`❌ Error deleting ${filename}: ${error.message}`);
                errors.push({ filename, error: error.message });
            }
        }
        
        // Delete any remaining non-invoice/delivery files
        console.log('\n🧹 Cleaning up remaining non-invoice/delivery files from ORIGINALS...');
        try {
            const remainingFiles = fs.readdirSync(originalsDir);
            const filesToDelete = remainingFiles.filter(file => {
                if (!file.endsWith('.pdf')) return false;
                
                // Keep only Factura de deudores and Entrega files (if any remain)
                if (file.startsWith('Factura de deudores') || file.startsWith('Entrega_')) {
                    return false;
                }
                
                // Delete everything else
                return true;
            });
            
            console.log(`Found ${filesToDelete.length} non-invoice/delivery files to delete`);
            
            for (const filename of filesToDelete) {
                const filePath = path.join(originalsDir, filename);
                try {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️  Deleted non-invoice file: ${filename}`);
                    deleted.push(filename);
                } catch (error) {
                    console.log(`❌ Error deleting ${filename}: ${error.message}`);
                    errors.push({ filename, error: error.message });
                }
            }
            
        } catch (error) {
            console.log(`❌ Error reading ORIGINALS folder for cleanup: ${error.message}`);
            errors.push({ filename: 'ORIGINALS_SCAN', error: error.message });
        }
        
        const cleanupResults = { deleted, errors };
        
        // Save results to JSON for review
        const finalResults = {
            renaming: results,
            cleanup: cleanupResults,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync('./document-processing-results.json', JSON.stringify(finalResults, null, 2));
        
        console.log('\n=== FINAL SUMMARY ===');
        const copiedAndRenamed = results.filter(r => r.status === 'copied_and_renamed');
        const targetExists = results.filter(r => r.status === 'target_exists');
        const failed = results.filter(r => r.status === 'failed');
        
        console.log(`Successfully copied and renamed: ${copiedAndRenamed.length}`);
        console.log(`Target exists (skipped): ${targetExists.length}`);
        console.log(`Failed to process: ${failed.length}`);
        console.log(`Total files deleted from ORIGINALS: ${cleanupResults.deleted.length}`);
        console.log(`  - Processed invoice/delivery files: ${processedFiles.size}`);
        console.log(`  - Non-invoice/delivery files: ${cleanupResults.deleted.length - processedFiles.size}`);
        console.log(`Cleanup errors: ${cleanupResults.errors.length}`);
        
        if (copiedAndRenamed.length > 0) {
            console.log('\nFiles copied to downloaded-pdfs with CORRECT document numbers:');
            copiedAndRenamed.forEach(r => {
                console.log(`${r.originalFile} → ${r.newFile} (Document: ${r.documentNumber})`);
            });
        }
        
        console.log(`\nWorkflow: ORIGINALS → rename & copy → downloaded-pdfs → delete from ORIGINALS`);
        console.log(`Results saved to: document-processing-results.json`);
        
    } catch (error) {
        console.error('Error processing document PDFs:', error);
    }
}

// Run the script
renameDocumentPDFs();