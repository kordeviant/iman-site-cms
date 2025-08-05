const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class InstagramScraper {
  constructor(credentials = null) {
    this.browser = null;
    this.page = null;
    this.credentials = credentials; // { username, password }
    this.isLoggedIn = false;
    this.outputDir = path.join(__dirname, '../site/content/products');
    this.imagesDir = path.join(__dirname, '../site/static/img/products');
    
    // Ensure directories exist
    this.ensureDirectoryExists(this.outputDir);
    this.ensureDirectoryExists(this.imagesDir);
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async init() {
    console.log('🚀 Starting Instagram scraper...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Set to true for production
        defaultViewport: null,
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
    } catch (error) {
      console.error('❌ Failed to launch browser:', error.message);
      
      if (error.message.includes('Could not find Chrome')) {
        console.log('🔧 Chrome not found. Trying to install Chrome for Puppeteer...');
        console.log('💡 Please run: npx puppeteer browsers install chrome');
        console.log('   Or alternatively: yarn add puppeteer');
        throw new Error('Chrome browser not found. Please install Chrome for Puppeteer using: npx puppeteer browsers install chrome');
      }
      
      throw error;
    }

    this.page = await this.browser.newPage();
    
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set viewport
    await this.page.setViewport({ width: 1366, height: 768 });
  }

  async login() {
    if (!this.credentials || !this.credentials.username || !this.credentials.password) {
      console.log('⚠️  No credentials provided, skipping login...');
      return false;
    }

    try {
      console.log('🔐 Logging into Instagram...');
      
      // Go to Instagram login page
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for login form to load
      await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
      
      // Handle cookie banner if present
      try {
        const acceptCookiesBtn = await this.page.$('button[class*="cookie"]');
        if (acceptCookiesBtn) {
          await acceptCookiesBtn.click();
          await this.page.waitForTimeout(2000);
        }
      } catch (e) {
        console.log('No cookies banner found on login page');
      }

      // Fill in credentials
      console.log('📝 Entering credentials...');
      await this.page.type('input[name="username"]', this.credentials.username, { delay: 100 });
      await this.page.type('input[name="password"]', this.credentials.password, { delay: 100 });

      // Click login button
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation or error
      await this.page.waitForTimeout(3000);

      // Check if login was successful
      const currentUrl = this.page.url();
      
      // Check for various success indicators
      const isLoginSuccess = 
        currentUrl.includes('/accounts/onetap/') ||
        currentUrl === 'https://www.instagram.com/' ||
        currentUrl.includes('/feed/') ||
        await this.page.$('svg[aria-label="Home"]') !== null;

      // Check for error messages
      const errorElement = await this.page.$('div[role="alert"]');
      if (errorElement) {
        const errorText = await this.page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Login failed: ${errorText}`);
      }

      if (isLoginSuccess) {
        console.log('✅ Successfully logged into Instagram!');
        this.isLoggedIn = true;
        
        // Handle "Save Your Login Info?" dialog if it appears
        try {
          await this.page.waitForSelector('button:contains("Not Now")', { timeout: 5000 });
          await this.page.click('button:contains("Not Now")');
        } catch (e) {
          // Dialog might not appear, that's fine
        }

        // Handle notification permission dialog if it appears
        try {
          await this.page.waitForSelector('button:contains("Not Now")', { timeout: 5000 });
          await this.page.click('button:contains("Not Now")');
        } catch (e) {
          // Dialog might not appear, that's fine
        }

        return true;
      } else {
        throw new Error('Login failed - unknown error');
      }

    } catch (error) {
      console.error('❌ Login failed:', error.message);
      this.isLoggedIn = false;
      throw error;
    }
  }

  async scrapeInstagramPage(instagramUrl) {
    try {
      // Login first if credentials are provided
      if (this.credentials && !this.isLoggedIn) {
        await this.login();
      }

      console.log(`📱 Navigating to ${instagramUrl}...`);
      
      await this.page.goto(instagramUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for page to load
      await this.page.waitForTimeout(3000);

      // Check if we're on a private account page that requires login
      const isPrivatePage = await this.page.$('h2:contains("This Account is Private")') !== null;
      
      if (isPrivatePage && !this.isLoggedIn) {
        throw new Error('This is a private account and no login credentials were provided');
      }

      // Check if we need to accept cookies
      try {
        const acceptCookiesBtn = await this.page.$('button[class*="cookie"]');
        if (acceptCookiesBtn) {
          await acceptCookiesBtn.click();
          await this.page.waitForTimeout(2000);
        }
      } catch (e) {
        console.log('No cookies banner found');
      }

      // Scroll to load more posts
      await this.autoScroll();

      // Get all posts
      const posts = await this.extractPosts();
      
      console.log(`✅ Found ${posts.length} posts`);
      return posts;

    } catch (error) {
      console.error('❌ Error scraping Instagram page:', error);
      throw error;
    }
  }

  async autoScroll() {
    console.log('📜 Scrolling to load more posts...');
    
    await this.page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    await this.page.waitForTimeout(2000);
  }

  async extractPosts() {
    console.log('🔍 Extracting posts data...');
    
    return await this.page.evaluate(() => {
      const posts = [];
      
      // Try different selectors for Instagram posts
      const postSelectors = [
        'article[role="presentation"]',
        'div[class*="v1Nh3"] a',
        'a[href*="/p/"]',
        'div._ac7v a'
      ];
      
      let postElements = [];
      
      for (const selector of postSelectors) {
        postElements = document.querySelectorAll(selector);
        if (postElements.length > 0) {
          console.log(`Found posts using selector: ${selector}`);
          break;
        }
      }

      postElements.forEach((element, index) => {
        try {
          let postUrl = '';
          let imageUrl = '';
          let description = '';
          
          // Get post URL
          if (element.tagName === 'A') {
            postUrl = element.href;
          } else {
            const linkElement = element.querySelector('a[href*="/p/"]');
            postUrl = linkElement ? linkElement.href : '';
          }
          
          // Get image URL
          const imgElement = element.querySelector('img');
          if (imgElement) {
            imageUrl = imgElement.src || imgElement.dataset.src;
            description = imgElement.alt || '';
          }
          
          // Get post ID from URL
          const postIdMatch = postUrl.match(/\/p\/([^\/]+)/);
          const postId = postIdMatch ? postIdMatch[1] : `post-${index}`;
          
          if (postUrl && imageUrl) {
            posts.push({
              id: postId,
              url: postUrl,
              imageUrl: imageUrl,
              description: description,
              title: `Instagram Post ${postId}`,
              date: new Date().toISOString().split('T')[0]
            });
          }
        } catch (error) {
          console.error('Error extracting post:', error);
        }
      });
      
      return posts;
    });
  }

  async downloadImage(imageUrl, filename) {
    try {
      console.log(`📥 Downloading image: ${filename}`);
      
      const viewSource = await this.page.goto(imageUrl);
      const imagePath = path.join(this.imagesDir, filename);
      
      fs.writeFileSync(imagePath, await viewSource.buffer());
      
      return filename;
    } catch (error) {
      console.error(`❌ Error downloading image ${filename}:`, error);
      return null;
    }
  }

  async createProductMarkdown(post, imagePath) {
    const slug = this.createSlug(post.title);
    const productDir = path.join(this.outputDir, slug);
    
    this.ensureDirectoryExists(productDir);
    
    const markdownContent = `---
title: "${post.title}"
date: ${post.date}
description: "${post.description || 'Beautiful jewelry piece from our Instagram collection'}"
image: "/img/products/${imagePath}"
pricing:
  - text: "Contact for pricing"
    price: ""
weight: 100
draft: false
instagram_post: "${post.url}"
instagram_id: "${post.id}"
---

${post.description || 'This beautiful jewelry piece is part of our exclusive collection. Contact us for more details and pricing.'}

## Product Details

- **Source**: Instagram Collection
- **Post ID**: ${post.id}
- **Date Added**: ${post.date}

Contact us to learn more about this piece or to place an order.
`;

    const markdownPath = path.join(productDir, 'index.md');
    fs.writeFileSync(markdownPath, markdownContent);
    
    console.log(`✅ Created product: ${slug}`);
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

  async processPostsAsProducts(posts) {
    console.log(`🏭 Processing ${posts.length} posts as products...`);
    
    const results = [];
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`Processing post ${i + 1}/${posts.length}: ${post.id}`);
      
      try {
        // Download image
        const imageExtension = post.imageUrl.includes('.jpg') ? '.jpg' : '.png';
        const imageName = `${post.id}${imageExtension}`;
        const downloadedImage = await this.downloadImage(post.imageUrl, imageName);
        
        if (downloadedImage) {
          // Create product markdown
          const productSlug = await this.createProductMarkdown(post, downloadedImage);
          
          results.push({
            success: true,
            postId: post.id,
            productSlug: productSlug,
            imagePath: downloadedImage
          });
        } else {
          results.push({
            success: false,
            postId: post.id,
            error: 'Failed to download image'
          });
        }
        
        // Add delay between requests
        await this.page.waitForTimeout(1000);
        
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error);
        results.push({
          success: false,
          postId: post.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Main method to scrape and convert Instagram posts to products
  async scrapeAndCreateProducts(instagramUrl, options = {}) {
    const {
      maxPosts = 20,
      skipExisting = true
    } = options;

    try {
      await this.init();
      
      // Scrape Instagram page
      const posts = await this.scrapeInstagramPage(instagramUrl);
      
      // Limit posts if specified
      const postsToProcess = posts.slice(0, maxPosts);
      
      // Process posts as products
      const results = await this.processPostsAsProducts(postsToProcess);
      
      // Generate summary
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log('\n📊 SUMMARY:');
      console.log(`✅ Successfully created: ${successful.length} products`);
      console.log(`❌ Failed: ${failed.length} posts`);
      
      if (failed.length > 0) {
        console.log('\n❌ Failed posts:');
        failed.forEach(f => {
          console.log(`- ${f.postId}: ${f.error}`);
        });
      }
      
      return {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        results: results
      };
      
    } catch (error) {
      console.error('❌ Fatal error:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Export for use as module
module.exports = InstagramScraper;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📱 Instagram to Products Scraper

Usage: node instagram-scraper.js <instagram-url> [options]

Examples:
  node instagram-scraper.js "https://www.instagram.com/yourbrand/"
  node instagram-scraper.js "https://www.instagram.com/yourbrand/" --max-posts=10
  node instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass

Options:
  --max-posts=N    Maximum number of posts to process (default: 20)
  --skip-existing  Skip existing products (default: true)
  --username=USER  Instagram username for private pages
  --password=PASS  Instagram password for private pages
    `);
    process.exit(1);
  }

  const instagramUrl = args[0];
  const options = {};
  const credentials = {};
  
  // Parse options
  args.slice(1).forEach(arg => {
    if (arg.startsWith('--max-posts=')) {
      options.maxPosts = parseInt(arg.split('=')[1]);
    }
    if (arg === '--no-skip-existing') {
      options.skipExisting = false;
    }
    if (arg.startsWith('--username=')) {
      credentials.username = arg.split('=')[1];
    }
    if (arg.startsWith('--password=')) {
      credentials.password = arg.split('=')[1];
    }
  });

  // Create scraper with credentials if provided
  const scraper = credentials.username && credentials.password 
    ? new InstagramScraper(credentials)
    : new InstagramScraper();
  
  scraper.scrapeAndCreateProducts(instagramUrl, options)
    .then(results => {
      console.log('\n🎉 Scraping completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Scraping failed:', error);
      process.exit(1);
    });
}
