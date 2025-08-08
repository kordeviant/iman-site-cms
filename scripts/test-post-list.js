#!/usr/bin/env node

/**
 * Test script to just load and list all posts from Instagram page
 * This is a simplified version that only gets the post list without processing them
 */

const {InstagramScraper} = require("./instagram-scraper");

async function testPostList() {
  console.log('🧪 Testing Instagram Post List Extraction');
  console.log('==========================================\n');

  const scraper = new InstagramScraper({ username: 'manual', password: 'manual' });
  
  try {
    // Initialize browser
    await scraper.init();
    
    // Navigate to Instagram page
    const instagramUrl = "https://www.instagram.com/6_side_jewelry/";
    console.log(`📱 Navigating to: ${instagramUrl}`);
    
    // Navigate directly to the target page
    await scraper.page.goto(instagramUrl, { 
      waitUntil: "networkidle0",
      timeout: 60000
    });
    
    await scraper.wait(3000);
    
    // Check if we're logged in
    const isLoggedIn = await scraper.checkLoginStatus();
    if (!isLoggedIn) {
      console.log("❌ Not logged in, please login manually first");
      return;
    }
    
    console.log("✅ Already logged in!");
    
    // Load all posts (this will print the complete list)
    const posts = await scraper.loadAllPosts();
    
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`Total unique posts found: ${posts.length}`);
    console.log(`Posts: ${posts.map(p => p.id).join(', ')}`);
    
    // Check existing products
    console.log(`\n🔍 Checking existing products...`);
    const existingIds = await scraper.getExistingProductIds();
    console.log(`📊 Found ${existingIds.size} existing products: ${Array.from(existingIds).join(', ')}`);
    
    // Filter new posts
    const newPosts = posts.filter(post => !existingIds.has(post.id));
    console.log(`📊 New posts to process: ${newPosts.length}`);
    console.log(`New post IDs: ${newPosts.map(p => p.id).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    try {
      await scraper.close();
    } catch (e) {
      console.log("⚠️ Could not close browser properly");
    }
  }
}

if (require.main === module) {
  testPostList();
}

module.exports = { testPostList };
