const InstagramScraper = require('./instagram-scraper');

// Example usage for private Instagram pages
async function scrapePrivatePage() {
  console.log('🔒 Private Instagram Page Scraper Example');
  console.log('=========================================\n');

  // Replace with your actual credentials and target page
  const credentials = {
    username: 'your_instagram_username',  // Replace with your username
    password: 'your_instagram_password'   // Replace with your password
  };

  const instagramUrl = 'https://www.instagram.com/privatepage/'; // Replace with target page
  
  // Options for scraping
  const options = {
    maxPosts: 3,        // Limit to 3 posts for testing
    skipExisting: true  // Skip existing products
  };

  console.log('⚠️  SECURITY WARNING:');
  console.log('   - Never commit real credentials to your repository');
  console.log('   - Use environment variables in production');
  console.log('   - Respect Instagram\'s terms of service\n');

  // Check if credentials are still default values
  if (credentials.username === 'your_instagram_username') {
    console.log('❌ Please update the credentials in this file before running');
    console.log('   Edit private-example.js and replace the placeholder values');
    return;
  }

  const scraper = new InstagramScraper(credentials);

  try {
    console.log(`📱 Target page: ${instagramUrl}`);
    console.log(`👤 Username: ${credentials.username}`);
    console.log(`📋 Options:`, options);
    console.log('');

    const results = await scraper.scrapeAndCreateProducts(instagramUrl, options);

    console.log('\n🎉 Scraping completed!');
    console.log('📊 Final Results:');
    console.log(`   Total processed: ${results.total}`);
    console.log(`   ✅ Successful: ${results.successful}`);
    console.log(`   ❌ Failed: ${results.failed}`);

    if (results.results.length > 0) {
      console.log('\n📝 Individual Results:');
      results.results.forEach((result, index) => {
        if (result.success) {
          console.log(`   ${index + 1}. ✅ ${result.postId} → ${result.productSlug}`);
        } else {
          console.log(`   ${index + 1}. ❌ ${result.postId} → ${result.error}`);
        }
      });
    }

    console.log('\n🏁 Done! Check your site/content/products/ directory for new products.');

  } catch (error) {
    console.error('\n💥 Error running scraper:', error.message);
    
    if (error.message.includes('Login failed')) {
      console.error('\n🔐 Login troubleshooting:');
      console.error('   - Verify your username and password are correct');
      console.error('   - Check if your account requires 2FA');
      console.error('   - Make sure your account is not temporarily locked');
      console.error('   - Try logging in manually first');
    } else {
      console.error('\n🔧 General troubleshooting:');
      console.error('   - Make sure the Instagram URL is correct');
      console.error('   - Check your internet connection');
      console.error('   - Try running with fewer posts first');
      console.error('   - The script runs in visible mode so you can see what\'s happening');
    }
  }
}

// Alternative: Use environment variables for credentials (recommended for automation)
async function scrapeWithEnvCredentials() {
  const credentials = {
    username: process.env.INSTAGRAM_USERNAME,
    password: process.env.INSTAGRAM_PASSWORD
  };

  if (!credentials.username || !credentials.password) {
    console.log('❌ Please set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD environment variables');
    console.log('   Example: set INSTAGRAM_USERNAME=myuser && set INSTAGRAM_PASSWORD=mypass');
    return;
  }

  const scraper = new InstagramScraper(credentials);
  // ... rest of the scraping logic
}

// Run the example if this file is executed directly
if (require.main === module) {
  scrapePrivatePage();
}

module.exports = { scrapePrivatePage, scrapeWithEnvCredentials };
