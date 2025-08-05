const InstagramScraper = require('./instagram-scraper');

async function diagnosePage() {
  console.log('🔍 Instagram Page Diagnostic Tool');
  console.log('==================================');
  
  const scraper = new InstagramScraper({
    username: 'manual',
    password: 'manual'
  });
  
  try {
    await scraper.init();
    
    // Navigate to the page
    const testUrl = 'https://www.instagram.com/6_side_jewelry';
    console.log(`📱 Navigating to ${testUrl}...`);
    
    await scraper.page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await scraper.wait(5000);
    await scraper.handleCookieConsent();
    await scraper.autoScroll();
    
    console.log('🔍 Analyzing page structure...');
    
    // Get page information
    const pageInfo = await scraper.page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        totalElements: document.querySelectorAll('*').length,
        images: document.querySelectorAll('img').length,
        links: document.querySelectorAll('a').length,
        articles: document.querySelectorAll('article').length,
        divs: document.querySelectorAll('div').length
      };
      
      // Look for potential post containers
      const potentialPostElements = [];
      
      // Check various selectors
      const selectors = [
        'a[href*="/p/"]',
        'a[href*="/reel/"]', 
        'article',
        'div[role="button"]',
        'div[tabindex="0"]',
        '[data-testid]',
        'img[alt]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          potentialPostElements.push({
            selector: selector,
            count: elements.length,
            examples: Array.from(elements).slice(0, 3).map(el => ({
              tagName: el.tagName,
              href: el.href || 'N/A',
              src: el.src || 'N/A',
              alt: el.alt || 'N/A',
              textContent: el.textContent?.substring(0, 100) || 'N/A',
              className: el.className || 'N/A',
              dataset: el.dataset ? JSON.stringify(el.dataset) : 'N/A'
            }))
          });
        }
      });
      
      info.potentialPostElements = potentialPostElements;
      
      // Get all links with instagram.com in them
      const instagramLinks = Array.from(document.querySelectorAll('a')).filter(a => 
        a.href && (a.href.includes('/p/') || a.href.includes('/reel/'))
      ).map(a => ({
        href: a.href,
        textContent: a.textContent?.substring(0, 50) || '',
        className: a.className || '',
        parentElement: a.parentElement?.tagName || ''
      }));
      
      info.instagramLinks = instagramLinks.slice(0, 10); // First 10 only
      
      // Get page text to see if there are error messages
      const bodyText = document.body.textContent || '';
      info.containsErrorMessages = {
        privateAccount: bodyText.includes('This Account is Private'),
        notFound: bodyText.includes('Sorry, this page'),
        loginRequired: bodyText.includes('Log in to see'),
        restricted: bodyText.includes('restricted')
      };
      
      return info;
    });
    
    console.log('📊 Page Analysis Results:');
    console.log('========================');
    console.log(`🌐 URL: ${pageInfo.url}`);
    console.log(`📄 Title: ${pageInfo.title}`);
    console.log(`🧩 Total elements: ${pageInfo.totalElements}`);
    console.log(`🖼️  Images: ${pageInfo.images}`);
    console.log(`🔗 Links: ${pageInfo.links}`);
    console.log(`📰 Articles: ${pageInfo.articles}`);
    console.log(`📦 Divs: ${pageInfo.divs}`);
    
    console.log('\n🔍 Error Messages Check:');
    Object.entries(pageInfo.containsErrorMessages).forEach(([key, value]) => {
      console.log(`   ${value ? '❌' : '✅'} ${key}: ${value}`);
    });
    
    console.log('\n🎯 Potential Post Elements:');
    pageInfo.potentialPostElements.forEach(item => {
      console.log(`\n📌 Selector: ${item.selector}`);
      console.log(`   Count: ${item.count}`);
      if (item.examples.length > 0) {
        console.log('   Examples:');
        item.examples.forEach((example, i) => {
          console.log(`     ${i + 1}. ${example.tagName}`);
          if (example.href !== 'N/A') console.log(`        href: ${example.href}`);
          if (example.src !== 'N/A') console.log(`        src: ${example.src}`);
          if (example.alt !== 'N/A') console.log(`        alt: ${example.alt}`);
          if (example.className !== 'N/A') console.log(`        class: ${example.className}`);
        });
      }
    });
    
    console.log('\n🔗 Instagram Post Links Found:');
    if (pageInfo.instagramLinks.length > 0) {
      pageInfo.instagramLinks.forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.href}`);
        console.log(`      Text: ${link.textContent}`);
        console.log(`      Class: ${link.className}`);
        console.log(`      Parent: ${link.parentElement}`);
      });
    } else {
      console.log('   ❌ No Instagram post links found!');
    }
    
    console.log('\n🖼️  Taking screenshot for visual inspection...');
    await scraper.page.screenshot({ 
      path: 'scripts/page-diagnostic.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot saved as: scripts/page-diagnostic.png');
    
    console.log('\n🔄 Browser will stay open for manual inspection');
    console.log('👀 You can inspect the page manually to find post elements');
    console.log('🔄 Press Ctrl+C when done');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  } finally {
    // Won't run until Ctrl+C
    await scraper.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Closing diagnostic tool...');
  process.exit(0);
});

diagnosePage();
