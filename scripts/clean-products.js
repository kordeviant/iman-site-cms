const fs = require("fs");
const path = require("path");

class CMSProductCleaner {
  constructor() {
    this.siteDir = path.join(__dirname, "../site");
    this.contentDir = path.join(this.siteDir, "content");
    this.staticDir = path.join(this.siteDir, "static");
    this.productsContentDir = path.join(this.contentDir, "products");
    this.productsImageDir = path.join(this.staticDir, "img/products");
  }

  async cleanProducts() {
    console.log("🧹 Starting product cleanup...");
    
    let deletedCount = 0;
    
    try {
      // 1. Remove all product content files
      deletedCount += await this.removeProductContent();
      
      // 2. Remove product images (except profile image)
      deletedCount += await this.removeProductImages();
      
      // 3. Clean up any product references in other files
      await this.cleanProductReferences();
      
      console.log(`✅ Product cleanup completed! Removed ${deletedCount} items.`);
      
    } catch (error) {
      console.error("❌ Error during cleanup:", error.message);
    }
  }

  async removeProductContent() {
    console.log("📁 Removing product content files...");
    let count = 0;
    
    if (fs.existsSync(this.productsContentDir)) {
      const files = this.getAllFiles(this.productsContentDir);
      
      for (const file of files) {
        try {
          // Remove ALL files in products directory, including _index.md
          if (fs.statSync(file).isFile()) {
            fs.unlinkSync(file);
            console.log(`🗑️  Deleted: ${path.relative(this.siteDir, file)}`);
            count++;
          }
        } catch (error) {
          console.error(`❌ Error deleting ${file}:`, error.message);
        }
      }
      
      // Remove empty directories
      this.removeEmptyDirectories(this.productsContentDir);
    } else {
      console.log("ℹ️  No products content directory found");
    }
    
    return count;
  }

