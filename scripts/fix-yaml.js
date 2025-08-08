#!/usr/bin/env node

/**
 * Fix YAML frontmatter issues in existing product files
 */

const fs = require('fs');
const path = require('path');

// Helper function to safely escape YAML strings
const escapeYaml = (str) => {
  if (!str) return '';
  // Replace problematic characters and use proper YAML escaping
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/"/g, '\\"')    // Escape quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '')      // Remove carriage returns
    .replace(/\t/g, ' ')     // Replace tabs with spaces
    .trim();
};

async function fixProductFiles() {
  const productsDir = path.join(__dirname, '../site/content/products');
  
  console.log('🔧 Fixing YAML frontmatter in product files...');
  
  try {
    const productDirs = fs.readdirSync(productsDir);
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const productDir of productDirs) {
      const productPath = path.join(productsDir, productDir);
      
      if (fs.statSync(productPath).isDirectory()) {
        const indexFile = path.join(productPath, 'index.md');
        
        if (fs.existsSync(indexFile)) {
          try {
            const content = fs.readFileSync(indexFile, 'utf8');
            
            // Check if content has frontmatter
            if (!content.startsWith('---')) {
              console.log(`⚠️  Skipping ${productDir}: No frontmatter found`);
              continue;
            }
            
            // Split frontmatter and content
            const parts = content.split('---');
            if (parts.length < 3) {
              console.log(`⚠️  Skipping ${productDir}: Invalid frontmatter structure`);
              continue;
            }
            
            const frontmatter = parts[1];
            const bodyContent = parts.slice(2).join('---');
            
            // Parse and fix frontmatter
            let needsFix = false;
            let fixedFrontmatter = frontmatter;
            
            // Fix description field specifically
            const descriptionMatch = frontmatter.match(/description:\s*"([^"]*(?:\\.[^"]*)*)"?/s);
            if (descriptionMatch) {
              const originalDesc = descriptionMatch[1];
              const fixedDesc = escapeYaml(originalDesc);
              
              if (originalDesc !== fixedDesc) {
                fixedFrontmatter = frontmatter.replace(
                  /description:\s*"([^"]*(?:\\.[^"]*)*)"?/s,
                  `description: "${fixedDesc}"`
                );
                needsFix = true;
              }
            }
            
            // Check for unescaped quotes in other fields
            const lines = fixedFrontmatter.split('\n');
            const fixedLines = lines.map(line => {
              // Skip lines that don't contain field definitions
              if (!line.includes(':') || line.trim().startsWith('-')) {
                return line;
              }
              
              // Fix alt text fields
              if (line.includes('alt:')) {
                const match = line.match(/alt:\s*"([^"]*)"?/);
                if (match) {
                  const fixedAlt = escapeYaml(match[1]);
                  if (match[1] !== fixedAlt) {
                    needsFix = true;
                    return line.replace(/alt:\s*"([^"]*)"?/, `alt: "${fixedAlt}"`);
                  }
                }
              }
              
              return line;
            });
            
            if (needsFix) {
              const newContent = `---${fixedLines.join('\n')}---${bodyContent}`;
              fs.writeFileSync(indexFile, newContent, 'utf8');
              console.log(`✅ Fixed ${productDir}`);
              fixedCount++;
            }
            
          } catch (error) {
            console.error(`❌ Error processing ${productDir}:`, error.message);
            errorCount++;
          }
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixedCount} files`);
    console.log(`   Errors: ${errorCount} files`);
    console.log(`   Total processed: ${productDirs.length} directories`);
    
  } catch (error) {
    console.error('❌ Error accessing products directory:', error.message);
  }
}

if (require.main === module) {
  fixProductFiles();
}

module.exports = { fixProductFiles, escapeYaml };
