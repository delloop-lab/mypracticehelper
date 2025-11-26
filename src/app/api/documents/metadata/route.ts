import { NextResponse } from 'next/server';
import { getDocumentFileSize, formatFileSize } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const { filenames } = await request.json();
        
        if (!Array.isArray(filenames)) {
            return NextResponse.json({ error: 'filenames must be an array' }, { status: 400 });
        }

        const sizes: Record<string, string> = {};
        
        // Fetch sizes for all files in parallel
        await Promise.all(
            filenames.map(async (filename: string) => {
                if (!filename) return;
                // Extract filename from URL if it's a full URL
                let path = filename;
                if (filename.includes('/')) {
                    const urlParts = filename.split('/');
                    path = urlParts[urlParts.length - 1];
                }
                
                const sizeBytes = await getDocumentFileSize(path);
                sizes[filename] = formatFileSize(sizeBytes);
            })
        );

        return NextResponse.json({ sizes });
    } catch (error) {
        console.error('Error getting document metadata:', error);
        return NextResponse.json({ error: 'Failed to get document metadata' }, { status: 500 });
    }
}



