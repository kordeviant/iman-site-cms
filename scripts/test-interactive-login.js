const InstagramScraper = require('./instagram-scraper');

// Test interactive login functionality
async function testInteractiveLogin() {
  console.log('🎯 Testing Interactive Login');
  console.log('============================\n');

  // Test credentials - these will be used to start the login process
  const testCredentials = {
    username: 'test', // Just placeholder to trigger interactive mode
    password: 'test'  // Just placeholder to trigger interactive mode
  };

  try {
    console.log('1. Creating scraper with interactive login...');
    const scraper = new InstagramScraper(testCredentials);
    
    console.log('2. Initializing browser...');
    await scraper.init();
    
    console.log('3. Starting interactive login process...');
    console.log('   📌 A browser window will open');
    console.log('   📌 The script will navigate to Instagram login page');
    console.log('   📌 Then you can manually complete the login');
    console.log('   📌 The script will wait and detect when you\'re logged in\n');
    
    // This will open the browser and wait for manual login
    const loginSuccess = await scraper.login();
    
    if (loginSuccess) {
      console.log('\n🎉 Interactive login test completed successfully!');
      console.log('✅ The script can now proceed with scraping private pages');
    } else {
      console.log('\n❌ Login was skipped or failed');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('\n❌ Interactive login test failed:', error.message);
    
    if (error.message.includes('timeout')) {
      console.error('\n⏰ Login Timeout:');
      console.error('   - You have 5 minutes to complete the login');
      console.error('   - Make sure to fully complete the login process');
      console.error('   - Wait until you see the Instagram home page');
    } else {
      console.error('\n🔧 Other Issues:');
      console.error('   - Make sure the browser window is visible');
      console.error('   - Check your internet connection');
      console.error('   - Try running the test again');
    }
  }
}

// Run test
if (require.main === module) {
  testInteractiveLogin();
}

module.exports = testInteractiveLogin;
