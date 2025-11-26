import { NextResponse } from 'next/server';
import { saveDocumentFile } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

/**
 * API endpoint to upload all files from local data/documents folder to Supabase Storage
 * This should be run before deploying to production
 * 
 * Usage: POST /api/documents/upload-local
 */
export async function POST() {
    try {
        const documentsDir = path.join(process.cwd(), 'data', 'documents');
        
        // Check if directory exists
        if (!fs.existsSync(documentsDir)) {
            return NextResponse.json({ 
                error: 'data/documents folder not found',
                uploaded: [],
                failed: []
            });
        }

        // Read all files from the directory
        const files = fs.readdirSync(documentsDir);
        const results = {
            uploaded: [] as string[],
            failed: [] as { filename: string; error: string }[]
        };

        // Upload each file to Supabase Storage
        for (const filename of files) {
            try {
                const filePath = path.join(documentsDir, filename);
                const stats = fs.statSync(filePath);
                
                // Skip directories
                if (stats.isDirectory()) {
                    continue;
                }

                // Read file buffer
                const fileBuffer = fs.readFileSync(filePath);
                
                // Upload to Supabase Storage
                await saveDocumentFile(filename, fileBuffer);
                
                results.uploaded.push(filename);
                console.log(`✅ Uploaded: ${filename}`);
            } catch (error: any) {
                console.error(`❌ Failed to upload ${filename}:`, error);
                results.failed.push({
                    filename,
                    error: error?.message || 'Unknown error'
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Uploaded ${results.uploaded.length} files, ${results.failed.length} failed`,
            ...results
        });

    } catch (error: any) {
        console.error('Error uploading local documents:', error);
        return NextResponse.json({ 
            error: `Failed to upload documents: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}


