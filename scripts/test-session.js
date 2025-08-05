const InstagramScraper = require('./instagram-scraper');

// Test session persistence functionality
async function testSessionPersistence() {
  console.log('🔄 Testing Session Persistence');
  console.log('===============================\n');

  // Test credentials (placeholder to trigger session functionality)
  const testCredentials = {
    username: 'test',
    password: 'test'
  };

  try {
    console.log('1. Creating scraper with session support...');
    const scraper = new InstagramScraper(testCredentials);
    
    console.log('2. Initializing browser...');
    await scraper.init();
    
    console.log('\n📋 Session Test Options:');
    console.log('   A. Login manually and save session');
    console.log('   B. Test loading existing session');
    console.log('   C. Clear saved session');
    console.log('\nThis test will demonstrate session persistence.');
    console.log('After logging in once, future runs will automatically');
    console.log('restore your session without requiring manual login.\n');
    
    // Test session loading
    console.log('🔍 Testing session loading...');
    const sessionExists = await scraper.loadSession();
    
    if (sessionExists) {
      console.log('✅ Session loaded successfully!');
      console.log('🎯 You are already logged in from a previous session.');
    } else {
      console.log('ℹ️  No existing session found.');
      console.log('👤 You would need to log in manually to create a session.');
    }
    
    await scraper.close();
    
    console.log('\n📖 How Session Persistence Works:');
    console.log('   1. First time: Login manually via browser UI');
    console.log('   2. Script saves cookies and session info');
    console.log('   3. Next time: Script automatically restores session');
    console.log('   4. Sessions expire after 24 hours for security');
    console.log('\n💡 Benefits:');
    console.log('   ✅ Login once, stay logged in');
    console.log('   ✅ No repeated manual logins');
    console.log('   ✅ Faster subsequent runs');
    console.log('   ✅ More convenient for automation');
    
  } catch (error) {
    console.error('\n❌ Session test failed:', error.message);
  }
}

// Add session management commands
if (process.argv.includes('--clear-session')) {
  console.log('🗑️  Clearing saved session...');
  const scraper = new InstagramScraper();
  scraper.clearSession();
  console.log('✅ Session cleared!');
  process.exit(0);
}

// Run test
if (require.main === module) {
  testSessionPersistence();
}

module.exports = testSessionPersistence;
