const puppeteer = require('../node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

class FastInstagramScraper {
  constructor() {
    this.userDataDir = 'd:\\puppeteer-data';
    this.outputDir = path.join(__dirname, '../site/static/img');
    this.productsDir = path.join(__dirname, '../site/static/img/products');
    
    // Create directories if they don't exist
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, {recursive: true});
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, {recursive: true});
    }
    if (!fs.existsSync(this.productsDir)) {
      fs.mkdirSync(this.productsDir, {recursive: true});
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeYaml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Remove problematic characters and normalize text
    const cleaned = text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // Remove bidirectional text markers
      .replace(/[\u2028\u2029]/g, ' ') // Replace line/paragraph separators with space
      .replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ') // Replace line breaks
      .replace(/\t/g, ' ') // Replace tabs
      .replace(/"/g, '\\"') // Escape quotes
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/:/g, '\\:') // Escape colons
      .replace(/\[/g, '\\[').replace(/\]/g, '\\]') // Escape brackets
      .replace(/\{/g, '\\{').replace(/\}/g, '\\}') // Escape braces
      .replace(/\|/g, '\\|') // Escape pipes
      .replace(/>/g, '\\>') // Escape greater than
      .replace(/#/g, '\\#') // Escape hash
      .replace(/&/g, '\\&') // Escape ampersand
      .replace(/\*/g, '\\*') // Escape asterisk
      .replace(/!/g, '\\!') // Escape exclamation
      .replace(/'/g, "\\'") // Escape single quotes
      .replace(/`/g, '\\`') // Escape backticks
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
    
    // Limit length to prevent extremely long content
    return cleaned.length > 500 ? cleaned.substring(0, 500) + '...' : cleaned;
  }

  async initBrowser() {
    console.log('🚀 Starting browser for fast scraping...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: this.userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--proxy-server=localhost:10808',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run'
      ],
      defaultViewport: {width: 1280, height: 720}
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  async navigateToProfile(username) {
    console.log(`📱 Loading Instagram profile: ${username}`);
    
    const url = `https://www.instagram.com/${username}/`;
    await this.page.goto(url, {waitUntil: "domcontentloaded", timeout: 30000});
    
    // Handle cookies if needed
    try {
      await this.page.waitForSelector('button', {timeout: 3000});
      const cookieButtons = await this.page.$$('button');
      for (const button of cookieButtons) {
        const text = await this.page.evaluate(el => el.textContent, button);
        if (text && (text.includes('Accept') || text.includes('Allow'))) {
          await button.click();
          await this.sleep(1000);
          break;
        }
      }
    } catch (e) {
      console.log('ℹ️ No cookie popup found');
    }
    
    // Check if login is needed
    if (this.page.url().includes('/accounts/login')) {
      console.log('⏳ Login required. Please login manually and the script will continue...');
      await this.page.waitForFunction(
        () => !window.location.href.includes('/accounts/login'),
        {timeout: 300000}
      );
      console.log('✅ Login successful!');
    }
  }

  async getAllPostUrls(username) {
    console.log("📑 Fast collection of all post URLs...");
    
    const postUrls = new Set();
    let previousCount = 0;
    let noNewPostsCount = 0;
    
    // Wait for posts to load
    await this.page.waitForSelector('article, main', {timeout: 10000});
    
    while (noNewPostsCount < 3) {
      // Extract all post URLs from current view
      const newUrls = await this.page.evaluate(() => {
        const urls = new Set();
        
        // Find all post links
        const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
        
        links.forEach(link => {
          const href = link.href;
          if (href && (href.includes('/p/') || href.includes('/reel/'))) {
            urls.add(href);
          }
        });
        
        return Array.from(urls);
      });
      
      // Add new URLs to our set
      newUrls.forEach(url => postUrls.add(url));
      
      console.log(`📊 Found ${postUrls.size} posts so far...`);
      
      // Check if we found new posts
      if (postUrls.size === previousCount) {
        noNewPostsCount++;
        console.log(`⚠️ No new posts found (${noNewPostsCount}/3)`);
      } else {
        noNewPostsCount = 0;
        previousCount = postUrls.size;
      }
      
      // Scroll down to load more posts
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content to load
      await this.sleep(2000);
    }
    
    const urlArray = Array.from(postUrls);
    console.log(`✅ Collected ${urlArray.length} total post URLs`);
    return urlArray;
  }

  async scrapePostFast(postUrl, index, totalPosts) {
    console.log(`\\n📄 [${index + 1}/${totalPosts}] Fast scraping: ${postUrl}`);
    
    let postPage = null;
    try {
      // Create new page for this post
      postPage = await this.browser.newPage();
      await postPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to post
      await postPage.goto(postUrl, {waitUntil: "domcontentloaded", timeout: 15000});
      
      // Wait for content to load
      await postPage.waitForSelector('article, main', {timeout: 10000});
      
      // Extract all media URLs and caption
      const postData = await postPage.evaluate(() => {
        const data = {
          mediaUrls: [],
          caption: '',
          postId: ''
        };
        
        // Get post ID from URL
        const urlParts = window.location.href.split('/');
        const pIndex = urlParts.findIndex(part => part === 'p' || part === 'reel');
        if (pIndex !== -1 && urlParts[pIndex + 1]) {
          data.postId = urlParts[pIndex + 1];
        }
        
        // Find all images in the post
        const images = document.querySelectorAll('img[src*="scontent"]');
        const imageUrls = new Set();
        
        images.forEach(img => {
          const rect = img.getBoundingClientRect();
          // Only include large images (likely content, not avatars)
          if (rect.width > 150 && rect.height > 150 && img.src && !img.src.includes('data:')) {
            imageUrls.add(img.src);
          }
        });
        
        data.mediaUrls = Array.from(imageUrls);
        
        // Get caption
        const captionElements = document.querySelectorAll('meta[property="og:description"]');
        if (captionElements.length > 0) {
          data.caption = captionElements[0].content || '';
        }
        
        // Try alternative caption selectors
        if (!data.caption) {
          const spans = document.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent || '';
            if (text.length > 20 && text.length < 2000) {
              data.caption = text;
              break;
            }
          }
        }
        
        return data;
      });
      
      if (!postData.postId) {
        console.log(`⚠️ Could not extract post ID from ${postUrl}`);
        return {success: false, error: 'No post ID found'};
      }
      
      if (postData.mediaUrls.length === 0) {
        console.log(`⚠️ No media found for post ${postData.postId}`);
        return {success: false, error: 'No media found'};
      }
      
      console.log(`📸 Found ${postData.mediaUrls.length} images for post ${postData.postId}`);
      
      // Download all media files
      const downloadedMedia = [];
      for (let i = 0; i < postData.mediaUrls.length; i++) {
        const mediaUrl = postData.mediaUrls[i];
        const fileName = `${postData.postId}_${i + 1}.jpg`;
        const filePath = path.join(this.productsDir, fileName);
        
        // Skip if already exists
        if (fs.existsSync(filePath)) {
          console.log(`⏭️ Skipping existing: ${fileName}`);
          downloadedMedia.push({
            fileName: fileName,
            filePath: `/img/products/${fileName}`,
            isVideo: false,
            originalUrl: mediaUrl
          });
          continue;
        }
        
        try {
          // Download using a fresh page to avoid navigation issues
          const downloadPage = await this.browser.newPage();
          const response = await downloadPage.goto(mediaUrl, {timeout: 10000});
          
          if (response && response.ok()) {
            const buffer = await response.buffer();
            fs.writeFileSync(filePath, buffer);
            
            downloadedMedia.push({
              fileName: fileName,
              filePath: `/img/products/${fileName}`,
              isVideo: false,
              originalUrl: mediaUrl
            });
            
            console.log(`✅ Downloaded: ${fileName}`);
          } else {
            console.log(`❌ Failed to download: ${fileName}`);
          }
          
          await downloadPage.close();
        } catch (downloadError) {
          console.log(`❌ Download error for ${fileName}: ${downloadError.message}`);
        }
      }
      
      // Create product markdown if we have media
      if (downloadedMedia.length > 0) {
        await this.createProductMarkdown(postData.postId, postData.caption, downloadedMedia, index);
        console.log(`✅ Created product for post ${postData.postId} with ${downloadedMedia.length} images`);
        return {success: true, isUpdate: false, mediaCount: downloadedMedia.length};
      } else {
        return {success: false, error: 'No media downloaded'};
      }
      
    } catch (error) {
      console.log(`❌ Error scraping post ${index + 1}: ${error.message}`);
      return {success: false, error: error.message};
    } finally {
      if (postPage) {
        await postPage.close();
      }
    }
  }

  async createProductMarkdown(postId, caption, downloadedMedia, index) {
    const safePostId = postId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const productDir = path.join(__dirname, '../site/content/products', safePostId);
    
    if (!fs.existsSync(productDir)) {
      fs.mkdirSync(productDir, {recursive: true});
    }
    
    const images = downloadedMedia.filter(media => !media.isVideo);
    const imageList = images.map(media => `  - ${media.filePath}`).join('\\n');
    
    const title = this.escapeYaml(caption).substring(0, 100) || `Product ${index + 1}`;
    const description = this.escapeYaml(caption) || 'Beautiful jewelry piece from 6side jewelry collection';
    
    const markdownContent = `---
title: "${title}"
date: ${new Date().toISOString().split('T')[0]}
image: ${images[0]?.filePath || '/img/products/default.jpg'}
images:
${imageList}
price: "قیمت تماس"
type: "jewelry"
weight: ""
material: ""
tags:
  - "jewelry"
  - "handmade"
  - "persian"
description: "${description}"
---

${description}

## مشخصات محصول

- **نوع**: جواهرات دست‌ساز
- **وزن**: قابل استعلام
- **جنس**: طلا و نقره
- **قیمت**: تماس بگیرید

## تصاویر

${images.map((img, i) => `![تصویر ${i + 1}](${img.filePath})`).join('\\n\\n')}

برای اطلاعات بیشتر و سفارش با ما تماس بگیرید.
`;

    const markdownPath = path.join(productDir, 'index.md');
    fs.writeFileSync(markdownPath, markdownContent);
  }

  async scrapeAllPosts(postUrls) {
    console.log(`\\n🚀 Fast batch processing ${postUrls.length} posts...`);
    
    const results = {successful: 0, failed: 0, totalImages: 0, errors: []};
    const batchSize = 20; // Increased batch size for speed
    
    // Process in batches
    for (let i = 0; i < postUrls.length; i += batchSize) {
      const batch = postUrls.slice(i, i + batchSize);
      console.log(`\\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(postUrls.length/batchSize)}`);
      
      // Process batch concurrently
      const batchPromises = batch.map((postUrl, index) => 
        this.scrapePostFast(postUrl, i + index, postUrls.length)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((result, index) => {
        const postUrl = batch[index];
        
        if (result.status === 'fulfilled' && result.value.success) {
          results.successful++;
          results.totalImages += result.value.mediaCount || 0;
        } else {
          results.failed++;
          const error = result.status === 'rejected' 
            ? result.reason?.message || 'Unknown error'
            : result.value.error;
          results.errors.push({url: postUrl, error});
        }
      });
      
      // Brief pause between batches
      if (i + batchSize < postUrls.length) {
        console.log('⏳ Brief pause before next batch...');
        await this.sleep(2000);
      }
    }
    
    console.log(`\\n📊 Fast Scraping Results:`);
    console.log(`✅ Successful posts: ${results.successful}`);
    console.log(`📸 Total images downloaded: ${results.totalImages}`);
    console.log(`❌ Failed posts: ${results.failed}`);
    
    return results;
  }

  async scrapeProfile(username) {
    try {
      console.log(`🚀 Starting FAST Instagram scrape for: ${username}`);
      
      await this.initBrowser();
      await this.navigateToProfile(username);
      
      const postUrls = await this.getAllPostUrls(username);
      
      if (postUrls.length > 0) {
        const results = await this.scrapeAllPosts(postUrls);
        console.log(`\\n🎉 Fast scraping completed! Downloaded ${results.totalImages} images from ${results.successful} posts`);
      } else {
        console.log('⚠️ No posts found to scrape');
      }
      
    } catch (error) {
      console.error('❌ Fast scraping error:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Main execution
if (require.main === module) {
  const username = '6_side_jewelry';
  const scraper = new FastInstagramScraper();
  scraper.scrapeProfile(username);
}

module.exports = FastInstagramScraper;
