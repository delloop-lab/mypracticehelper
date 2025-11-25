import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

export async function POST() {
    try {
        const projectRoot = process.cwd();

        // Create a zip archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Files and directories to include
        const itemsToBackup = [
            // Data files
            'data',

            // Source code
            'src/app',
            'src/components',
            'src/lib',

            // Public assets (if exists)
            'public',

            // Configuration files
            'package.json',
            'package-lock.json',
            'tsconfig.json',
            'next.config.js',
            'next.config.mjs',
            'next.config.ts',
            'tailwind.config.js',
            'tailwind.config.ts',
            'postcss.config.js',
            'postcss.config.mjs',
            'components.json',
            '.eslintrc.json',
            '.gitignore',

            // Environment template (not actual .env with secrets)
            '.env.example',
            '.env.local.example',
        ];

        // Add files to archive
        for (const item of itemsToBackup) {
            const itemPath = path.join(projectRoot, item);

            try {
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    archive.directory(itemPath, item);
                } else if (stats.isFile()) {
                    archive.file(itemPath, { name: item });
                }
            } catch (error) {
                // Skip if file/directory doesn't exist
                console.log(`Skipping ${item} - not found`);
            }
        }

        // Finalize the archive
        archive.finalize();

        // Convert archive stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of archive) {
            chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);

        // Return as downloadable file
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="SUPER-BACKUP-${new Date().toISOString().split('T')[0]}.zip"`,
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('Error creating SUPER BACKUP:', error);
        return NextResponse.json(
            { error: 'Failed to create SUPER BACKUP' },
            { status: 500 }
        );
    }
}
