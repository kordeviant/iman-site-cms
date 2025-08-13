/**
 * Enhanced Instagram Scraper with Persistent Browser Data
 * 
 * Features:
 * - Persistent browser data stored in d:\puppeteer-data
 * - Maintains login sessions across script runs (no more repeated logins!)
 * - Acts like a normal browser with saved cookies, cache, and preferences
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

    const markdownContent = `---
title: "${escapeYaml(post.title)}"
date: ${post.date}
description: "${escapeYaml(post.description || 'Beautiful jewelry piece from our Instagram collection')}"
image: "/img/${primaryMedia}"
${allGallery.length > 0 ? `gallery:\n${allGallery.map(url => `  - "${url}"`).join('\n')}\n` : ''}${mediaFiles.images.length > 0 ? `images:\n${mediaFiles.images.map(img => `  - url: "${img.url}"\n    alt: "${escapeYaml(img.alt)}"\n    width: ${img.width}\n    height: ${img.height}`).join('\n')}\n` : ''}${mediaFiles.videos.length > 0 ? `videos:\n${mediaFiles.videos.map(vid => `  - url: "${vid.url}"\n    type: "${vid.type}"\n    width: ${vid.width}\n    height: ${vid.height}${vid.poster ? `\n    poster: "${vid.poster}"` : ''}`).join('\n')}\n` : ''}price: 0
category: "Instagram Collection"
in_stock: true
featured: false
weight: 100
---

${post.description || 'This beautiful jewelry piece is part of our exclusive collection. Contact us for more details and pricing.'}

## Product Details

- **Post ID**: ${post.id}
- **Account**: ${profileUsername || 'N/A'}

class InstagramScraper {
  // ...existing code...
  getVideoExtension(videoUrl) {
    // Extract extension from URL
    const urlParts = videoUrl.split('?')[0]; // Remove query parameters
    const extension = urlParts.split('.').pop().toLowerCase();
    // Default to common video formats
    if (['mp4', 'mov', 'avi', 'webm', 'm4v'].includes(extension)) {
      return `.${extension}`;
    }
    // Default to .mp4 if unclear
    return '.mp4';
  }

  getImageExtension(imageUrl) {
    // Extract extension from URL
    const urlParts = imageUrl.split('?')[0]; // Remove query parameters
    const extension = urlParts.split('.').pop().toLowerCase();
    // Default to common formats
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
      return `.${extension}`;
    }
    // Default to .jpg if unclear
    return '.jpg';
  }

  async downloadProfileImage(profileInfo) {
    if (!profileInfo.profileImageUrl) {
      console.log("⚠️ No profile image URL found");
      return null;
    }
    try {
      console.log("📥 Downloading profile image for site logo...");
      // Generate filename for profile image
      const username = profileInfo.username || "profile";
      const extension = this.getImageExtension(profileInfo.profileImageUrl);
      const fileName = `${username}-profile${extension}`;
      // Download using the new media download system
      const success = await this.downloadMedia(profileInfo.profileImageUrl, fileName, "image");
      if (success) {
        // Also copy as site logo
        const logoPath = path.join(__dirname, '../site/static/img/logo.svg');
        const profilePath = path.join(this.imagesDir, fileName);
        const logoBackupPath = path.join(__dirname, '../site/static/img/logo-backup.svg');
        try {
          // Backup existing logo if it exists
          if (fs.existsSync(logoPath)) {
            if (!fs.existsSync(logoBackupPath)) {
              fs.copyFileSync(logoPath, logoBackupPath);
              console.log("📄 Backed up existing logo");
            }
          }
          // Copy profile image as new logo (keeping original extension)
          const newLogoPath = path.join(__dirname, '../site/static/img', `logo${extension}`);
          fs.copyFileSync(profilePath, newLogoPath);
          console.log(`✅ Profile image set as site logo: logo${extension}`);
        } catch (logoError) {
          console.log("⚠️ Could not replace logo, but profile image downloaded successfully");
        }
        console.log(`✅ Profile image downloaded: ${fileName}`);
        return fileName;
      } else {
        console.error("❌ Failed to download profile image");
        return null;
      }
    } catch (error) {
      console.error("❌ Error downloading profile image:", error.message);
      return null;
    }
  }

  async cleanExistingInstagramProducts() {
    console.log("🧹 Cleaning existing Instagram products...");
    try {
      const productsDirs = fs.readdirSync(this.outputDir);
      let removedCount = 0;
      for (const dir of productsDirs) {
        const fullPath = path.join(this.outputDir, dir);
        if (fs.statSync(fullPath).isDirectory() && dir.startsWith('instagram-post-')) {
          console.log(`🗑️ Removing existing Instagram product: ${dir}`);
          // Remove the directory and all its contents
          fs.rmSync(fullPath, { recursive: true, force: true });
          removedCount++;
        }
      }
      console.log(`✅ Removed ${removedCount} existing Instagram products`);
      return removedCount;
    } catch (error) {
      console.error("❌ Error cleaning existing products:", error.message);
      return 0;
    }
  }

  async createProductMarkdown(post, mediaFiles, profileUsername) {
    const slug = this.createSlug(post.title);
    const productDir = path.join(this.outputDir, slug);
    this.ensureDirectoryExists(productDir);
    // Determine primary media and build gallery
    const primaryMedia = mediaFiles.primaryMedia;
    const primaryMediaType = mediaFiles.mediaType;
    // Build gallery arrays for images and videos
    const imageGallery = mediaFiles.images.length > 1 ? 
      mediaFiles.images.slice(1).map(img => img.url) : [];
    const videoGallery = mediaFiles.videos.map(vid => vid.url);
    // Combine all media for gallery (excluding primary)
    const allGallery = [...imageGallery, ...videoGallery];
    // Create media metadata for CMS
    const mediaMetadata = {
      images: mediaFiles.images,
      videos: mediaFiles.videos,
      primaryType: primaryMediaType
    };
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
    const markdownContent = `---
      
      return {
        total: syncResults.total,
        existing: syncResults.existing,
        newProducts: successful.length,
        failed: failed.length,
        results: syncResults.results,
        profile: profile
      };
      
    } catch (error) {
      console.error("❌ Fatal error:", error);
      throw error;
    } finally {
      await this.close();
    }
}

// Export for use as module
module.exports = {InstagramScraper};

📱 Instagram to CMS Products Sync Tool with Smart Modal Handling

Usage: node instagram-scraper.js <instagram-url> [options]

Examples:
  node instagram-scraper.js "https://www.instagram.com/yourbrand/"
  node instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass

    const markdownPath = path.join(productDir, 'index.md');
    fs.writeFileSync(markdownPath, markdownContent);
    // Also save media metadata as JSON for advanced CMS features
    const metadataPath = path.join(productDir, 'media.json');
    fs.writeFileSync(metadataPath, JSON.stringify(mediaMetadata, null, 2));
    console.log(`✅ Created CMS product with ${mediaFiles.images.length + mediaFiles.videos.length} media files: ${slug}`);
    return slug;
  }

  createSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async saveProfileInfo(profileInfo) {
    if (!profileInfo) {
      console.log("⚠️ No profile info to save");
      return;
    }
    try {
      console.log("💾 Saving profile information...");
      // Save profile info as JSON for Hugo data
      const dataDir = path.join(this.outputDir, "..", "data");
      this.ensureDirectoryExists(dataDir);
      const profileData = {
        username: profileInfo.username,
        displayName: profileInfo.displayName,
        bio: profileInfo.bio,
        profileImage: profileInfo.profileImageFile ? `/img/products/${profileInfo.profileImageFile}` : null,
        stats: {
          posts: profileInfo.postsCount,
          followers: profileInfo.followersCount,
          following: profileInfo.followingCount
        },
        lastUpdated: new Date().toISOString()
      };
      const profilePath = path.join(dataDir, "instagram-profile.json");
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      console.log(`✅ Profile information saved to: ${profilePath}`);
      return profilePath;
    } catch (error) {
      console.error("❌ Error saving profile info:", error.message);
      return null;
    }
  }

  async getExistingProductIds() {
    console.log("🔍 Checking for existing Instagram products...");
    try {
      const existingIds = new Set();
      if (!fs.existsSync(this.outputDir)) {
        console.log("📁 Products directory doesn't exist yet");
        return existingIds;
      }
      const productDirs = fs.readdirSync(this.outputDir);
      for (const dir of productDirs) {
        const fullPath = path.join(this.outputDir, dir);
        if (fs.statSync(fullPath).isDirectory()) {
          const indexPath = path.join(fullPath, 'index.md');
          if (fs.existsSync(indexPath)) {
            try {
              const content = fs.readFileSync(indexPath, 'utf8');
              // Extract Instagram ID from frontmatter
              const instagramIdMatch = content.match(/instagram_id:\s*"([^"]+)"/);
              if (instagramIdMatch) {
                existingIds.add(instagramIdMatch[1]);
              }
              // Also check for old-style post IDs in directory names
              if (dir.startsWith('instagram-post-')) {
                const oldStyleId = dir.replace('instagram-post-', '');
                existingIds.add(oldStyleId);
              }
            } catch (error) {
              console.log(`⚠️ Could not read ${indexPath}:`, error.message);
            }
          }
        }
      }
      console.log(`📊 Found ${existingIds.size} existing Instagram products`);
      return existingIds;
    } catch (error) {
      console.error("❌ Error checking existing products:", error.message);
      return new Set();
    }
  }

  async syncPostsWithProducts(posts, profileUsername) {
    console.log(`🔄 Syncing ${posts.length} posts with existing products...`);
    // Get existing product IDs
    const existingIds = await this.getExistingProductIds();
    // Filter out posts that already have products
    const newPosts = posts.filter(post => !existingIds.has(post.id));
    const skippedPosts = posts.filter(post => existingIds.has(post.id));
    console.log(`📊 Sync Analysis:`);
    console.log(`   Total posts found: ${posts.length}`);
    console.log(`   Already have products: ${skippedPosts.length}`);
    console.log(`   New posts to process: ${newPosts.length}`);
    if (skippedPosts.length > 0) {
      console.log(`⏭️ Skipping existing products for posts: ${skippedPosts.map(p => p.id).join(', ')}`);
    }
    if (newPosts.length === 0) {
      console.log(`✅ All posts are already synced as products! No new work needed.`);
      return {
        total: posts.length,
        existing: skippedPosts.length,
        processed: 0,
        results: []
      };
    }
    console.log(`🚀 Processing ${newPosts.length} new posts...`);
    // Process only the new posts
    const results = [];
    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i];
      console.log(`Processing new post ${i + 1}/${newPosts.length}: ${post.id} (${post.type})`);
      try {
        // Download all media files for this post
        const mediaFiles = await this.downloadPostMedia(post);
        if (mediaFiles.primaryMedia) {
          // Create CMS-compatible product markdown with media support
          const productSlug = await this.createProductMarkdown(post, mediaFiles, profileUsername);
          results.push({
            success: true,
            postId: post.id,
            productSlug: productSlug,
            mediaFiles: mediaFiles,
            mediaCount: mediaFiles.images.length + mediaFiles.videos.length,
            primaryMediaType: mediaFiles.mediaType,
            isNew: true
          });
          console.log(`✅ Created product with ${mediaFiles.images.length} images and ${mediaFiles.videos.length} videos`);
        } else {
          results.push({
            success: false,
            postId: post.id,
            error: "No media files could be downloaded",
            isNew: true
          });
        }
        // Add delay between requests to be respectful
        await this.wait(2000); // Increased delay for media downloads
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error);
        results.push({
          success: false,
          postId: post.id,
          error: error.message,
          isNew: true
        });
      }
    }
    return {
      total: posts.length,
      existing: skippedPosts.length,
      processed: newPosts.length,
      results: results
    };
  }

  async close() {
    try {
      if (this.browser) {
        // Save session one more time before closing
        if (this.isLoggedIn) {
          console.log('💾 Saving final session before closing...');
          try {
            await this.saveSession();
            console.log('✅ Final session saved successfully!');
          } catch (sessionError) {
            console.error('⚠️  Warning: Could not save final session:', sessionError.message);
          }
        }
        console.log('🔄 Closing browser...');
        await this.browser.close();
        console.log('✅ Browser closed successfully');
      }
    } catch (error) {
      console.error('❌ Error closing browser:', error.message);
      // Force close if normal close fails
      try {
        if (this.browser) {
          await this.browser.close();
        }
      } catch (forceCloseError) {
        console.error('❌ Force close also failed:', forceCloseError.message);
      }
    }
  }

  // Method to manually clear saved session
  async clearSavedSession() {
    console.log('🗑️  Clearing saved login session...');
    this.clearSession();
    this.isLoggedIn = false;
    console.log('✅ Session cleared! You will need to login again next time.');
  }

  // Main method to scrape and sync Instagram posts with CMS products
  async scrapeAndCreateProducts(instagramUrl, options = {}) {
    const {
      cleanExisting = false // Changed default to false since we're syncing now
    } = options;
    try {
      await this.init();
      // Only clean existing Instagram products if explicitly requested
      if (cleanExisting) {
        console.log("🧹 Cleaning existing products as requested...");
        await this.cleanExistingInstagramProducts();
      }
      // Scrape Instagram page to get all posts
      const scrapedData = await this.scrapeInstagramPage(instagramUrl);
      const posts = scrapedData.posts;
      const profile = scrapedData.profile;
      // Save profile information and handle logo replacement
      if (profile) {
        await this.saveProfileInfo(profile);
      }
      // Sync posts with existing products (only create new ones)
      const syncResults = await this.syncPostsWithProducts(posts, profile?.username);
      // Generate summary
      const successful = syncResults.results.filter(r => r.success);
      const failed = syncResults.results.filter(r => !r.success);
      console.log("\n📊 SYNC SUMMARY:");
      console.log(`📄 Total posts on page: ${syncResults.total}`);
      console.log(`✅ Already synced as products: ${syncResults.existing}`);
      console.log(`🆕 New products created: ${successful.length}`);
      console.log(`❌ Failed to create: ${failed.length}`);
      console.log(`📁 Images stored in: /img/ (visible in CMS media library)`);
      if (profile) {
        console.log(`👤 Profile: ${profile.username || "Unknown"}`);
        console.log(`🖼️ Profile image: ${profile.profileImageFile ? "Downloaded and set as logo" : "Not found"}`);
      }
      if (syncResults.existing > 0) {
        console.log(`\n⏭️ Skipped ${syncResults.existing} posts that already have products`);
      }
      if (failed.length > 0) {
        console.log("\n❌ Failed posts:");
        failed.forEach(f => {
          console.log(`- ${f.postId}: ${f.error}`);
        });
      }
      console.log("\n🎯 Next Steps:");
      console.log("1. All Instagram posts are now synced as CMS products");
      console.log("2. Only new posts were processed to avoid duplicates");
      console.log("3. Run this script again to sync any newly posted content");
      console.log("4. Edit product details through the CMS admin panel");
      console.log("5. Images are visible in CMS media library with 'instagram-' prefix");
      return {
        total: syncResults.total,
        existing: syncResults.existing,
        newProducts: successful.length,
        failed: failed.length,
        results: syncResults.results,
        profile: profile
      };
    } catch (error) {
      console.error("❌ Fatal error:", error);
      throw error;
    } finally {
      await this.close();
    }
  }
}
Options:
  --clean-existing     Remove all existing Instagram products before syncing
  --username=USER      Instagram username for private pages
  --password=PASS      Instagram password for private pages

🔄 SYNC BEHAVIOR:
  • Loads ALL posts from the Instagram page (scrolls to bottom)
  • Only creates products for NEW posts (avoids duplicates)
  • Skips posts that already have products
  • Perfect for keeping your CMS in sync with Instagram

Features:
  ✅ Downloads profile picture as site logo
  ✅ Creates CMS-compatible product entries for ALL page posts
  ✅ Smart sync - only processes new posts
  ✅ Organizes images in /img/ folder (CMS media library)
  ✅ Supports private Instagram accounts with login
  ✅ Compatible with Decap CMS admin interface
  ✅ 🆕 Automatic modal/captcha detection and pause
  ✅ 🆕 Handles verification codes and security challenges
  ✅ 🆕 Smart wait for manual intervention when needed
  ✅ 🆕 Complete page sync (all posts → all products)
    `);
    process.exit(1);
  }

  const instagramUrl = args[0];
  const options = {};
  const credentials = {};
  
  // Parse options
  args.slice(1).forEach((arg) => {
    if (arg === "--clean-existing") {
      options.cleanExisting = true;
    }
    if (arg.startsWith("--username=")) {
      credentials.username = arg.split("=")[1];
    }
    if (arg.startsWith("--password=")) {
      credentials.password = arg.split("=")[1];
    }
  });

  // Create scraper with credentials if provided
  const scraper = credentials.username && credentials.password 
    ? new InstagramScraper(credentials)
    : new InstagramScraper();
  
  scraper.scrapeAndCreateProducts(instagramUrl, options)
    .then(results => {
      console.log("\n🎉 Scraping completed successfully!");
      console.log(`📊 Total: ${results.total}, Success: ${results.successful}, Failed: ${results.failed}`);
      console.log("🔗 Access your CMS admin panel to manage the new products");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n💥 Scraping failed:", error);
      process.exit(1);
    });
}
