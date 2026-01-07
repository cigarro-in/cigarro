/**
 * Script to remove all console.log statements from the codebase
 * Run with: npx tsx scripts/remove-console-logs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const srcDir = path.join(__dirname, '..', 'src');

function removeConsoleLogs(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf8');

    // Remove console.log statements (handles multiline and various formats)
    // Pattern: console.log(anything); - optional semicolon and newline
    const newContent = content
        .replace(/^\s*console\.log\([^)]*\);?\s*$/gm, '')  // Whole line console.log
        .replace(/console\.log\([^)]*\);?\s*/g, '')        // Inline console.log
        .replace(/\n{3,}/g, '\n\n');                       // Remove extra blank lines

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Cleaned: ${filePath}`);
        return true;
    }
    return false;
}

function walkDir(dir: string, callback: (filePath: string) => void) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory() && !file.includes('node_modules')) {
            walkDir(filePath, callback);
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
            callback(filePath);
        }
    }
}

let cleanedCount = 0;
walkDir(srcDir, (filePath) => {
    if (removeConsoleLogs(filePath)) {
        cleanedCount++;
    }
});

console.log(`\nCleaned ${cleanedCount} files`);
