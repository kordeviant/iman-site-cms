/**
 * Instagram Scraper - Clean Version
 * 
 * Features:
 * - Two-phase approach: Collect all posts first, then process them
 * - Modal-based scraping (no new tabs to avoid timeouts)
 * - Proxy support for localhost:10808
 * - Creates Hugo CMS products without media downloads
 * - Shows all collected post links before processing
 */

const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");

class InstagramScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.userDataDir = "d:\\puppeteer-data";  // Use the persistent data directory
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async init() {
    console.log('🚀 Starting browser...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: this.userDataDir,
      args: [
        '--proxy-server=localhost:10808',  // Your proxy
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
  }

  async scrapeProfile(username) {
    console.log(`🎯 Starting Instagram profile scrape for: ${username}`);
    
    // Load Instagram profile
    console.log('📱 Loading Instagram page...');
    await this.page.goto(`https://www.instagram.com/${username}/`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await this.sleep(3000);

    // Handle cookie popup if present
    console.log('🍪 Checking for cookie popup...');
    try {
      // Wait for cookie popup to appear  
      await this.sleep(3000);
      
      let cookieHandled = false;
      
      // Find and click "Allow all cookies" button by exact text (avoid obfuscated classes)
      cookieHandled = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cookieButton = buttons.find(btn => {
          const text = btn.textContent.trim();
          return text === 'Allow all cookies' || text === 'Allow essential and optional cookies';
        });
        
        if (cookieButton) {
          cookieButton.click();
          return true;
        }
        return false;
      });
      
      if (cookieHandled) {
        console.log('✅ Successfully clicked "Allow all cookies" button');
        await this.sleep(3000);
      } else {
        console.log('⚠️ No "Allow all cookies" button found');
      }
      
    } catch (error) {
      console.log('⚠️ Error handling cookie popup:', error.message);
    }

    // Check if login is needed
    console.log('🔐 Checking if login is needed...');
    const isLoginPage = await this.page.$('input[name="username"]');
    if (isLoginPage) {
      console.log('⚠️ Login required! Please login manually in the browser window.');
      console.log('Press Enter in terminal when you have logged in...');
      
      // Wait for user input
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      // Wait a bit more for page to load after login
      await this.sleep(5000);
    }

    // Wait for posts container - try multiple selectors
    console.log('🔍 Looking for posts container...');
    
    let containerSelector = null;
    const possibleSelectors = [
      'main > div > div > div:nth-child(3)',  // Original selector
      'main article',                        // Direct articles
      '[role="main"] > div',                 // Main content area
      'main section',                        // Main sections
      'main div[style*="flex"]'             // Flex containers in main
    ];
    
    for (const selector of possibleSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        
        // Check if this selector actually contains post links
        const hasLinks = await this.page.evaluate((sel) => {
          const container = document.querySelector(sel);
          if (!container) return false;
          const links = container.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
          return links.length > 0;
        }, selector);
        
        if (hasLinks) {
          containerSelector = selector;
          console.log(`✅ Found posts container with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!containerSelector) {
      console.log('❌ Could not find posts container. The page structure might have changed.');
      return { successful: 0, failed: 0, created: 0 };
    }

    // PHASE 1: Collect posts by scrolling
    console.log('\\n🎯 PHASE 1: Collecting posts by scrolling...');
    
    let allCollectedPosts = [];
    const maxScrolls = 5; // Scroll 5 times to collect many posts
    
    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      console.log(`\\n🔍 Collection scroll ${scroll + 1}/${maxScrolls}...`);
      
      // Get all current posts
      const currentPosts = await this.page.evaluate((containerSel) => {
        const container = document.querySelector(containerSel);
        if (!container) return [];
        
        const links = container.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
        return Array.from(links).map((link, index) => ({
          href: link.href,
          index: index,
          postId: link.href.match(/\/(p|reel)\/([^\/]+)/)?.[2] || 'unknown'
        }));
      }, containerSelector);
      
      // Add new posts to collection (avoiding duplicates)
      const newPostsInThisScroll = currentPosts.filter(
        (post) => !allCollectedPosts.some((existing) => existing.postId === post.postId)
      );
      allCollectedPosts.push(...newPostsInThisScroll);
      
      console.log(`📜 Found ${currentPosts.length} posts in container, ${newPostsInThisScroll.length} new. Total collected: ${allCollectedPosts.length}`);
      
      // Scroll to load more posts (except on last iteration)
      if (scroll < maxScrolls - 1) {
        await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await this.sleep(3000);
      }
    }
    
    // PHASE 2: Log all collected posts
    console.log(`\\n🎯 PHASE 1 COMPLETE: Collected ${allCollectedPosts.length} total unique posts!`);
    console.log('📋 All collected post IDs:');
    allCollectedPosts.forEach((post, i) => {
      console.log(`  ${i + 1}. ${post.postId}`);
    });
    
    console.log('\\n🔄 PHASE 2: Now processing each post in modal...');
    
    const results = { successful: 0, failed: 0, created: 0 };
    
    // Process each post
    for (let i = 0; i < allCollectedPosts.length; i++) {
      const postData = allCollectedPosts[i];
      
      try {
        console.log(`\\n📝 [${i + 1}/${allCollectedPosts.length}] Processing post ${postData.postId}...`);
        
        // Click the post to open modal
        const success = await this.page.evaluate((containerSel, index) => {
          const container = document.querySelector(containerSel);
          if (!container) return false;
          
          const links = container.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
          const element = links[index];
          
          if (element && element.isConnected) {
            element.click();
            return true;
          }
          return false;
        }, containerSelector, postData.index);
        
        if (!success) {
          console.log(`⚠️ Could not find element for ${postData.postId} at index ${postData.index}`);
          results.failed++;
          continue;
        }
        
        // Wait for modal
        await this.sleep(2000);
        await this.page.waitForSelector('[role="dialog"]', { timeout: 10000 });
        await this.sleep(1000);
        
        // Extract post data from modal
        const modalData = await this.page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          if (!modal) return null;
          
          // Get description
          let description = '';
          const textSelectors = [
            '[data-testid="post-description"]',
            'article div[data-testid="caption"]',
            'article span'
          ];
          
          for (const selector of textSelectors) {
            const element = modal.querySelector(selector);
            if (element && element.textContent) {
              const text = element.textContent.trim();
              if (text.length > description.length) {
                description = text;
              }
            }
          }
          
          return { description };
        });
        
        if (modalData) {
          // Create product file
          const productData = {
            title: `Instagram post ${postData.postId}`,
            description: modalData.description || 'Instagram post from our collection',
            date: new Date().toISOString(),
            postId: postData.postId,
            mediaFiles: [] // No media downloads as requested
          };
          
          await this.createCMSProduct(postData.postId, productData);
          results.successful++;
          results.created++;
          console.log(`✅ Created product for ${postData.postId}`);
        } else {
          console.log(`❌ Could not extract data for ${postData.postId}`);
          results.failed++;
        }
        
        // Close modal
        await this.page.keyboard.press('Escape');
        await this.sleep(1000);
        
      } catch (error) {
        console.error(`❌ Error processing post ${postData.postId}:`, error.message);
        results.failed++;
        
        // Try to close modal if it's open
        try {
          await this.page.keyboard.press('Escape');
          await this.sleep(500);
        } catch (e) {
          // Ignore
        }
      }
    }
    
    console.log(`\\n📊 Final Results: ${results.successful} successful, ${results.failed} failed, ${results.created} created`);
    return results;
  }

  async createCMSProduct(postId, productData) {
    const productsDir = path.join(__dirname, '..', 'site', 'content', 'products');
    
    // Ensure products directory exists
    await fs.mkdir(productsDir, { recursive: true });
    
    const frontMatter = `---
title: "${productData.title}"
description: "${productData.description}"
date: "${productData.date}"
postId: "${productData.postId}"
mediaFiles: []
price: 0
category: "Instagram Collection"
in_stock: true
featured: false
---

${productData.description}
`;
    
    const filename = `${postId}.md`;
    const filePath = path.join(productsDir, filename);
    
    await fs.writeFile(filePath, frontMatter);
  }

  async close() {
    if (this.browser) {
      console.log('⏳ Keeping browser open for 10 seconds...');
      await this.sleep(10000);
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('❌ Please provide an Instagram username');
    console.log('Usage: node instagram-scraper.js <username>');
    process.exit(1);
  }

  const scraper = new InstagramScraper();
  
  try {
    await scraper.init();
    const results = await scraper.scrapeProfile(username);
    
    console.log('\\n🎉 Scraping completed!');
    console.log(`✅ Successfully processed: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`🆕 Created products: ${results.created}`);
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
