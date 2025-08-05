const InstagramScraper = require('./instagram-scraper');

// Example usage of the Instagram scraper
async function runExample() {
  console.log('🎯 Instagram Scraper Example');
  console.log('==========================\n');

  // Replace with your actual Instagram URL
  const instagramUrl = 'https://www.instagram.com/yourbrand/';
  
  // Options for scraping
  const options = {
    maxPosts: 5,        // Limit to 5 posts for testing
    skipExisting: true  // Skip existing products
  };

  const scraper = new InstagramScraper();

  try {
    console.log(`📱 Starting to scrape: ${instagramUrl}`);
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
    console.error('\nTroubleshooting tips:');
    console.error('1. Make sure the Instagram URL is correct and public');
    console.error('2. Check your internet connection');
    console.error('3. Try running with fewer posts first');
    console.error('4. Set headless: false in the scraper to debug visually');
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}

module.exports = runExample;
