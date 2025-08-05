const InstagramScraper = require('./instagram-scraper');

async function testLoginOnly() {
  console.log('🧪 Testing login functionality only...');
  
  const scraper = new InstagramScraper({
    username: 'manual', // Placeholder for interactive mode
    password: 'manual'  // Placeholder for interactive mode
  });
  
  try {
    // Initialize browser
    await scraper.init();
    console.log('✅ Browser initialized successfully');
    
    // Attempt login
    console.log('🔐 Starting login process...');
    const loginSuccess = await scraper.login();
    
    if (loginSuccess) {
      console.log('🎉 Login completed successfully!');
      console.log('📊 Session Status:');
      console.log(`   - Logged in: ${scraper.isLoggedIn}`);
      console.log(`   - Current URL: ${scraper.page.url()}`);
      
      // Wait a bit to see if the session sticks
      console.log('⏳ Waiting 10 seconds to test session stability...');
      await scraper.wait(10000);
      
      console.log('✅ Session appears stable!');
      console.log('💡 You can now run the full scraper with: yarn scrape:interactive');
      
      // Keep browser open for user to verify
      console.log('\n🔍 Browser will stay open for you to verify login state');
      console.log('👀 Check that you can see the Instagram home page');
      console.log('🔄 Press Ctrl+C when you want to close the browser');
      
      // Wait indefinitely until user closes
      await new Promise(() => {}); // This will keep running until user presses Ctrl+C
      
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('💥 Error during login test:', error.message);
    console.error('🔍 Full error:', error);
    
    // Keep browser open for debugging
    console.log('\n🔍 Browser will stay open for debugging');
    console.log('🔄 Press Ctrl+C when you want to close');
    await new Promise(() => {}); // Keep running
    
  } finally {
    // This won't run until Ctrl+C is pressed
    console.log('🔄 Cleaning up...');
    await scraper.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Received interrupt signal, closing browser...');
  process.exit(0);
});

// Run the test
testLoginOnly();