  async removeProductImages() {
    console.log("🖼️  Removing product images...");
    let count = 0;
    
    if (fs.existsSync(this.productsImageDir)) {
      const files = fs.readdirSync(this.productsImageDir);
      
      for (const file of files) {
        const filePath = path.join(this.productsImageDir, file);
        
        try {
          // Skip the profile image as it"s used for the site logo
          if (file.includes("-profile.")) {
            console.log(`⏭️  Skipping profile image: ${file}`);
            continue;
          }
          
          if (fs.statSync(filePath).isFile() && this.isImageFile(file)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted: ${path.relative(this.siteDir, filePath)}`);
            count++;
          }
        } catch (error) {
          console.error(`❌ Error deleting ${filePath}:`, error.message);
        }
      }
    } else {
      console.log("ℹ️  No products image directory found");
    }
    
    return count;
  }

  async cleanProductReferences() {
    console.log("🔗 Cleaning product references...");
    
    // Files that might contain product references
    const filesToCheck = [
      path.join(this.contentDir, "_index.md"),
      path.join(this.contentDir, "values/_index.md"),
      path.join(this.staticDir, "../layouts/index.html"),
      path.join(this.staticDir, "../layouts/partials/nav.html"),
      path.join(this.staticDir, "../layouts/partials/footer.html"),
      path.join(this.staticDir, "../layouts/partials/2-up.html")
    ];
    
    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        try {
          let content = fs.readFileSync(filePath, "utf8");
          let modified = false;
          
          // Remove product sections from frontmatter
          const productSectionRegex = /products:\s*\n(?:\s*-\s*[^\n]*\n(?:\s+[^\n]*\n)*)*(?=\w+:|---|\n\n)/g;
          if (productSectionRegex.test(content)) {
            content = content.replace(productSectionRegex, "");
            modified = true;
          }
          
          // Remove product navigation links
          const productNavRegex = /<li><a href="\/products"[^>]*>.*?<\/a><\/li>/g;
          if (productNavRegex.test(content)) {
            content = content.replace(productNavRegex, "");
            modified = true;
          }
          
          // Remove product links and buttons
          const productLinkRegex = /<a href="\/products"[^>]*>.*?<\/a>/g;
          if (productLinkRegex.test(content)) {
            content = content.replace(productLinkRegex, "");
            modified = true;
          }
          
          // Remove product gallery references
          const productGalleryRegex = /gallery:\s*\n(?:\s*-\s*[^\n]+\n)*/g;
          if (productGalleryRegex.test(content)) {
            content = content.replace(productGalleryRegex, "");
            modified = true;
          }
          
          // Remove product image references (but keep profile images)
          const productImageRegex = /\/img\/products\/(?!.*-profile\.)[^\s"']+/g;
          if (productImageRegex.test(content)) {
            content = content.replace(productImageRegex, "");
            modified = true;
          }
          
          // Clean up any double newlines or spacing issues
          if (modified) {
            content = content.replace(/\n\n\n+/g, "\n\n");
            fs.writeFileSync(filePath, content);
            console.log(`🔄 Updated: ${path.relative(this.siteDir, filePath)}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${filePath}:`, error.message);
        }
      }
    }
  }

  getAllFiles(dir) {
    let files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files = files.concat(this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  removeEmptyDirectories(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }
    
    const items = fs.readdirSync(dir);
    
    // First, recursively remove empty subdirectories
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        this.removeEmptyDirectories(fullPath);
      }
    }
    
    // Then check if this directory is now empty
    const remainingItems = fs.readdirSync(dir);
    if (remainingItems.length === 0 && dir !== this.productsContentDir) {
      fs.rmdirSync(dir);
      console.log(`📁 Removed empty directory: ${path.relative(this.siteDir, dir)}`);
    }
  }

  isImageFile(filename) {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  // Method to show what would be deleted (dry run)
  async previewCleanup() {
    console.log("👀 Preview: What would be deleted...");
    
    // Check product content
    if (fs.existsSync(this.productsContentDir)) {
      const files = this.getAllFiles(this.productsContentDir);
      console.log(`\n📁 Product content files (${files.length}):`);
      files.forEach(file => {
        if (file.endsWith(".md") || this.isImageFile(file)) {
          console.log(`  - ${path.relative(this.siteDir, file)}`);
        }
      });
    }
    
    // Check product images
    if (fs.existsSync(this.productsImageDir)) {
      const files = fs.readdirSync(this.productsImageDir);
      const imagesToDelete = files.filter(file => 
        !file.includes("-profile.") && this.isImageFile(file)
      );
      
      console.log(`\n🖼️  Product images (${imagesToDelete.length}):`);
      imagesToDelete.forEach(file => {
        console.log(`  - static/img/products/${file}`);
      });
      
      const profileImages = files.filter(file => file.includes("-profile."));
      if (profileImages.length > 0) {
        console.log(`\n⏭️  Profile images (will be kept):`);
        profileImages.forEach(file => {
          console.log(`  - static/img/products/${file}`);
        });
      }
    }
    
    console.log("\n💡 Run with --execute to actually delete these files");
  }
}

// Main execution
async function main() {
  const cleaner = new CMSProductCleaner();
  
  const args = process.argv.slice(2);
  const shouldExecute = args.includes("--execute") || args.includes("-e");
  const showPreview = args.includes("--preview") || args.includes("-p");
  
  if (showPreview) {
    await cleaner.previewCleanup();
  } else if (shouldExecute) {
    await cleaner.cleanProducts();
  } else {
    console.log("🧹 CMS Product Cleaner");
    console.log("");
    console.log("Usage:");
    console.log("  node clean-products.js --preview    # Show what would be deleted");
    console.log("  node clean-products.js --execute    # Actually delete products");
    console.log("");
    console.log("Options:");
    console.log("  --preview, -p    Show preview of what would be deleted");
    console.log("  --execute, -e    Execute the cleanup");
    console.log("");
    console.log("ℹ️  Profile images will be preserved for site logo");
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CMSProductCleaner;
