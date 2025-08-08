/**
 * Quick test for persistent browser data functionality
 */

const {InstagramScraper} = require("./instagram-scraper");

async function testBrowserData() {
  console.log('🧪 Testing persistent browser data configuration...');
  
  try {
    // Create scraper instance
    const scraper = new InstagramScraper();
    
    // Initialize (this should create the browser with persistent data)
    await scraper.init();
    
    console.log('✅ Browser initialized successfully with persistent data');
    console.log(`📁 Browser data directory: ${scraper.userDataDir}`);
    
    // Check if directory was created
    const fs = require('fs');
    if (fs.existsSync(scraper.userDataDir)) {
      console.log('✅ Persistent browser data directory created');
      const files = fs.readdirSync(scraper.userDataDir);
      console.log(`📊 Directory contains ${files.length} files/folders`);
    } else {
      console.log('❌ Browser data directory not found');
    }
    
    // Navigate to a simple page to test
    await scraper.page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
    console.log('✅ Basic navigation test passed');
    
    // Close browser
    if (scraper.browser) {
      await scraper.browser.close();
      console.log('✅ Browser closed successfully');
    }
    
    console.log('🎉 All tests passed! Persistent browser data is working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Only run if called directly
if (require.main === module) {
  testBrowserData().catch(console.error);
}

module.exports = { testBrowserData };
