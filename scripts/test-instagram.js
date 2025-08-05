const InstagramScraper = require('./instagram-scraper');

// Test Instagram connection and cookie handling
async function testInstagramConnection() {
  console.log('🧪 Testing Instagram Connection');
  console.log('===============================\n');

  try {
    console.log('1. Initializing scraper...');
    const scraper = new InstagramScraper();
    await scraper.init();
    
    console.log('✅ Browser initialized successfully!');
    
    console.log('2. Testing Instagram main page...');
    await scraper.page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    console.log('✅ Instagram main page loaded!');
    
    console.log('3. Testing cookie handling...');
    await scraper.handleCookieConsent();
    
    console.log('4. Testing login page access...');
    await scraper.page.goto('https://www.instagram.com/accounts/login/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    console.log('✅ Login page loaded successfully!');
    
    // Check if login form is present
    const usernameField = await scraper.page.$('input[name="username"]');
    const passwordField = await scraper.page.$('input[name="password"]');
    
    if (usernameField && passwordField) {
      console.log('✅ Login form found!');
    } else {
      console.log('⚠️  Login form not found, but page loaded');
    }
    
    await scraper.close();
    
    console.log('\n🎉 All Instagram connection tests passed!');
    console.log('🌟 Your Instagram scraper should work now.');
    console.log('\n💡 Next steps:');
    console.log('   - Try: yarn scrape:interactive');
    console.log('   - Or use the command line version with your Instagram URL');
    
  } catch (error) {
    console.error('\n❌ Instagram connection test failed:', error.message);
    
    if (error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('net::')) {
      console.error('\n🌐 Connection Issues:');
      console.error('   1. Check your internet connection');
      console.error('   2. Try using a VPN if Instagram is blocked');
      console.error('   3. Check your firewall/antivirus settings');
      console.error('   4. Try again later (Instagram might be temporarily blocking)');
    } else if (error.message.includes('timeout')) {
      console.error('\n⏰ Timeout Issues:');
      console.error('   - Your connection might be slow');
      console.error('   - Try running again');
      console.error('   - Instagram servers might be slow');
    } else {
      console.error('\n🔧 Other Issues:');
      console.error('   - Instagram might have changed their layout');
      console.error('   - Try running with different browser flags');
      console.error('   - Check if Instagram is accessible in your browser manually');
    }
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testInstagramConnection();
}

module.exports = testInstagramConnection;
