const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class SimpleInstagramScraper {
  constructor() {
    this.userDataDir = 'd:\\puppeteer-data';
    this.outputDir = path.join(__dirname, '../site/static/img');
    this.productsDir = path.join(__dirname, '../site/static/img/products');
    
    // Create directories if they don't exist
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, {recursive: true});
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, {recursive: true});
    }
    if (!fs.existsSync(this.productsDir)) {
      fs.mkdirSync(this.productsDir, {recursive: true});
    }
  }

  // Helper function to wait/sleep
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initBrowser() {
    console.log('🚀 Starting browser...');
    
    this.browser = await puppeteer.launch({
      headless: false, // Keep visible so user can interact
      userDataDir: this.userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--proxy-server=localhost:10808'
      ],
      defaultViewport: {width: 1280, height: 720}
    });

    this.page = await this.browser.newPage();
    
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  async handleCookies() {
    console.log('🍪 Checking for cookie popup...');
    
    try {
      // Wait a bit for the page to load
      await this.sleep(3000);
      
      // Look for common cookie buttons
      const cookieSelectors = [
        'button[data-cookiebanner="accept_button"]',
        'button:contains("Accept")',
        'button:contains("Allow")',
        'button:contains("Accept All")',
        '[data-testid="cookie-banner"] button',
        '._a9-- button', // Instagram cookie button
        'button._a9_1'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            console.log('✅ Found cookie button, clicking...');
            await button.click();
            await this.sleep(1000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.log('ℹ️  No cookie popup found or already handled');
    }
  }

  async waitForLogin(username) {
    console.log('🔐 Checking if login is needed...');
    
    const currentUrl = this.page.url();
    
    // If we're on login page, wait for user to login
    if (currentUrl.includes('/accounts/login') || currentUrl.includes('/login')) {
      console.log('⏳ Login required. Please login manually in the browser...');
      console.log('💡 The script will continue once you\'re redirected back to the profile page');
      
      // Wait for navigation away from login page
      await this.page.waitForFunction(
        () => !window.location.href.includes('/accounts/login') && !window.location.href.includes('/login'),
        {timeout: 300000} // 5 minutes timeout
      );
      
      console.log('✅ Login successful! Continuing...');
    }
    
    // Navigate to the profile page if not already there
    const targetUrl = `https://www.instagram.com/${username}/`;
    if (!this.page.url().includes(`/${username}/`)) {
      console.log(`📱 Navigating to ${targetUrl}...`);
      await this.page.goto(targetUrl, {waitUntil: 'networkidle0'});
    }
  }

  async getProfileImage(username) {
    console.log('🖼️  Looking for profile image...');
    
    try {
      // Wait for profile image to load
      await this.page.waitForSelector('img', {timeout: 10000});
      
      // Look for profile image with various selectors
      const profileImageSelectors = [
        `img[alt*="${username}"]`,
        'img[data-testid="user-avatar"]',
        'header img',
        '._aadp img', // Instagram profile image
        'img[src*="profile"]'
      ];
      
      let profileImageElement = null;
      
      for (const selector of profileImageSelectors) {
        try {
          profileImageElement = await this.page.$(selector);
          if (profileImageElement) {
            console.log(`✅ Found profile image with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!profileImageElement) {
        console.log('❌ Profile image not found. Trying to get the largest image...');
        // Get all images and find the likely profile image
        const images = await this.page.$$('img');
        if (images.length > 0) {
          profileImageElement = images[0]; // Take first image as fallback
        }
      }
      
      if (profileImageElement) {
        // Get image source
        const imageSrc = await this.page.evaluate(img => img.src, profileImageElement);
        console.log(`📥 Profile image URL: ${imageSrc}`);
        
        try {
          // Create a new page for downloading the image to avoid navigation issues
          const downloadPage = await this.browser.newPage();
          
          // Navigate to the image URL and get the response
          const response = await downloadPage.goto(imageSrc, {waitUntil: 'networkidle0'});
          
          if (response && response.ok()) {
            const buffer = await response.buffer();
            const fileName = `${username}-profile.jpg`;
            const filePath = path.join(this.productsDir, fileName);
            
            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Profile image saved: ${filePath}`);
            
            // Close the download page
            await downloadPage.close();
            
            // Update the Instagram profile JSON
            await this.updateProfileJson(username, fileName);
            
            return fileName;
          } else {
            console.log('❌ Failed to fetch profile image');
            await downloadPage.close();
            return null;
          }
        } catch (downloadError) {
          console.log('❌ Error downloading profile image:', downloadError.message);
          return null;
        }
      } else {
        console.log('❌ No profile image found');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error getting profile image:', error.message);
      return null;
    }
  }

  async updateProfileJson(username, profileImageFile) {
    try {
      const profileJsonPath = path.join(__dirname, '../site/content/data/instagram-profile.json');
      
      const profileData = {
        username: username,
        displayName: username,
        bio: null,
        profileImage: `/img/products/${profileImageFile}`,
        stats: {
          posts: "0",
          followers: "0",
          following: "0"
        },
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(profileJsonPath, JSON.stringify(profileData, null, 2));
      console.log('✅ Updated instagram-profile.json');
      
    } catch (error) {
      console.error('❌ Error updating profile JSON:', error.message);
    }
  }

  async collectAllPostUrls(username) {
    console.log("📑 Collecting all post URLs...");
    
    const postUrls = new Set();
    let noNewPostsCount = 0;
    const maxNoNewPostsIterations = 3; // Stop if no new posts found for 3 consecutive scrolls
    
    try {
      // Wait for the page to load and look for posts grid
      console.log("⏳ Waiting for posts to load...");
      
      // Try different selectors as Instagram structure varies
      const possibleSelectors = [
        "article",
        "[role='main'] section",
        "section main",
        "main section"
      ];
      
      let postsFound = false;
      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, {timeout: 5000});
          console.log(`✅ Found posts container with selector: ${selector}`);
          postsFound = true;
          break;
        } catch (e) {
          console.log(`❌ Selector ${selector} not found, trying next...`);
          continue;
        }
      }
      
      if (!postsFound) {
        console.log("❌ Could not find posts container. The page might not have loaded properly.");
        console.log("🔍 Let's check what's available on the page...");
        
        const pageInfo = await this.page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            articleCount: document.querySelectorAll("article").length,
            linkCount: document.querySelectorAll("a[href*='/p/']").length,
            hasMain: !!document.querySelector("main"),
            hasSection: !!document.querySelector("section")
          };
        });
        
        console.log("📊 Page info:", pageInfo);
        
        // Continue anyway, maybe we can still find some links
      }
      
      console.log("🔄 Starting to scroll and collect post URLs...");
      
      while (noNewPostsCount < maxNoNewPostsIterations) {
        // Get all post links on the current page
        const currentPostUrls = await this.page.evaluate(() => {
          // Common selectors for Instagram post links
          const selectors = [
            "article a[href*=\"/p/\"]",  // Posts
            "a[href*=\"/p/\"]",         // General post links
            "a[href*=\"/reel/\"]",      // Reels
            "article a[href*=\"/reel/\"]"
          ];
          
          const links = new Set();
          
          selectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
              const href = el.href;
              if (href && (href.includes("/p/") || href.includes("/reel/"))) {
                links.add(href);
              }
            });
          });
          
          return Array.from(links);
        });
        
        // Add new URLs to our set
        const initialSize = postUrls.size;
        currentPostUrls.forEach((url) => postUrls.add(url));
        
        const newPostsFound = postUrls.size - initialSize;
        console.log(`📊 Found ${newPostsFound} new posts (Total: ${postUrls.size})`);
        
        // Check if we found new posts
        if (newPostsFound === 0) {
          noNewPostsCount++;
          console.log(`⏳ No new posts found (${noNewPostsCount}/${maxNoNewPostsIterations})`);
        } else {
          noNewPostsCount = 0; // Reset counter if we found new posts
        }
        
        // Scroll to load more posts
        console.log("📜 Scrolling to load more posts...");
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for potential new content to load
        await this.sleep(2000);
        
        // Additional wait for network requests to complete
        try {
          await this.page.waitForLoadState?.("networkidle", {timeout: 3000});
        } catch (e) {
          // Puppeteer doesn't have waitForLoadState, so we'll just wait
          await this.sleep(1000);
        }
      }
      
      console.log(`✅ Finished collecting post URLs. Total found: ${postUrls.size}`);
      return Array.from(postUrls);
      
    } catch (error) {
      console.error("❌ Error collecting post URLs:", error.message);
      return Array.from(postUrls); // Return what we collected so far
    }
  }

  async scrapeIndividualPost(postUrl, index, totalPosts) {
    console.log(`\n📄 Scraping post ${index + 1}/${totalPosts}: ${postUrl}`);
    
    try {
      // Navigate to the post page
      await this.page.goto(postUrl, {waitUntil: 'networkidle2', timeout: 30000});
      await this.sleep(2000); // Wait for page to fully load
      
      // Extract post data
      const postData = await this.page.evaluate(() => {
        // Extract post caption/description
        const captionSelectors = [
          'meta[property="og:description"]',
          'article div[data-testid="post-text"]',
          'article span',
          'div[role="button"] span'
        ];
        
        let caption = '';
        for (const selector of captionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            caption = element.content || element.textContent || '';
            if (caption.length > 10) break;
          }
        }
        
        // Clean up caption
        caption = caption.replace(/\n+/g, ' ').trim();
        if (caption.length > 200) {
          caption = caption.substring(0, 200) + '...';
        }
        
        return {
          caption: caption || 'Instagram Post'
        };
      });
      
      console.log(`📝 Caption: ${postData.caption}`);
      
      // Download media files using carousel navigation
      const downloadedMedia = await this.downloadPostMedia(postUrl, index);
      
      // Create CMS product entry
      const productResult = await this.createCMSProduct(postData, downloadedMedia, postUrl, index);
      
      return {
        success: productResult.success,
        isUpdate: productResult.isUpdate,
        caption: postData.caption,
        mediaCount: downloadedMedia.length,
        error: productResult.error
      };
      
    } catch (error) {
      console.error(`❌ Error scraping post ${postUrl}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async scrapeIndividualPostConcurrent(postUrl, index, totalPosts) {
    console.log(`\n📄 [Batch] Scraping post ${index + 1}/${totalPosts}: ${postUrl}`);
    
    // Create a new page for this concurrent operation
    const postPage = await this.browser.newPage();
    
    try {
      // Set user agent to avoid detection
      await postPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to the post page
      await postPage.goto(postUrl, {waitUntil: 'networkidle2', timeout: 30000});
      await this.sleep(2000); // Wait for page to fully load
      
      // Extract post data
      const postData = await postPage.evaluate(() => {
        // Extract post caption/description
        const captionSelectors = [
          'meta[property="og:description"]',
          'article div[data-testid="post-text"]',
          'article span',
          'div[role="button"] span'
        ];
        
        let caption = '';
        for (const selector of captionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            caption = element.content || element.textContent || '';
            if (caption.length > 10) break;
          }
        }
        
        // Clean up caption
        caption = caption.replace(/\n+/g, ' ').trim();
        if (caption.length > 200) {
          caption = caption.substring(0, 200) + '...';
        }
        
        return {
          caption: caption || 'Instagram Post'
        };
      });
      
      console.log(`📝 [Batch] Caption: ${postData.caption}`);
      
      // Download media files using carousel navigation with dedicated page
      const downloadedMedia = await this.downloadPostMediaConcurrent(postPage, postUrl, index);
      
      // Create CMS product entry
      const productResult = await this.createCMSProduct(postData, downloadedMedia, postUrl, index);
      
      return {
        success: productResult.success,
        isUpdate: productResult.isUpdate,
        caption: postData.caption,
        mediaCount: downloadedMedia.length,
        error: productResult.error
      };
      
    } catch (error) {
      console.error(`❌ Error scraping post ${postUrl}:`, error.message);
      return { success: false, error: error.message };
    } finally {
      // Always close the dedicated page
      await postPage.close();
    }
  }

  async downloadPostMedia(postUrl, postIndex) {
    const downloadedMedia = [];
    const downloadedUrls = new Set(); // Track downloaded URLs to avoid duplicates
    
    console.log(`📥 Starting media download for post ${postIndex + 1}`);
    
    let mediaIndex = 1;
    let hasNextButton = true;
    
    while (hasNextButton) {
      try {
        // Wait for the current media to load
        await this.page.waitForSelector('._acaz img, ._acaz video', {timeout: 10000});
        
        // Get the current visible media in the carousel
        const currentMedia = await this.page.evaluate(() => {
          const mediaData = [];
          
          // Try multiple approaches to find the current media
          
          // Approach 1: Look for visible carousel items
          const carousel = document.querySelector('ul._acay');
          if (carousel) {
            const activeItems = carousel.querySelectorAll('li._acaz');
            
            activeItems.forEach((item, index) => {
              const rect = item.getBoundingClientRect();
              
              // Check if the item is actually visible in the viewport
              if (rect.left >= 0 && rect.left < window.innerWidth / 2) {
                const img = item.querySelector('img[src]');
                const video = item.querySelector('video[src]');
                
                if (img && img.src && !img.src.includes('data:')) {
                  mediaData.push({
                    type: 'image',
                    src: img.src,
                    alt: img.alt || '',
                    index: index
                  });
                } else if (video && video.src) {
                  mediaData.push({
                    type: 'video',
                    src: video.src,
                    index: index
                  });
                }
              }
            });
          }
          
          // Approach 2: If no media found, get the first visible image/video
          if (mediaData.length === 0) {
            const allImages = document.querySelectorAll('img[src]:not([src*="data:"])');
            const allVideos = document.querySelectorAll('video[src]');
            
            // Get the first non-profile image that's visible
            for (const img of allImages) {
              const rect = img.getBoundingClientRect();
              if (rect.width > 100 && rect.height > 100 && 
                  rect.top < window.innerHeight && rect.bottom > 0 &&
                  !img.src.includes('profile') && !img.src.includes('avatar')) {
                mediaData.push({
                  type: 'image',
                  src: img.src,
                  alt: img.alt || ''
                });
                break; // Only get the first one to avoid duplicates
              }
            }
            
            // If still no media, try videos
            if (mediaData.length === 0) {
              for (const video of allVideos) {
                const rect = video.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 100 && 
                    rect.top < window.innerHeight && rect.bottom > 0) {
                  mediaData.push({
                    type: 'video',
                    src: video.src
                  });
                  break;
                }
              }
            }
          }
          
          return mediaData;
        });
        
        // Check if we found any new media
        if (currentMedia.length === 0) {
          console.log(`⚠️ No media found for position ${mediaIndex}`);
          break;
        }
        
        // Check if we already downloaded this media
        const media = currentMedia[0]; // Take the first (should be only one)
        if (downloadedUrls.has(media.src)) {
          console.log(`⏭️ Skipping already downloaded media: ${media.src.substring(0, 50)}...`);
          
          // Try to click next to see if there are more media items
          const nextButtonClicked = await this.page.evaluate(() => {
            const nextButton = document.querySelector('button._afxw._al46._al47[aria-label="Next"]');
            if (nextButton && !nextButton.disabled) {
              nextButton.click();
              return true;
            }
            return false;
          });
          
          if (nextButtonClicked) {
            console.log('🔄 Clicked next button for next media...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for animation
            mediaIndex++;
            continue;
          } else {
            console.log('✅ No more media items (no next button)');
            break;
          }
        }
        
        // Download the current media
        const isVideo = media.type === 'video';
        const extension = isVideo ? 'mp4' : 'jpg';
        
        // Create filename
        const postId = postUrl.split('/p/')[1]?.split('/')[0] || postUrl.split('/reel/')[1]?.split('/')[0] || `post_${postIndex}`;
        const fileName = `${postId}_${mediaIndex}.${extension}`;
        const filePath = path.join(this.productsDir, fileName);
        
        // Check if file already exists
        if (fs.existsSync(filePath)) {
          console.log(`⏭️ Skipping already downloaded media: ${fileName}`);
          downloadedMedia.push({
            fileName: fileName,
            filePath: `/img/products/${fileName}`,
            isVideo: isVideo,
            originalUrl: media.src,
            alt: media.alt || ''
          });
          mediaIndex++;
          
          // Still need to click next button if it exists
          const nextButtonClicked = await this.page.evaluate(() => {
            const nextButton = document.querySelector('button[aria-label*="Next"], ._afxw._al46._al47');
            if (nextButton) {
              nextButton.click();
              return true;
            }
            return false;
          });
          
          if (nextButtonClicked) {
            console.log('🔄 Clicked next button for next media...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          } else {
            console.log('🏁 No more media items (no next button found)');
            break;
          }
        }
        
        console.log(`📥 Downloading ${isVideo ? 'video' : 'image'} ${mediaIndex}: ${fileName}`);
        
        try {
          // Create a new page for downloading to avoid navigation issues
          const downloadPage = await this.browser.newPage();
          
          // Set shorter timeout for videos to prevent getting stuck
          const downloadTimeout = isVideo ? 15000 : 10000; // 15s for videos, 10s for images
          
          const response = await downloadPage.goto(media.src, {
            waitUntil: 'domcontentloaded', // Don't wait for all network activity
            timeout: downloadTimeout
          });
          
          if (response && response.ok()) {
            const buffer = await response.buffer();
            fs.writeFileSync(filePath, buffer);
            
            // Mark this URL as downloaded
            downloadedUrls.add(media.src);
            
            downloadedMedia.push({
              fileName: fileName,
              filePath: `/img/products/${fileName}`,
              isVideo: isVideo,
              originalUrl: media.src,
              alt: media.alt || ''
            });
            
            console.log(`✅ Downloaded: ${fileName}`);
          } else {
            console.log(`❌ Failed to download: ${fileName}`);
          }
          
          await downloadPage.close();
          mediaIndex++;
          
        } catch (downloadError) {
          console.log(`❌ Error downloading media ${mediaIndex}:`, downloadError.message);
          mediaIndex++;
        }
        
        // Try to click the "Next" button
        const nextButtonClicked = await this.page.evaluate(() => {
          // Look for the next button using your provided selector
          const nextButton = document.querySelector('button._afxw._al46._al47[aria-label="Next"]');
          if (nextButton && !nextButton.disabled) {
            nextButton.click();
            return true;
          }
          return false;
        });
        
        if (nextButtonClicked) {
          console.log(`➡️  Clicked next button, waiting for next media...`);
          // Wait a bit for the transition
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`🏁 No more media items (no next button found)`);
          hasNextButton = false;
        }
        
      } catch (error) {
        console.error(`❌ Error in media carousel navigation:`, error.message);
        hasNextButton = false;
      }
    }
    
    console.log(`✅ Downloaded ${downloadedMedia.length} media files for post ${postIndex + 1}`);
    return downloadedMedia;
  }

  async downloadPostMediaConcurrent(postPage, postUrl, postIndex) {
    const downloadedMedia = [];
    const downloadedUrls = new Set(); // Track downloaded URLs to avoid duplicates
    
    console.log(`📥 [Batch] Starting media download for post ${postIndex + 1}`);
    
    let mediaIndex = 1;
    let hasNextButton = true;
    
    while (hasNextButton) {
      try {
        // Wait for the current media to load - use stable selectors instead of obfuscated classes
        try {
          await postPage.waitForSelector('article img, article video', {timeout: 5000});
        } catch (e) {
          try {
            await postPage.waitForSelector('img[src*="scontent"], video[src*="blob:"]', {timeout: 5000});
          } catch (e2) {
            try {
              await postPage.waitForSelector('main img, main video', {timeout: 5000});
            } catch (e3) {
              console.log(`⚠️ [Batch] Could not find media selectors for post ${postIndex + 1}, trying generic approach`);
            }
          }
        }
        
        // Get the current visible media using stable selectors
        const currentMedia = await postPage.evaluate(() => {
          const mediaData = [];
          
          // Strategy 1: Look for media in article elements (most stable)
          const articles = document.querySelectorAll('article');
          for (const article of articles) {
            const images = article.querySelectorAll('img[src]');
            const videos = article.querySelectorAll('video[src]');
            
            // Find the largest, most prominent image/video (likely the main content)
            let mainMedia = null;
            let maxSize = 0;
            
            // Check images first
            for (const img of images) {
              const rect = img.getBoundingClientRect();
              const size = rect.width * rect.height;
              if (size > maxSize && rect.width > 200 && rect.height > 200 && 
                  !img.src.includes('data:') && !img.src.includes('profile') && 
                  !img.src.includes('avatar') && img.src.includes('scontent')) {
                maxSize = size;
                mainMedia = {
                  type: 'image',
                  src: img.src,
                  alt: img.alt || '',
                  element: img
                };
              }
            }
            
            // Check videos if no good image found
            if (!mainMedia) {
              for (const video of videos) {
                const rect = video.getBoundingClientRect();
                const size = rect.width * rect.height;
                if (size > maxSize && rect.width > 200 && rect.height > 200) {
                  maxSize = size;
                  mainMedia = {
                    type: 'video',
                    src: video.src,
                    element: video
                  };
                }
              }
            }
            
            if (mainMedia) {
              mediaData.push(mainMedia);
              break; // Take the first main media found
            }
          }
          
          // Strategy 2: If no article media found, look in main content area
          if (mediaData.length === 0) {
            const mainElement = document.querySelector('main');
            if (mainElement) {
              const images = mainElement.querySelectorAll('img[src*="scontent"]');
              const videos = mainElement.querySelectorAll('video[src]');
              
              for (const img of images) {
                const rect = img.getBoundingClientRect();
                if (rect.width > 200 && rect.height > 200 && 
                    rect.top < window.innerHeight && rect.bottom > 0) {
                  mediaData.push({
                    type: 'image',
                    src: img.src,
                    alt: img.alt || ''
                  });
                  break;
                }
              }
              
              if (mediaData.length === 0) {
                for (const video of videos) {
                  const rect = video.getBoundingClientRect();
                  if (rect.width > 200 && rect.height > 200 && 
                      rect.top < window.innerHeight && rect.bottom > 0) {
                    mediaData.push({
                      type: 'video',
                      src: video.src
                    });
                    break;
                  }
                }
              }
            }
          }
          
          return mediaData;
        });
        
        // Check if we found any new media
        if (currentMedia.length === 0) {
          console.log(`⚠️ [Batch] No media found for position ${mediaIndex}`);
          break;
        }
        
        // Check if we already downloaded this media
        const media = currentMedia[0]; // Take the first (should be only one)
        if (downloadedUrls.has(media.src)) {
          console.log(`⏭️ [Batch] Skipping already downloaded media: ${media.src.substring(0, 50)}...`);
          
          // Try to click next to see if there are more media items
          const nextButtonClicked = await postPage.evaluate(() => {
            // Look for next button using more stable selectors
            const nextSelectors = [
              'button[aria-label*="Next"]',
              'button[aria-label*="next"]', 
              'button:has(svg[aria-label*="Next"])',
              'button:has(svg[aria-label*="next"])',
              '[role="button"][aria-label*="Next"]',
              '[role="button"][aria-label*="next"]'
            ];
            
            for (const selector of nextSelectors) {
              try {
                const button = document.querySelector(selector);
                if (button && !button.disabled) {
                  button.click();
                  return true;
                }
              } catch (e) {
                continue;
              }
            }
            return false;
          });
          
          if (nextButtonClicked) {
            console.log('🔄 [Batch] Clicked next button for next media...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for animation
            mediaIndex++;
            continue;
          } else {
            console.log('✅ [Batch] No more media items (no next button)');
            break;
          }
        }
        
        // Skip blob URLs as they are temporary and not downloadable
        if (media.src.startsWith('blob:')) {
          console.log(`⏭️ [Batch] Skipping blob URL (temporary): ${media.src.substring(0, 50)}...`);
          
          // Try to click next to see if there are more media items
          const nextButtonClicked = await postPage.evaluate(() => {
            const nextButton = document.querySelector('button._afxw._al46._al47[aria-label="Next"]');
            if (nextButton && !nextButton.disabled) {
              nextButton.click();
              return true;
            }
            return false;
          });
          
          if (nextButtonClicked) {
            console.log('🔄 [Batch] Clicked next button for next media...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for animation
            mediaIndex++;
            continue;
          } else {
            console.log('✅ [Batch] No more media items (no next button)');
            break;
          }
        }
        
        // Download the current media
        const isVideo = media.type === 'video';
        const extension = isVideo ? 'mp4' : 'jpg';
        
        // Create filename
        const postId = postUrl.split('/p/')[1]?.split('/')[0] || postUrl.split('/reel/')[1]?.split('/')[0] || `post_${postIndex}`;
        const fileName = `${postId}_${mediaIndex}.${extension}`;
        const filePath = path.join(this.productsDir, fileName);
        
        // Check if file already exists
        if (fs.existsSync(filePath)) {
          console.log(`⏭️ [Batch] Skipping already downloaded media: ${fileName}`);
          downloadedMedia.push({
            fileName: fileName,
            filePath: `/img/products/${fileName}`,
            isVideo: isVideo,
            originalUrl: media.src,
            alt: media.alt || ''
          });
          mediaIndex++;
          
          // Still need to click next button if it exists
          const nextButtonClicked = await postPage.evaluate(() => {
            const nextButton = document.querySelector('button[aria-label*="Next"], ._afxw._al46._al47');
            if (nextButton) {
              nextButton.click();
              return true;
            }
            return false;
          });
          
          if (nextButtonClicked) {
            console.log('🔄 [Batch] Clicked next button for next media...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          } else {
            console.log('🏁 [Batch] No more media items (no next button found)');
            break;
          }
        }
        
        // Skip videos for now as they are too slow and cause hanging
        if (isVideo) {
          console.log(`⏭️ [Batch] Skipping video download (too slow): ${fileName}`);
          
          // Still add to media list but don't actually download
          downloadedMedia.push({
            fileName: fileName,
            filePath: `/img/products/${fileName}`,
            isVideo: isVideo,
            originalUrl: media.src,
            alt: media.alt || '',
            skipped: true // Mark as skipped
          });
          
          mediaIndex++;
          
          // Try to click next to see if there are more media items
          const nextButtonClicked = await postPage.evaluate(() => {
            const nextSelectors = [
              'button[aria-label*="Next"]',
              'button[aria-label*="next"]', 
              '[role="button"][aria-label*="Next"]'
            ];
            
            for (const selector of nextSelectors) {
              try {
                const button = document.querySelector(selector);
                if (button && !button.disabled) {
                  button.click();
                  return true;
                }
              } catch (e) {
                continue;
              }
            }
            return false;
          });
          
          if (nextButtonClicked) {
            console.log('🔄 [Batch] Clicked next button after skipping video...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter wait
            continue;
          } else {
            console.log('✅ [Batch] No more media items (no next button)');
            break;
          }
        }
        
        console.log(`📥 [Batch] Downloading ${isVideo ? 'video' : 'image'} ${mediaIndex}: ${fileName}`);
        
        try {
          // Create a new page for downloading to avoid navigation issues
          const downloadPage = await this.browser.newPage();
          
          // Set aggressive timeout for images only
          const downloadTimeout = 8000; // 8 seconds max for images
          
          console.log(`⏳ [Batch] Starting download with ${downloadTimeout/1000}s timeout...`);
          
          const response = await downloadPage.goto(media.src, {
            waitUntil: 'domcontentloaded', // Don't wait for all network activity
            timeout: downloadTimeout
          });
          
          if (response && response.ok()) {
            const buffer = await response.buffer();
            
            // Check file size - skip if too large (over 5MB)
            if (buffer.length > 5 * 1024 * 1024) {
              console.log(`⏭️ [Batch] Skipping large file (${Math.round(buffer.length / 1024 / 1024)}MB): ${fileName}`);
            } else {
              fs.writeFileSync(filePath, buffer);
              
              // Mark this URL as downloaded
              downloadedUrls.add(media.src);
              
              downloadedMedia.push({
                fileName: fileName,
                filePath: `/img/products/${fileName}`,
                isVideo: isVideo,
                originalUrl: media.src,
                alt: media.alt || ''
              });
              
              console.log(`✅ [Batch] Downloaded: ${fileName} (${Math.round(buffer.length / 1024)}KB)`);
            }
          } else {
            console.log(`❌ [Batch] Failed to download (bad response): ${fileName}`);
          }
          
          // Always close the download page immediately
          await downloadPage.close();
          mediaIndex++;
          
        } catch (downloadError) {
          console.log(`❌ [Batch] Error downloading media ${mediaIndex}:`, downloadError.message);
          mediaIndex++;
        }
        
        // Try to click the "Next" button using stable selectors
        const nextButtonClicked = await postPage.evaluate(() => {
          // Look for next button using more stable selectors
          const nextSelectors = [
            'button[aria-label*="Next"]',
            'button[aria-label*="next"]', 
            'button:has(svg[aria-label*="Next"])',
            'button:has(svg[aria-label*="next"])',
            '[role="button"][aria-label*="Next"]',
            '[role="button"][aria-label*="next"]'
          ];
          
          for (const selector of nextSelectors) {
            try {
              const button = document.querySelector(selector);
              if (button && !button.disabled) {
                button.click();
                return true;
              }
            } catch (e) {
              continue;
            }
          }
          return false;
        });
        
        if (nextButtonClicked) {
          console.log(`➡️ [Batch] Clicked next button, waiting for next media...`);
          // Wait a bit for the transition
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`🏁 [Batch] No more media items (no next button found)`);
          hasNextButton = false;
        }
        
      } catch (error) {
        console.error(`❌ [Batch] Error in media carousel navigation:`, error.message);
        hasNextButton = false;
      }
    }
    
    console.log(`✅ [Batch] Downloaded ${downloadedMedia.length} media files for post ${postIndex + 1}`);
    return downloadedMedia;
  }

  async createCMSProduct(postData, mediaFiles, postUrl, postIndex) {
    try {
      // Create post ID from URL and sanitize it for filesystem safety
      let postId = postUrl.split("/p/")[1]?.split("/")[0] || postUrl.split("/reel/")[1]?.split("/")[0] || `post_${postIndex}`;
      
      // Sanitize postId to prevent filesystem issues
      postId = postId
        .replace(/[^a-zA-Z0-9\-_]/g, "_")  // Replace problematic chars with underscore
        .replace(/_+/g, "_")               // Replace multiple underscores with single
        .replace(/^_|_$/g, "")             // Remove leading/trailing underscores
        .substring(0, 50);                 // Limit length
      
      // Ensure we have a valid postId
      if (!postId || postId.length === 0) {
        postId = `post_${postIndex}`;
      }
      
      // Create product directory (will update if exists)
      const productDir = path.join(__dirname, "../site/content/products", postId);
      const isUpdate = fs.existsSync(productDir);
      if (!isUpdate) {
        fs.mkdirSync(productDir, {recursive: true});
      }
      
      // Helper function to safely escape YAML values
      const escapeYaml = (value) => {
        if (typeof value !== 'string') return '';
        
        // Clean the string of problematic characters
        let cleaned = value
          .replace(/\n/g, ' ')    // Replace newlines with spaces
          .replace(/\r/g, '')     // Remove carriage returns
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/\\/g, '')     // Remove backslashes that could cause escaping issues
          .replace(/:/g, ' - ')   // Replace colons that could break YAML key-value pairs
          .replace(/\[/g, '(')    // Replace square brackets that could break YAML arrays
          .replace(/\]/g, ')')    // Replace square brackets that could break YAML arrays
          .replace(/\{/g, '(')    // Replace curly braces that could break YAML objects
          .replace(/\}/g, ')')    // Replace curly braces that could break YAML objects
          .replace(/\|/g, ' ')    // Replace pipes that have special meaning in YAML
          .replace(/>/g, ' ')     // Replace > that has special meaning in YAML
          .replace(/@/g, ' at ')  // Replace @ symbols that could cause issues
          .replace(/#/g, ' ')     // Replace # that starts comments in YAML
          .trim();
        
        // If empty after cleaning, return empty string
        if (!cleaned) return '';
        
        // For YAML, we need to handle quotes differently
        // Replace double quotes with single quotes to avoid escaping issues
        cleaned = cleaned.replace(/"/g, "'");
        
        // If the string contains single quotes, we need to handle them too
        if (cleaned.includes("'")) {
          // If it has single quotes, remove them entirely to avoid issues
          cleaned = cleaned.replace(/'/g, '');
        }
        
        // Ensure no leading/trailing spaces that could break YAML
        cleaned = cleaned.trim();
        
        // Clean up multiple spaces and ensure not empty
        cleaned = cleaned.replace(/\s+/g, " ").trim();
        
        // If still empty after all cleaning, return fallback
        if (!cleaned || cleaned.length === 0) {
          return "Instagram Post";
        }
        
        // Limit length to prevent overly long YAML values that could cause issues
        if (cleaned.length > 200) {
          cleaned = cleaned.substring(0, 197) + "...";
        }
        
        return cleaned;
      };

      // Create product markdown file
      const cleanTitle = escapeYaml(postData.caption || `Instagram Post ${postIndex + 1}`);
      const cleanDescription = escapeYaml(postData.caption || 'Beautiful jewelry piece from our Instagram collection');
      
      const productData = {
        title: cleanTitle,
        date: new Date().toISOString(),
        description: cleanDescription,
        price: '0', // You can add price logic later
        weight: '0g',
        images: mediaFiles.filter(m => !m.isVideo).map(m => m.filePath),
        videos: mediaFiles.filter(m => m.isVideo).map(m => m.filePath),
        instagramUrl: postUrl,
        type: postData.postType || 'instagram-post',
        categories: ['Instagram Collection']
      };
      
      // Create Hugo markdown content
      const frontMatter = {
        title: productData.title,
        date: productData.date,
        description: productData.description,
        price: productData.price,
        weight: productData.weight,
        image: productData.images[0] || '',
        images: productData.images,
        videos: productData.videos,
        instagram_url: productData.instagramUrl,
        type: productData.type,
        categories: productData.categories,
        draft: false
      };
      
      // Create safer YAML front matter
      let yamlContent = "---\n";
      yamlContent += `title: "${escapeYaml(frontMatter.title)}"\n`;
      yamlContent += `date: ${frontMatter.date}\n`;
      yamlContent += `description: "${escapeYaml(frontMatter.description)}"\n`;
      yamlContent += `price: "${frontMatter.price}"\n`;
      yamlContent += `weight: "${frontMatter.weight}"\n`;
      yamlContent += `image: "${frontMatter.image}"\n`;
      
      // Handle images array safely
      yamlContent += "images:\n";
      if (frontMatter.images.length > 0) {
        frontMatter.images.forEach((img) => {
          yamlContent += `  - "${img}"\n`;
        });
      } else {
        yamlContent += "  []\n";
      }
      
      // Handle videos array safely
      yamlContent += "videos:\n";
      if (frontMatter.videos.length > 0) {
        frontMatter.videos.forEach((vid) => {
          yamlContent += `  - "${vid}"\n`;
        });
      } else {
        yamlContent += "  []\n";
      }
      
      yamlContent += `instagram_url: "${frontMatter.instagram_url}"\n`;
      yamlContent += `type: "${frontMatter.type}"\n`;
      
      // Handle categories array safely
      yamlContent += "categories:\n";
      if (frontMatter.categories.length > 0) {
        frontMatter.categories.forEach((cat) => {
          yamlContent += `  - "${escapeYaml(cat)}"\n`;
        });
      } else {
        yamlContent += "  []\n";
      }
      
      yamlContent += `draft: ${frontMatter.draft}\n`;
      yamlContent += "---\n\n";
      
      // Create body content safely
      let bodyContent = "## Description\n\n";
      bodyContent += escapeYaml(postData.caption || "Beautiful jewelry piece from our Instagram collection.") + "\n\n";
      bodyContent += "## Media\n\n";
      
      // Add media sections safely
      mediaFiles.forEach((media, index) => {
        if (media.isVideo) {
          bodyContent += `### Video ${index + 1}\n`;
          bodyContent += "<video controls width=\"100%\">\n";
          bodyContent += `  <source src="${media.filePath}" type="video/mp4">\n`;
          bodyContent += "  Your browser does not support the video tag.\n";
          bodyContent += "</video>\n\n";
        } else {
          bodyContent += `### Image ${index + 1}\n`;
          bodyContent += `![Product Image](${media.filePath})\n\n`;
        }
      });
      
      bodyContent += "---\n";
      bodyContent += `*Imported from Instagram: [View Original Post](${postUrl})*\n`;
      
      const markdownContent = yamlContent + bodyContent;
      
      const markdownPath = path.join(productDir, 'index.md');
      fs.writeFileSync(markdownPath, markdownContent);
      
      if (isUpdate) {
        console.log(`🔄 Updated CMS product: ${productDir}`);
        return { success: true, isUpdate: true };
      } else {
        console.log(`✅ Created CMS product: ${productDir}`);
        return { success: true, isUpdate: false };
      }
      
    } catch (error) {
      console.error('❌ Error creating CMS product:', error.message);
      return { success: false, isUpdate: false, error: error.message };
    }
  }

  async scrapeAllPosts(postUrls) {
    console.log(`\n🎯 Starting to scrape ${postUrls.length} individual posts in batches of 200...`);
    
    const results = {
      successful: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: []
    };
    
    const batchSize = 10;
    const batches = [];
    
    // Split posts into batches of 200
    for (let i = 0; i < postUrls.length; i += batchSize) {
      batches.push(postUrls.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches of up to ${batchSize} posts each`);
    
    // Process each batch concurrently
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n🚀 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} posts)`);
      
      // Create promises for concurrent processing
      const batchPromises = batch.map(async (postUrl, index) => {
        const globalIndex = batchIndex * batchSize + index;
        return this.scrapeIndividualPostConcurrent(postUrl, globalIndex, postUrls.length);
      });
      
      // Wait for all posts in the batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((promiseResult, index) => {
        const postUrl = batch[index];
        const globalIndex = batchIndex * batchSize + index;
        
        if (promiseResult.status === 'fulfilled' && promiseResult.value.success) {
          results.successful++;
          if (promiseResult.value.isUpdate) {
            results.updated++;
          } else {
            results.created++;
          }
          console.log(`✅ Post ${globalIndex + 1}/${postUrls.length} completed successfully`);
        } else {
          results.failed++;
          const error = promiseResult.status === 'rejected' 
            ? promiseResult.reason?.message || 'Unknown error'
            : promiseResult.value.error;
          results.errors.push({
            url: postUrl,
            error: error
          });
          console.log(`❌ Post ${globalIndex + 1}/${postUrls.length} failed: ${error}`);
        }
      });
      
      // Add delay between batches to avoid overwhelming Instagram
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ Waiting 5 seconds before next batch...`);
        await this.sleep(5000);
      }
    }
    
    console.log(`\n📊 Scraping Results:`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`🆕 Created: ${results.created}`);
    console.log(`🔄 Updated: ${results.updated}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log(`\n🔍 Failed URLs:`);
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.url} - ${error.error}`);
      });
    }
    
    return results;
  }

  async scrapeProfile(username) {
    try {
      console.log(`🎯 Starting Instagram profile scrape for: ${username}`);
      
      // Step 1: Initialize browser
      await this.initBrowser();
      
      // Step 2: Load Instagram page
      console.log("📱 Loading Instagram page...");
      const url = `https://www.instagram.com/${username}/`;
      await this.page.goto(url, {waitUntil: "domcontentloaded"});
      
      // Step 3: Handle cookies
      await this.handleCookies();
      
      // Step 4: Handle login if needed
      await this.waitForLogin(username);
      
      // Step 5: Get profile image first
      const profileImageFile = await this.getProfileImage(username);
      
      // Step 6: Then collect all post URLs
      const postUrls = await this.collectAllPostUrls(username);
      
      // Log all collected post URLs
      console.log("\n📋 Complete list of post URLs:");
      console.log("=====================================");
      postUrls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
      });
      console.log("=====================================");
      console.log(`Total posts found: ${postUrls.length}\n`);

      // Step 7: Scrape individual posts and create CMS products
      let scrapingResults = null;
      if (postUrls.length > 0) {
        console.log("🚀 Starting individual post scraping for CMS products...");
        scrapingResults = await this.scrapeAllPosts(postUrls);
      }
      
      // Final results
      console.log("\n🎉 Complete scraping results:");
      console.log("=====================================");
      if (profileImageFile) {
        console.log(`✅ Profile image saved as: ${profileImageFile}`);
      }
      console.log(`📊 Total post URLs collected: ${postUrls.length}`);
      
      if (scrapingResults) {
        console.log(`✅ CMS Products processed: ${scrapingResults.successful}`);
        console.log(`🆕 New products created: ${scrapingResults.created}`);
        console.log(`🔄 Existing products updated: ${scrapingResults.updated}`);
        console.log(`❌ Failed posts: ${scrapingResults.failed}`);
      }
      
      console.log("=====================================");
      console.log("🌐 Your CMS has been updated with Instagram content!");
      
      // Keep browser open for a few seconds so user can see the result
      console.log("⏳ Keeping browser open for 10 seconds...");
      await this.sleep(10000);
      
    } catch (error) {
      console.error("❌ Error during scraping:", error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run the scraper
async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.log('❌ Please provide an Instagram username');
    console.log('📝 Usage: node simple-instagram-scraper.js <username>');
    console.log('📝 Example: node simple-instagram-scraper.js 6_side_jewelry');
    process.exit(1);
  }
  
  const scraper = new SimpleInstagramScraper();
  await scraper.scrapeProfile(username);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SimpleInstagramScraper;
