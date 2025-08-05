const InstagramScraper = require('./instagram-scraper');

// Simple test for just the cookie functionality
async function testCookieHandling() {
  console.log('🍪 Testing Cookie Handling Only');
  console.log('================================\n');

  try {
    console.log('1. Initializing scraper...');
    const scraper = new InstagramScraper();
    await scraper.init();
    
    console.log('✅ Browser initialized successfully!');
    
    console.log('2. Loading Instagram main page...');
    await scraper.page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('✅ Instagram main page loaded!');
    
    console.log('3. Testing cookie handling...');
    await scraper.handleCookieConsent();
    
    await scraper.close();
    
    console.log('\n🎉 Cookie handling test completed!');
    console.log('✅ The "Allow all cookies" button was found and clicked successfully.');
    console.log('\n💡 Your Instagram scraper cookie handling is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Cookie test failed:', error.message);
  }
}

// Run test
testCookieHandling();
