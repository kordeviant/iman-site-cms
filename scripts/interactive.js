#!/usr/bin/env node

/**
 * Complete Instagram to CMS Sync Script
 * This script provides an interactive way to sync Instagram posts with your CMS
 * 
 * Usage:
 *   yarn scrape:interactive              - Run interactive sync
 *   yarn scrape:interactive --clear      - Clear saved login session
 */

const readline = require('readline');
const {InstagramScraper} = require("./instagram-scraper");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function clearSession() {
  console.log('\n🗑️  Instagram Session Cleaner');
  console.log('=============================\n');
  
  const scraper = new InstagramScraper();
  await scraper.clearSavedSession();
  
  console.log('\n✅ Session cleared successfully!');
  console.log('💡 You will need to login again next time you sync a private account.');
  process.exit(0);
}

async function runInteractiveSetup() {
  console.log('\n🎯 Instagram to CMS Sync Tool');
  console.log('==============================\n');

  try {
    // Check if URL was provided as command line argument
    const args = process.argv.slice(2);
    const urlArg = args.find(arg => arg.startsWith('http'));
    
    let instagramUrl;
    if (urlArg) {
      instagramUrl = urlArg;
      console.log(`📱 Using URL from command line: ${instagramUrl}`);
    } else {
      // Get Instagram URL interactively
      instagramUrl = await askQuestion('📱 Enter Instagram page URL (e.g., https://www.instagram.com/yourbrand/): ');
    }
    
    if (!instagramUrl.includes('instagram.com')) {
      console.log('❌ Please enter a valid Instagram URL');
      rl.close();
      return;
    }

    // Ask if it's a private page
    const isPrivate = await askQuestion('🔒 Is this a private Instagram page? (y/N): ');
    
    let credentials = null;
    if (isPrivate.toLowerCase() === 'y' || isPrivate.toLowerCase() === 'yes') {
      console.log('🔐 Private page detected!');
      console.log('💡 You will be able to login manually in the browser when prompted.');
      // Create placeholder credentials to trigger login mode
      credentials = { username: 'manual', password: 'manual' };
    }

    // Explain sync mode
    console.log('\n🔄 COMPLETE PAGE SYNC:');
    console.log('   ✅ Loads ALL posts from the Instagram page');
    console.log('   ✅ Only creates products for NEW posts (prevents duplicates)');
    console.log('   ✅ Downloads profile image and sets as site logo');
    console.log('   ✅ Saves all images to CMS media library');
    console.log('   ✅ Handles modals, captchas, and login automatically');
    console.log('   ✅ Session persistence (login once, stays logged in)');
    console.log('   ✅ Complete CMS integration with proper metadata');
    console.log('   ✅ No duplicate products will be created');
    console.log('   ✅ This ensures your CMS stays in sync with the Instagram page');

    // Confirm settings
    console.log('\n📋 Settings:');
    console.log(`   URL: ${instagramUrl}`);
    console.log(`   Mode: Complete page sync (all posts)`);
    console.log(`   Account type: ${credentials ? 'Private (with login)' : 'Public'}`);
    console.log(`   Duplicate handling: Skip existing products`);
    
    const confirm = await askQuestion('\n✅ Start sync process? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      rl.close();
      return;
    }

    rl.close();

    // Run scraper in sync mode
    console.log('\n🚀 Starting Instagram page sync...');
    if (credentials) {
      console.log('🔐 Will login with provided credentials...');
    }
    console.log('⏰ This may take a few minutes...\n');

    const scraper = new InstagramScraper(credentials);
    
    // Use the main method from the CLI script
    await scraper.init();
    const data = await scraper.scrapeInstagramPage(instagramUrl);
    
    if (data.profile) {
      await scraper.saveProfileInfo(data.profile);
    }
    
    // Sync posts with products (only process new ones)
    const results = await scraper.syncPostsWithProducts(data.posts, data.profile?.username);

    // Close browser
    try {
      await scraper.close();
    } catch (closeError) {
      console.error('⚠️  Could not close browser properly:', closeError.message);
    }

    console.log('\n🎉 Instagram sync completed successfully!');
    console.log(`\n� Sync Results:`);
    console.log(`   Total posts found: ${data.posts?.length || 0}`);
    console.log(`   Profile info saved: ${data.profile ? '✅' : '❌'}`);
    console.log('\n📁 Location of new content:');
    console.log('   • Products: site/content/products/');
    console.log('   • Images: site/static/img/');
    console.log('   • Profile data: site/data/instagram-profile.json');
    console.log('\n💡 Next steps:');
    console.log('   1. Review the synced products in your CMS');
    console.log('   2. Edit product details, pricing, and descriptions');
    console.log('   3. Set draft: false to publish the products');
    console.log('   4. Run your Hugo build to see the updated site');
    console.log('   5. Re-run this script anytime to sync new posts');

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Make sure the Instagram page is accessible');
    console.error('   - Check your internet connection');
    console.error('   - Verify the Instagram URL is correct');
    console.error('   - Try again - sometimes Instagram has temporary issues');
    
    // Try to close browser on error
    try {
      if (scraper) {
        await scraper.close();
      }
    } catch (closeError) {
      console.error('⚠️  Could not close browser properly:', closeError.message);
    }
  } finally {
    rl.close();
  }
}

// Run interactive setup if this file is executed directly
if (require.main === module) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--clear') || args.includes('-c')) {
    clearSession();
  } else {
    runInteractiveSetup();
  }
}

module.exports = { runInteractiveSetup, clearSession };
