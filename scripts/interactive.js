#!/usr/bin/env node

/**
 * Quick start script for Instagram scraping
 * This script provides an interactive way to run the Instagram scraper
 */

const readline = require('readline');
const InstagramScraper = require('./instagram-scraper');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function runInteractiveSetup() {
  console.log('\n🎯 Instagram to Products Scraper');
  console.log('==================================\n');

  try {
    // Get Instagram URL
    const instagramUrl = await askQuestion('📱 Enter Instagram page URL (e.g., https://www.instagram.com/yourbrand/): ');
    
    if (!instagramUrl.includes('instagram.com')) {
      console.log('❌ Please enter a valid Instagram URL');
      rl.close();
      return;
    }

    // Ask if it's a private page
    const isPrivate = await askQuestion('🔒 Is this a private Instagram page? (y/N): ');
    
    let credentials = null;
    if (isPrivate.toLowerCase() === 'y' || isPrivate.toLowerCase() === 'yes') {
      const username = await askQuestion('👤 Enter your Instagram username: ');
      const password = await askQuestion('🔑 Enter your Instagram password: ');
      
      if (username && password) {
        credentials = { username, password };
      } else {
        console.log('❌ Username and password are required for private pages');
        rl.close();
        return;
      }
    }

    // Get number of posts
    const maxPostsInput = await askQuestion('📊 Maximum number of posts to scrape (default: 10): ');
    const maxPosts = parseInt(maxPostsInput) || 10;

    // Confirm settings
    console.log('\n📋 Settings:');
    console.log(`   URL: ${instagramUrl}`);
    console.log(`   Max posts: ${maxPosts}`);
    console.log(`   Account type: ${credentials ? 'Private (with login)' : 'Public'}`);
    
    const confirm = await askQuestion('\n✅ Start scraping? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      rl.close();
      return;
    }

    rl.close();

    // Run scraper
    console.log('\n🚀 Starting Instagram scraper...');
    if (credentials) {
      console.log('🔐 Will login with provided credentials...');
    }
    console.log('⏰ This may take a few minutes...\n');

    const scraper = new InstagramScraper(credentials);
    const results = await scraper.scrapeAndCreateProducts(instagramUrl, {
      maxPosts: maxPosts,
      skipExisting: true
    });

    console.log('\n🎉 Scraping completed successfully!');
    console.log('\n📁 New products created in: site/content/products/');
    console.log('🖼️  Images saved to: site/static/img/products/');
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated products in your CMS');
    console.log('   2. Edit product details, pricing, and descriptions');
    console.log('   3. Set draft: false to publish the products');
    console.log('   4. Run your Hugo build to see the new products on your site');

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Make sure the Instagram page is public');
    console.error('   - Check your internet connection');
    console.error('   - Try with a smaller number of posts first');
  } finally {
    rl.close();
  }
}

// Run interactive setup if this file is executed directly
if (require.main === module) {
  runInteractiveSetup();
}

module.exports = runInteractiveSetup;
