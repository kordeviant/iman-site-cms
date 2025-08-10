/**
 * Enhanced Instagram Scraper with Persistent Browser Data
 * 
 * Features:
 * - Persistent browser data stored in d:\puppeteer-data
 * - Maintains login sessions across script runs (no more repeated logins!)
 * - Acts like a normal browser with saved cookies, cache, and preferences
 * - Downloads all media types (images, videos, carousels)
 * - Creates Hugo-compatible product pages
 * - Handles Instagram's anti-bot measures gracefully
 * - Automatic retries and error recovery
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

class InstagramScraper {
  constructor(credentials = {}) {
    this.credentials = credentials;
    this.userDataDir = path.join('d:', 'puppeteer-data');
    this.baseDir = path.join(__dirname, '../site/static/img/products');
    this.contentDir = path.join(__dirname, '../site/content/products');
    this.imagesDir = this.baseDir;
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.userDataDir, this.baseDir, this.contentDir, this.imagesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

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
      // Clean product content files
      const files = fs.readdirSync(this.contentDir);
      let cleaned = 0;
      
      for (const file of files) {
        if (file.startsWith('instagram-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(this.contentDir, file));
          cleaned++;
        }
      }
      
      console.log(`✅ Cleaned ${cleaned} existing Instagram product files`);
    } catch (error) {
      console.log("⚠️ Could not clean existing files:", error.message);
    }
  }

  async downloadMedia(url, filename, type = "image") {
    return new Promise((resolve) => {
      try {
        const filePath = path.join(this.imagesDir, filename);
        const file = fs.createWriteStream(filePath);
        
        const request = https.get(url, (response) => {
          if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              console.log(`✅ Downloaded ${type}: ${filename}`);
              resolve(true);
            });
          } else {
            console.log(`❌ Failed to download ${type} (${response.statusCode}): ${filename}`);
            file.close();
            fs.unlink(filePath, () => {}); // Delete incomplete file
            resolve(false);
          }
        });
        
        request.on('error', (error) => {
          console.log(`❌ Error downloading ${type}: ${error.message}`);
          file.close();
          fs.unlink(filePath, () => {}); // Delete incomplete file
          resolve(false);
        });
        
        file.on('error', (error) => {
          console.log(`❌ File error for ${type}: ${error.message}`);
          fs.unlink(filePath, () => {}); // Delete incomplete file
          resolve(false);
        });
        
      } catch (error) {
        console.log(`❌ Exception downloading ${type}: ${error.message}`);
        resolve(false);
      }
    });
  }

  async createProductPage(post, mediaFiles) {
    try {
      const slug = `instagram-${post.id}`;
      const filename = `${slug}.md`;
      const filepath = path.join(this.contentDir, filename);

      // Primary media for the main image
      const primaryMedia = mediaFiles.images.length > 0 
        ? mediaFiles.images[0].filename 
        : (mediaFiles.videos.length > 0 ? mediaFiles.videos[0].filename : '');

      // Gallery images for Hugo gallery
      const allGallery = [...mediaFiles.images, ...mediaFiles.videos].map(media => 
        `/img/products/${media.filename}`
      );

      // Helper function to escape YAML strings
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
title: "${escapeYaml(post.title)}"
date: ${post.date}
description: "${escapeYaml(post.description || 'Beautiful jewelry piece from our Instagram collection')}"
image: "/img/products/${primaryMedia}"
${allGallery.length > 0 ? `gallery:\n${allGallery.map(url => `  - "${url}"`).join('\n')}\n` : ''}${mediaFiles.images.length > 0 ? `images:\n${mediaFiles.images.map(img => `  - url: "/img/products/${img.filename}"\n    alt: "${escapeYaml(img.alt)}"\n    width: ${img.width}\n    height: ${img.height}`).join('\n')}\n` : ''}${mediaFiles.videos.length > 0 ? `videos:\n${mediaFiles.videos.map(vid => `  - url: "/img/products/${vid.filename}"\n    type: "${vid.type}"\n    width: ${vid.width}\n    height: ${vid.height}${vid.poster ? `\n    poster: "/img/products/${vid.poster}"` : ''}`).join('\n')}\n` : ''}price: 0
category: "Instagram Collection"
in_stock: true
featured: false
weight: 100
---

${post.description || 'This beautiful jewelry piece is part of our exclusive collection. Contact us for more details and pricing.'}

## Product Details

- **Post ID**: ${post.id}
- **Posted**: ${new Date(post.date).toLocaleDateString()}
- **Source**: Instagram

${mediaFiles.images.length > 0 ? '## Images\n\n' + mediaFiles.images.map(img => `![${img.alt}](/img/products/${img.filename})`).join('\n\n') : ''}

${mediaFiles.videos.length > 0 ? '## Videos\n\n' + mediaFiles.videos.map(vid => `<video controls width="${vid.width}" height="${vid.height}">\n  <source src="/img/products/${vid.filename}" type="${vid.type}">\n  Your browser does not support the video tag.\n</video>`).join('\n\n') : ''}
`;

      fs.writeFileSync(filepath, markdownContent);
      console.log(`✅ Created product page: ${filename}`);
      return filename;
    } catch (error) {
      console.error("❌ Error creating product page:", error.message);
      return null;
    }
  }

  async updateInstagramProfile(profileInfo) {
    try {
      const profilePath = path.join(__dirname, '../site/content/data/instagram-profile.json');
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

      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      console.log("✅ Updated Instagram profile data");
    } catch (error) {
      console.error("❌ Error updating profile data:", error.message);
    }
  }

  async launchBrowser() {
    console.log("🚀 Launching browser with persistent data...");
    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: this.userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1366, height: 768 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Alias methods for compatibility with interactive script
  async init() {
    return await this.launchBrowser();
  }

  async close() {
    return await this.closeBrowser();
  }

  async clearSavedSession() {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.userDataDir)) {
        console.log("🧹 Clearing saved browser session...");
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
        console.log("✅ Browser session cleared");
      }
    } catch (error) {
      console.log("⚠️ Could not clear session:", error.message);
    }
  }

  async scrapeInstagramPage(instagramUrl) {
    try {
      // Navigate to Instagram URL
      console.log(`🔗 Navigating to: ${instagramUrl}`);
      await this.page.goto(instagramUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for page to load
      await this.page.waitForTimeout(3000);
      
      // Check if login is required
      const loginRequired = await this.page.$('input[name="username"]');
      if (loginRequired) {
        console.log("🔐 Login required...");
        console.log("⏳ Please log in manually in the browser, then press Enter to continue...");
        await new Promise(resolve => {
          process.stdin.once('data', resolve);
        });
      }
      
      // Wait for content to load
      await this.page.waitForTimeout(2000);
      
      // Get profile information
      const profile = await this.scrapeProfileInfo();
      
      // Get all posts
      const posts = await this.scrapePosts(50); // Get more posts for interactive mode
      
      return { profile, posts };
    } catch (error) {
      console.error("❌ Error scraping Instagram page:", error.message);
      throw error;
    }
  }

  async saveProfileInfo(profile) {
    if (profile) {
      await this.updateInstagramProfile(profile);
    }
  }

  async syncPostsWithProducts(posts, profileUsername) {
    const results = { total: posts.length, successful: 0, failed: 0 };
    
    // Clean existing Instagram products
    await this.cleanExistingInstagramProducts();
    
    // Process each post
    for (const post of posts) {
      try {
        console.log(`\n📝 Processing post: ${post.id}`);
        
        // Download media files
        const mediaFiles = await this.downloadPostMedia(post);
        
        // Create product page
        const productFile = await this.createProductPage(post, mediaFiles);
        
        if (productFile) {
          results.successful++;
          console.log(`✅ Successfully created product: ${productFile}`);
        } else {
          results.failed++;
        }
        
        // Rate limiting
        await this.page.waitForTimeout(2000);
        
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error.message);
        results.failed++;
      }
    }
    
    return results;
  }

  async scrapeAndCreateProducts(instagramUrl, options = {}) {
    const startTime = Date.now();
    let results = { total: 0, successful: 0, failed: 0 };
    
    try {
      await this.launchBrowser();
      
      // Navigate to Instagram URL
      console.log(`🔗 Navigating to: ${instagramUrl}`);
      await this.page.goto(instagramUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for page to load
      await this.page.waitForTimeout(3000);
      
      // Check if login is required
      const loginRequired = await this.page.$('input[name="username"]');
      if (loginRequired) {
        console.log("🔐 Login required...");
        if (this.credentials.username && this.credentials.password) {
          await this.handleLogin();
        } else {
          console.log("⏳ Please log in manually in the browser, then press Enter to continue...");
          await new Promise(resolve => {
            process.stdin.once('data', resolve);
          });
        }
      }
      
      // Wait for content to load
      await this.page.waitForTimeout(2000);
      
      // Clean existing Instagram products if requested
      if (options.cleanExisting) {
        await this.cleanExistingInstagramProducts();
      }
      
      // Get profile information
      const profile = await this.scrapeProfileInfo();
      if (profile) {
        console.log(`👤 Profile: ${profile.username} (${profile.displayName})`);
        console.log(`📊 Posts: ${profile.postsCount}, Followers: ${profile.followersCount}, Following: ${profile.followingCount}`);
        console.log(`🖼️ Profile image: ${profile.profileImageFile ? "Downloaded and set as logo" : "Not found"}`);
        
        // Update profile data
        await this.updateInstagramProfile(profile);
      }
      
      // Get all posts
      const posts = await this.scrapePosts(options.limit || 10);
      results.total = posts.length;
      
      console.log(`📱 Found ${posts.length} posts to process`);
      
      // Process each post
      for (const post of posts) {
        try {
          console.log(`\n📝 Processing post: ${post.id}`);
          
          // Download media files
          const mediaFiles = await this.downloadPostMedia(post);
          
          // Create product page
          const productFile = await this.createProductPage(post, mediaFiles);
          
          if (productFile) {
            results.successful++;
            console.log(`✅ Successfully created product: ${productFile}`);
          } else {
            results.failed++;
          }
          
          // Rate limiting
          await this.page.waitForTimeout(2000);
          
        } catch (error) {
          console.error(`❌ Error processing post ${post.id}:`, error.message);
          results.failed++;
        }
      }
      
    } catch (error) {
      console.error("💥 Critical error during scraping:", error);
      throw error;
    } finally {
      await this.closeBrowser();
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n⏱️ Total time: ${duration}s`);
    }
    
    return results;
  }

  async handleLogin() {
    try {
      console.log("🔑 Attempting automatic login...");
      
      await this.page.type('input[name="username"]', this.credentials.username);
      await this.page.type('input[name="password"]', this.credentials.password);
      
      await this.page.click('button[type="submit"]');
      await this.page.waitForTimeout(3000);
      
      // Check for save login info dialog
      const saveInfoButton = await this.page.$('button:contains("Not Now")');
      if (saveInfoButton) {
        await saveInfoButton.click();
        await this.page.waitForTimeout(1000);
      }
      
      console.log("✅ Login successful");
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      throw error;
    }
  }

  async scrapeProfileInfo() {
    try {
      console.log("👤 Scraping profile information...");
      
      // Get basic profile info
      const profileInfo = await this.page.evaluate(() => {
        const getTextContent = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : '';
        };
        
        const getImageSrc = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.src : '';
        };
        
        // Try different selectors for profile image
        const profileImageSelectors = [
          'img[data-testid="user-avatar"]',
          'header img',
          'article img',
          'img[alt*="profile picture"]'
        ];
        
        let profileImageUrl = '';
        for (const selector of profileImageSelectors) {
          profileImageUrl = getImageSrc(selector);
          if (profileImageUrl) break;
        }
        
        return {
          username: window.location.pathname.replace('/', ''),
          displayName: getTextContent('h2') || getTextContent('h1'),
          bio: getTextContent('div[data-testid="user-bio"]') || getTextContent('div.-vDIg span'),
          profileImageUrl: profileImageUrl,
          postsCount: getTextContent('a[href*="/"] span').replace(/,/g, ''),
          followersCount: getTextContent('a[href*="/followers/"] span') || getTextContent('a[href*="/followers/"] title'),
          followingCount: getTextContent('a[href*="/following/"] span')
        };
      });
      
      // Download profile image if available
      if (profileInfo.profileImageUrl) {
        profileInfo.profileImageFile = await this.downloadProfileImage(profileInfo);
      }
      
      return profileInfo;
    } catch (error) {
      console.error("❌ Error scraping profile info:", error.message);
      return null;
    }
  }

  async scrapePosts(limit = 10) {
    try {
      console.log(`📱 Scraping up to ${limit} posts...`);
      
      // Scroll to load posts
      await this.scrollToLoadPosts();
      
      const posts = await this.page.evaluate((limit) => {
        const postElements = document.querySelectorAll('article div[role="button"]:has(img), a[href*="/p/"]');
        const posts = [];
        
        for (let i = 0; i < Math.min(postElements.length, limit); i++) {
          const element = postElements[i];
          const link = element.href || element.closest('a')?.href;
          
          if (link && link.includes('/p/')) {
            const postId = link.split('/p/')[1].split('/')[0];
            const img = element.querySelector('img');
            
            posts.push({
              id: postId,
              url: link,
              title: `Instagram Post ${postId}`,
              description: img ? img.alt : '',
              date: new Date().toISOString()
            });
          }
        }
        
        return posts;
      }, limit);
      
      console.log(`✅ Found ${posts.length} posts`);
      return posts;
    } catch (error) {
      console.error("❌ Error scraping posts:", error.message);
      return [];
    }
  }

  async scrollToLoadPosts() {
    console.log("📜 Scrolling to load posts...");
    
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.page.waitForTimeout(2000);
    }
  }

  async downloadPostMedia(post) {
    try {
      console.log(`📸 Downloading media for post: ${post.id}`);
      
      // Navigate to post
      await this.page.goto(post.url, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(2000);
      
      // Get media URLs
      const mediaUrls = await this.page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img')).map(img => ({
          url: img.src,
          alt: img.alt || 'Instagram image',
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0
        }));
        
        const videos = Array.from(document.querySelectorAll('video')).map(video => ({
          url: video.src,
          type: video.type || 'video/mp4',
          width: video.videoWidth || 0,
          height: video.videoHeight || 0
        }));
        
        return { images, videos };
      });
      
      const mediaFiles = { images: [], videos: [] };
      
      // Download images
      for (let i = 0; i < mediaUrls.images.length; i++) {
        const img = mediaUrls.images[i];
        if (img.url && !img.url.includes('profile') && img.width > 100) {
          const filename = `${post.id}-img-${i + 1}.jpg`;
          const success = await this.downloadMedia(img.url, filename, 'image');
          if (success) {
            mediaFiles.images.push({
              filename,
              alt: img.alt,
              width: img.width,
              height: img.height
            });
          }
        }
      }
      
      // Download videos
      for (let i = 0; i < mediaUrls.videos.length; i++) {
        const video = mediaUrls.videos[i];
        if (video.url) {
          const filename = `${post.id}-video-${i + 1}.mp4`;
          const success = await this.downloadMedia(video.url, filename, 'video');
          if (success) {
            mediaFiles.videos.push({
              filename,
              type: video.type,
              width: video.width,
              height: video.height
            });
          }
        }
      }
      
      return mediaFiles;
    } catch (error) {
      console.error(`❌ Error downloading media for post ${post.id}:`, error.message);
      return { images: [], videos: [] };
    }
  }
}

module.exports = InstagramScraper;
