const InstagramScraper = require('./instagram-scraper');

// Test script to verify Chrome installation and basic functionality
async function testChromeInstallation() {
  console.log('🧪 Testing Chrome Installation');
  console.log('==============================\n');

  try {
    console.log('1. Testing browser initialization...');
    const scraper = new InstagramScraper();
    await scraper.init();
    
    console.log('✅ Chrome launched successfully!');
    
    console.log('2. Testing page navigation...');
    await scraper.page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
    
    console.log('✅ Page navigation successful!');
    
    console.log('3. Testing basic functionality...');
    const title = await scraper.page.title();
    console.log(`   Page title: ${title}`);
    
    await scraper.close();
    
    console.log('\n🎉 All tests passed! Chrome is working correctly.');
    console.log('👍 Your Instagram scraper should work now.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('Chrome')) {
      console.error('\n🔧 Chrome Installation Issues:');
      console.error('   1. Run: npx puppeteer browsers install chrome');
      console.error('   2. Or try: yarn add puppeteer');
      console.error('   3. Make sure you have enough disk space');
    } else {
      console.error('\n🔧 Other Issues:');
      console.error('   - Check your internet connection');
      console.error('   - Make sure no antivirus is blocking Puppeteer');
      console.error('   - Try running as administrator');
    }
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testChromeInstallation();
}

module.exports = testChromeInstallation;
