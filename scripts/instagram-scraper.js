const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class InstagramScraper {
  constructor(credentials = null) {
    this.browser = null;
    this.page = null;
    this.credentials = credentials; // { username, password }
    this.isLoggedIn = false;
    this.outputDir = path.join(__dirname, '../site/content/products');
    this.imagesDir = path.join(__dirname, '../site/static/img/products');
    this.sessionDir = path.join(__dirname, '../.instagram-session');
    this.cookiesFile = path.join(this.sessionDir, 'cookies.json');
    this.sessionFile = path.join(this.sessionDir, 'session.json');
    
    // Ensure directories exist
    this.ensureDirectoryExists(this.outputDir);
    this.ensureDirectoryExists(this.imagesDir);
    this.ensureDirectoryExists(this.sessionDir);
  }

  // Utility function to replace deprecated waitForTimeout
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async handleCookieConsent() {
    console.log('🍪 Checking for cookie consent...');
    
    try {
      // Wait a bit for the page to fully load
      await this.wait(2000);
      
      // Instagram-specific cookie consent selectors
      const cookieSelectors = [
        'button:contains("Allow all cookies")',
        'button:contains("Accept all cookies")', 
        'button[class*="optanon-allow-all"]',
        'button[data-cookiebanner="accept_button"]',
        '[role="button"]:contains("Allow all")',
        '[role="button"]:contains("Accept all")',
        'button:contains("Allow essential and optional cookies")',
        'button[class*="cookie"][class*="accept"]',
        'button[class*="cookie"][class*="allow"]'
      ];
      
      let buttonFound = false;
      
      for (const selector of cookieSelectors) {
        try {
          // For text-based selectors, we need to find buttons by text content
          if (selector.includes(':contains(')) {
            const buttonText = selector.match(/:contains\("([^"]+)"\)/)[1];
            const buttons = await this.page.$$('button');
            
            for (const button of buttons) {
              const text = await this.page.evaluate(el => el.textContent?.trim(), button);
              if (text && text.toLowerCase().includes(buttonText.toLowerCase())) {
                console.log(`🍪 Found cookie consent button with text: "${text}"`);
                await button.click();
                buttonFound = true;
                await this.wait(1000);
                break;
              }
            }
          } else {
            // For CSS selectors
            const button = await this.page.$(selector);
            if (button) {
              const text = await this.page.evaluate(el => el.textContent?.trim(), button);
              console.log(`🍪 Found cookie consent button: ${selector} (text: "${text}")`);
              await button.click();
              buttonFound = true;
              await this.wait(1000);
              break;
            }
          }
          
          if (buttonFound) break;
        } catch (e) {
          // Continue to next selector
          continue;
        }
      }
      
      if (!buttonFound) {
        console.log('🍪 No cookie consent banner found - proceeding');
      } else {
        console.log('✅ Cookie consent handled successfully');
      }
      
    } catch (error) {
      console.log('⚠️  Cookie handling failed:', error.message);
      // Don't throw - just continue
    }
  }

  async waitForLoginCompletion() {
    console.log('🔍 Monitoring for login completion...');
    
    const maxWaitTime = 300000; // 5 minutes
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const currentUrl = this.page.url();
        
        // Check for successful login indicators
        const loginSuccessChecks = [
          // URL-based checks
          () => currentUrl.includes('/accounts/onetap/'),
          () => currentUrl === 'https://www.instagram.com/',
          () => currentUrl.includes('/feed/'),
          () => currentUrl.includes('instagram.com') && !currentUrl.includes('/accounts/login/'),
          
          // Element-based checks
          async () => await this.page.$('svg[aria-label="Home"]') !== null,
          async () => await this.page.$('a[href="/"]') !== null,
          async () => await this.page.$('[data-testid="new-post-button"]') !== null,
          async () => await this.page.$('nav[role="navigation"]') !== null,
          async () => await this.page.$('input[placeholder*="Search"]') !== null
        ];
        
        // Check each success indicator
        for (const check of loginSuccessChecks) {
          try {
            const result = await check();
            if (result) {
              console.log('✅ Login success detected!');
              return true;
            }
          } catch (e) {
            // Continue to next check
            continue;
          }
        }
        
        // Check for error conditions
        const errorElement = await this.page.$('div[role="alert"]');
        if (errorElement) {
          const errorText = await this.page.evaluate(el => el.textContent?.trim(), errorElement);
          if (errorText && errorText.length > 0) {
            throw new Error(`Login error: ${errorText}`);
          }
        }
        
        // Update user on progress
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed % 10 === 0) {
          console.log(`⏳ Still waiting for login... (${elapsed}s elapsed)`);
        }
        
        // Wait before next check
        await this.wait(checkInterval);
        
      } catch (error) {
        throw error;
      }
    }
    
    throw new Error('Login timeout: Please complete login within 5 minutes');
  }

  async addHumanBehavior() {
    try {
      console.log('🤖 Adding human-like behavior...');
      
      // Random scroll to simulate reading
      await this.page.evaluate(() => {
        const scrollAmount = Math.random() * 300 + 100;
        window.scrollBy(0, scrollAmount);
      });
      
      // Random wait between 1-3 seconds
      await this.wait(1000 + Math.random() * 2000);
      
      // Random mouse movement
      const viewport = this.page.viewport();
      const x = Math.random() * viewport.width;
      const y = Math.random() * viewport.height;
      
      await this.page.mouse.move(x, y, { steps: 10 });
      await this.wait(500 + Math.random() * 1000);
      
      // Sometimes click somewhere random (but safe)
      if (Math.random() > 0.7) {
        await this.page.mouse.click(x, y);
        await this.wait(500);
      }
      
    } catch (error) {
      console.log('⚠️  Human behavior simulation failed:', error.message);
    }
  }

  async saveSession() {
    try {
      console.log('💾 Saving login session...');
      
      // Ensure session directory exists
      this.ensureDirectoryExists(this.sessionDir);
      
      // Save cookies
      const cookies = await this.page.cookies();
      if (cookies && cookies.length > 0) {
        fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2));
        console.log(`📄 Saved ${cookies.length} cookies`);
      } else {
        console.log('⚠️  No cookies to save');
      }
      
      // Save session info
      const sessionInfo = {
        isLoggedIn: this.isLoggedIn,
        timestamp: Date.now(),
        userAgent: await this.page.evaluate(() => navigator.userAgent),
        url: this.page.url()
      };
      fs.writeFileSync(this.sessionFile, JSON.stringify(sessionInfo, null, 2));
      
      console.log('✅ Session saved successfully!');
      console.log(`📁 Session files saved to: ${this.sessionDir}`);
      
    } catch (error) {
      console.error('❌ Failed to save session:', error.message);
      console.error('🔍 Stack trace:', error.stack);
      // Don't throw error - just log it
    }
  }

  async loadSession() {
    try {
      console.log('🔄 Checking for saved session...');
      
      // Check if session files exist
      if (!fs.existsSync(this.cookiesFile) || !fs.existsSync(this.sessionFile)) {
        console.log('ℹ️  No saved session found');
        return false;
      }
      
      // Load session info
      const sessionInfo = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
      
      // Check if session is not too old (48 hours - increased from 24)
      const sessionAge = Date.now() - sessionInfo.timestamp;
      const maxAge = 48 * 60 * 60 * 1000; // 48 hours
      
      if (sessionAge > maxAge) {
        console.log('⏰ Saved session is too old, starting fresh');
        this.clearSession();
        return false;
      }
      
      // Load cookies
      const cookies = JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
      
      console.log('🔄 Restoring saved session...');
      
      // Set cookies in the browser (but don't navigate yet)
      await this.page.setCookie(...cookies);
      
      // Mark as logged in based on saved session info
      this.isLoggedIn = sessionInfo.isLoggedIn;
      
      if (this.isLoggedIn) {
        console.log('✅ Session restored successfully! (Valid for next 48 hours)');
        console.log(`📅 Session age: ${Math.round(sessionAge / (60 * 60 * 1000))} hours`);
        return true;
      } else {
        console.log('❌ Saved session indicates not logged in');
        this.clearSession();
        return false;
      }
      
    } catch (error) {
      console.log('⚠️  Failed to load session:', error.message);
      this.clearSession();
      return false;
    }
  }

  async validateSession() {
    // This method validates the session when we actually need to use it
    try {
      console.log('🔍 Validating session...');
      
      // Go to Instagram to test the session
      await this.page.goto('https://www.instagram.com/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await this.wait(5000); // Increased wait time for proxy
      
      // Check if we're still logged in
      const isStillLoggedIn = await this.checkLoginStatus();
      
      if (isStillLoggedIn) {
        console.log('✅ Session is still valid!');
        return true;
      } else {
        console.log('❌ Session expired, need to login again');
        this.clearSession();
        this.isLoggedIn = false;
        return false;
      }
      
    } catch (error) {
      console.log('⚠️  Session validation failed:', error.message);
      this.clearSession();
      this.isLoggedIn = false;
      return false;
    }
  }

  async checkLoginStatus() {
    try {
      // Wait a moment for page to stabilize
      await this.wait(2000);
      
      const currentUrl = this.page.url();
      console.log(`🔍 Checking login status on URL: ${currentUrl}`);
      
      // First check if we're on a login-related page
      if (currentUrl.includes('/accounts/login/') || 
          currentUrl.includes('/accounts/emailsignup/') ||
          currentUrl.includes('/accounts/signup/')) {
        console.log('❌ Currently on login page - not logged in');
        return false;
      }
      
      // Check for login indicators with more comprehensive selectors
      const loginIndicators = [
        // Navigation-based checks
        async () => await this.page.$('svg[aria-label="Home"]') !== null,
        async () => await this.page.$('a[aria-label="Home"]') !== null,
        async () => await this.page.$('a[href="/"]') !== null,
        async () => await this.page.$('input[placeholder*="Search"]') !== null,
        async () => await this.page.$('nav[role="navigation"]') !== null,
        async () => await this.page.$('[data-testid="new-post-button"]') !== null,
        
        // Profile/user indicators
        async () => await this.page.$('button[aria-label*="Profile"]') !== null,
        async () => await this.page.$('a[href*="/accounts/edit/"]') !== null,
        async () => await this.page.$('svg[aria-label*="Profile"]') !== null,
        
        // Content indicators
        async () => await this.page.$('main[role="main"]') !== null,
        async () => await this.page.$('section') !== null,
        
        // Check for user menu or logout option
        async () => {
          const buttons = await this.page.$$('button');
          for (const button of buttons) {
            const text = await this.page.evaluate(el => el.textContent?.trim().toLowerCase(), button);
            if (text && (text.includes('log out') || text.includes('logout'))) {
              return true;
            }
          }
          return false;
        }
      ];
      
      // Check each indicator
      for (const check of loginIndicators) {
        try {
          const result = await check();
          if (result) {
            console.log('✅ Login indicator found - user is logged in');
            return true;
          }
        } catch (e) {
          // Continue to next check
          continue;
        }
      }
      
      // Additional check: look for typical logged-in page elements
      const hasLoggedInContent = await this.page.evaluate(() => {
        // Check for typical Instagram logged-in page patterns
        const indicators = [
          document.querySelector('main'),
          document.querySelector('nav'),
          document.querySelector('[role="navigation"]'),
          document.querySelector('header'),
          // Check for Instagram's typical class patterns (these change frequently)
          document.querySelector('div[id="mount_0_0"]'),
          document.querySelector('section')
        ];
        
        return indicators.some(el => el !== null);
      });
      
      if (hasLoggedInContent) {
        console.log('✅ Logged-in content structure detected');
        return true;
      }
      
      console.log('❌ No login indicators found');
      return false;
    } catch (error) {
      console.log('⚠️  Error checking login status:', error.message);
      return false;
    }
  }

  clearSession() {
    try {
      if (fs.existsSync(this.cookiesFile)) {
        fs.unlinkSync(this.cookiesFile);
      }
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
      console.log('🗑️  Cleared saved session');
    } catch (error) {
      console.log('⚠️  Failed to clear session:', error.message);
    }
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async init() {
    console.log('🚀 Starting Instagram scraper...');
    console.log('🌐 Using proxy: localhost:10808');
    
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Keep visible to appear more human
        defaultViewport: null,
        args: [
          // Proxy configuration
          '--proxy-server=localhost:10808',
          
          // Basic security
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          
          // Anti-detection measures
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-automation',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-sync',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-hang-monitor',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--no-first-run',
          '--no-default-browser-check',
          '--no-zygote',
          '--disable-gpu',
          
          // Make it look more like a real browser
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--window-size=1366,768',
          '--disable-infobars',
          '--start-maximized',
          
          // Additional privacy flags
          '--incognito',
          '--disable-logging',
          '--disable-gpu-logging',
          '--silent'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
      });
    } catch (error) {
      console.error('❌ Failed to launch browser:', error.message);
      
      if (error.message.includes('Could not find Chrome')) {
        console.log('🔧 Chrome not found. Trying to install Chrome for Puppeteer...');
        console.log('💡 Please run: npx puppeteer browsers install chrome');
        console.log('   Or alternatively: yarn add puppeteer');
        throw new Error('Chrome browser not found. Please install Chrome for Puppeteer using: npx puppeteer browsers install chrome');
      }
      
      throw error;
    }

    this.page = await this.browser.newPage();
    
    // Additional anti-detection measures
    await this.page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      delete navigator.__proto__.webdriver;
      
      // Override the plugins property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [1, 2, 3, 4, 5]; // Fake plugins
        },
      });
      
      // Override the languages property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: function() {
          return ['en-US', 'en'];
        },
      });
      
      // Override the webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: function() {
          return undefined;
        },
      });
      
      // Mock chrome object
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    // Set a more realistic user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set realistic viewport
    await this.page.setViewport({ 
      width: 1366, 
      height: 768,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });
    
    // Set extra headers to look more human
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    // Add random mouse movements to seem more human
    await this.page.evaluateOnNewDocument(() => {
      // Add random mouse movements
      setInterval(() => {
        if (Math.random() > 0.7) {
          const x = Math.random() * window.innerWidth;
          const y = Math.random() * window.innerHeight;
          const event = new MouseEvent('mousemove', {
            clientX: x,
            clientY: y,
            bubbles: true
          });
          document.dispatchEvent(event);
        }
      }, 2000 + Math.random() * 3000);
    });

    // Try to load existing session if credentials are provided
    if (this.credentials) {
      console.log('🔍 Checking for existing login session...');
      try {
        const sessionLoaded = await this.loadSession();
        if (sessionLoaded) {
          console.log('🎯 Found and restored previous login session!');
        }
      } catch (error) {
        console.log('ℹ️  No valid session found, will need to login manually');
      }
    }
  }

  async login() {
    if (!this.credentials || !this.credentials.username || !this.credentials.password) {
      console.log('⚠️  No credentials provided, skipping login...');
      return false;
    }

    // Check if these are placeholder credentials from interactive mode
    const isInteractiveMode = this.credentials.username === 'manual' && this.credentials.password === 'manual';

    // Try to load existing session first (without navigating to Instagram)
    const sessionLoaded = await this.loadSession();
    if (sessionLoaded) {
      console.log("🎯 Found saved login session! Skipping login.");
      return true;
    }

    try {
      if (isInteractiveMode) {
        console.log('🔐 Starting interactive login to Instagram...');
        console.log('💡 Since this is a private page, you will login manually in the browser');
      } else {
        console.log('🔐 Starting fresh login to Instagram...');
      }
      
      // Go to Instagram login page
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for login form to load
      await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
      
      // Handle cookie banner if present
      await this.handleCookieConsent();

      // Interactive login mode - let user handle it manually
      console.log('\n🎯 INTERACTIVE LOGIN MODE');
      console.log('==========================');
      console.log('👤 Please complete the login manually in the browser window:');
      console.log('   1. Enter your Instagram username and password');
      console.log('   2. Handle any 2FA/verification if required');
      console.log('   3. Complete any security challenges');
      console.log('   4. Wait until you see the Instagram home page');
      console.log('\n⏳ The script will automatically detect when login is complete...');
      console.log('💡 Press Ctrl+C if you want to cancel');
      console.log('\n🤖 Anti-Detection Features Active:');
      console.log('   ✅ Stealth browser configuration');
      console.log('   ✅ Human-like mouse movements');
      console.log('   ✅ Realistic browser headers');
      console.log('   ✅ WebDriver properties hidden');
      console.log('   ✅ Manual login (most human-like)');
      console.log('   ✅ Session persistence (login once, stay logged in)\n');

      // Add some random human-like movements before login
      await this.addHumanBehavior();

      // Wait for login completion by checking URL changes
      await this.waitForLoginCompletion();

      console.log('✅ Successfully logged into Instagram!');
      this.isLoggedIn = true;
      
      // Save session for future use - with better error handling
      try {
        await this.saveSession();
        console.log('💾 Login session saved for future use!');
      } catch (sessionError) {
        console.error('⚠️  Warning: Could not save session, but login was successful:', sessionError.message);
        // Don't fail the entire login because of session save issues
      }
      
      // Handle any post-login dialogs (Save Login Info, Notifications, etc.)
      try {
        console.log('🔄 Checking for post-login dialogs...');
        
        // Wait a bit for any dialogs to appear
        await this.wait(3000);
        
        // Handle "Save Your Login Info?" dialog
        const saveLoginButtons = await this.page.$$('button');
        for (const button of saveLoginButtons) {
          const text = await this.page.evaluate(el => el.textContent?.trim(), button);
          if (text && text.toLowerCase().includes('not now')) {
            console.log('💾 Dismissing "Save Login Info" dialog...');
            await button.click();
            await this.wait(1000);
            break;
          }
        }
        
        // Handle notification permission dialog
        const notificationButtons = await this.page.$$('button');
        for (const button of notificationButtons) {
          const text = await this.page.evaluate(el => el.textContent?.trim(), button);
          if (text && text.toLowerCase().includes('not now')) {
            console.log('🔔 Dismissing notification dialog...');
            await button.click();
            await this.wait(1000);
            break;
          }
        }
        
      } catch (e) {
        console.log('ℹ️  No post-login dialogs found or error handling them:', e.message);
      }

      console.log('🎉 Login process completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Login failed:', error.message);
      console.error('🔍 Error details:', error.stack);
      this.isLoggedIn = false;
      this.clearSession(); // Clear any partial session data
      
      // Don't close browser immediately - let user investigate
      console.log('⚠️  Browser will remain open for investigation. Close manually when done.');
      throw error;
    }
  }

  async scrapeInstagramPage(instagramUrl) {
    try {
      // Login first if credentials are provided and we're not logged in
      if (this.credentials && !this.isLoggedIn) {
        await this.login();
      }

      console.log(`📱 Navigating to ${instagramUrl}...`);
      
      // Increased timeout for proxy connections and better error handling
      try {
        await this.page.goto(instagramUrl, { 
          waitUntil: 'networkidle0',
          timeout: 90000 // Increased to 90 seconds for proxy
        });
      } catch (timeoutError) {
        console.log('⚠️ Navigation timeout, trying with domcontentloaded...');
        await this.page.goto(instagramUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 // 60 seconds fallback
        });
      }

      // Wait for page to load (increased for proxy)
      await this.wait(8000);

      // Check current URL to see if we got redirected to login
      const currentUrl = this.page.url();
      console.log(`🔍 Current URL: ${currentUrl}`);
      
      if (currentUrl.includes('/accounts/login/')) {
        console.log('🔄 Redirected to login page, session may have expired');
        this.isLoggedIn = false;
        this.clearSession();
        
        if (this.credentials) {
          console.log('🔐 Attempting login...');
          await this.login();
          // Navigate to target page again after login
          await this.page.goto(instagramUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          await this.wait(3000);
        } else {
          throw new Error('Session expired and no login credentials provided');
        }
      }

      // Check if we're on a private account page that requires login
      const isPrivatePage = await this.page.evaluate(() => {
        const h2Elements = document.querySelectorAll('h2');
        return Array.from(h2Elements).some(h2 => h2.textContent.includes('This Account is Private'));
      });
      
      if (isPrivatePage && !this.isLoggedIn) {
        throw new Error('This is a private account and no login credentials were provided');
      }

      // Check if we need to accept cookies
      await this.handleCookieConsent();

      // Extract profile information first
      const profileInfo = await this.extractProfileInfo();
      
      // Add human-like behavior before scrolling
      await this.addHumanBehavior();

      // Scroll to load more posts
      await this.autoScroll();

      // Add more human behavior after scrolling
      await this.addHumanBehavior();

      // Get all posts
      const posts = await this.extractPosts();
      
      console.log(`✅ Found ${posts.length} posts`);
      
      // Download profile image if available
      let profileImageFile = null;
      if (profileInfo && profileInfo.profileImageUrl) {
        profileImageFile = await this.downloadProfileImage(profileInfo);
        profileInfo.profileImageFile = profileImageFile;
      }
      
      // Return both posts and profile info
      return {
        posts: posts,
        profile: profileInfo
      };

    } catch (error) {
      console.error('❌ Error scraping Instagram page:', error);
      throw error;
    }
  }

  async autoScroll() {
    console.log('📜 Scrolling to load more posts...');
    
    let previousPostCount = 0;
    let stableCount = 0;
    const maxScrollAttempts = 15; // Increased from 10 to 15
    
    for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
      console.log(`📜 Scroll attempt ${attempt + 1}/${maxScrollAttempts}`);
      
      // Get current post count
      const currentPostCount = await this.page.evaluate(() => {
        const postSelectors = [
          "a[href*=\"/p/\"]",
          "a[href*=\"/reel/\"]",
          "article a[href*=\"/p/\"]",
          "article a[href*=\"/reel/\"]"
        ];
        
        let totalPosts = 0;
        for (const selector of postSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > totalPosts) {
            totalPosts = elements.length;
          }
        }
        return totalPosts;
      });
      
      console.log(`📊 Found ${currentPostCount} posts so far`);
      
      // Check if we found new posts
      if (currentPostCount === previousPostCount) {
        stableCount++;
        console.log(`⏸️ No new posts found (stable count: ${stableCount})`);
        
        // If no new posts for 2 attempts (reduced from 3), we're probably done
        if (stableCount >= 2) {
          console.log('✅ No more posts to load, stopping scroll');
          break;
        }
      } else {
        stableCount = 0; // Reset stable count if we found new posts
        console.log(`📈 Found ${currentPostCount - previousPostCount} new posts`);
      }
      
      previousPostCount = currentPostCount;
      
      // Perform more aggressive scrolling
      await this.page.evaluate(async () => {
        // Scroll to bottom in multiple steps with faster intervals
        const scrollSteps = 8; // Increased from 5
        const scrollHeight = document.body.scrollHeight;
        const stepSize = scrollHeight / scrollSteps;
        
        for (let i = 0; i < scrollSteps; i++) {
          window.scrollTo(0, stepSize * (i + 1));
          await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 500ms
        }
        
        // Final scroll to absolute bottom
        window.scrollTo(0, document.body.scrollHeight);
        
        // Scroll back up a bit and down again to trigger loading
        window.scrollTo(0, document.body.scrollHeight - 500);
        await new Promise(resolve => setTimeout(resolve, 200));
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new posts to load
      console.log('⏳ Waiting for new posts to load...');
      await this.wait(4000); // Increased wait time
      
      // Add some human behavior during scrolling
      await this.addHumanBehavior();
    }
    
    // Final check for posts
    const finalPostCount = await this.page.evaluate(() => {
      const postSelectors = [
        "a[href*=\"/p/\"]",
        "a[href*=\"/reel/\"]",
        "article a[href*=\"/p/\"]",
        "article a[href*=\"/reel/\"]"
      ];
      
      let totalPosts = 0;
      for (const selector of postSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > totalPosts) {
          totalPosts = elements.length;
        }
      }
      return totalPosts;
    });
    
    console.log(`📊 Final post count after scrolling: ${finalPostCount}`);
  }

  async extractPosts() {
    console.log("🔍 Extracting posts data...");
    
    return await this.page.evaluate(() => {
      const posts = [];
      const seenUrls = new Set(); // Track unique posts
      
      // Comprehensive selectors for Instagram posts (updated for 2025)
      const postSelectors = [
        // Standard post selectors
        "a[href*=\"/p/\"]",
        "a[href*=\"/reel/\"]",
        
        // Article-based selectors
        "article a[href*=\"/p/\"]",
        "article a[href*=\"/reel/\"]",
        
        // Role-based selectors
        "[role=\"link\"][href*=\"/p/\"]",
        "[role=\"link\"][href*=\"/reel/\"]",
        
        // More specific selectors
        "div[style*=\"padding-bottom\"] a[href*=\"/p/\"]",
        "div[style*=\"padding-bottom\"] a[href*=\"/reel/\"]",
        
        // Class-based selectors (Instagram's class names change frequently)
        "article[role=\"presentation\"] a",
        "div[class*=\"v1Nh3\"] a",
        "div._ac7v a",
        
        // Broad selectors as fallback
        "div > a[href*=\"instagram.com/p/\"]",
        "div > a[href*=\"instagram.com/reel/\"]",
        
        // Additional fallback selectors
        "a[href*=\"/tv/\"]", // IGTV posts
        "*[href*=\"/p/\"]", // Any element with post href
        "*[href*=\"/reel/\"]" // Any element with reel href
      ];
      
      console.log("🔍 Trying multiple selectors to find posts...");
      
      // Try each selector and collect all unique posts
      for (const selector of postSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          console.log(`📊 Selector "${selector}" found ${elements.length} elements`);
          
          elements.forEach((element, index) => {
            try {
              let postUrl = '';
              let imageUrl = '';
              let description = '';
              
              // Get post URL
              if (element.tagName === 'A') {
                postUrl = element.href;
              } else {
                const linkElement = element.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
                postUrl = linkElement ? linkElement.href : '';
              }
              
              // Skip if we've already seen this URL
              if (!postUrl || seenUrls.has(postUrl)) {
                return;
              }
              
              // Get image URL - try multiple methods
              let imgElement = element.querySelector('img');
              if (!imgElement && element.tagName === 'A') {
                // Look for images in parent or sibling elements
                imgElement = element.parentElement?.querySelector('img') || 
                           element.closest('article')?.querySelector('img') ||
                           element.closest('div')?.querySelector('img');
              }
              
              if (imgElement) {
                imageUrl = imgElement.src || imgElement.dataset.src || imgElement.getAttribute('src');
                description = imgElement.alt || imgElement.getAttribute('alt') || '';
              }
              
              // Extract post ID from URL - handle multiple formats
              let postId = '';
              const postIdMatches = [
                postUrl.match(/\/p\/([^\/\?]+)/),
                postUrl.match(/\/reel\/([^\/\?]+)/),
                postUrl.match(/\/tv\/([^\/\?]+)/)
              ];
              
              for (const match of postIdMatches) {
                if (match && match[1]) {
                  postId = match[1];
                  break;
                }
              }
              
              if (!postId) {
                postId = `post-${Date.now()}-${index}`;
              }
              
              // Only add if we have essential data
              if (postUrl && imageUrl) {
                seenUrls.add(postUrl);
                posts.push({
                  id: postId,
                  url: postUrl,
                  imageUrl: imageUrl,
                  description: description,
                  title: `Instagram Post ${postId}`,
                  date: new Date().toISOString().split('T')[0]
                });
              }
            } catch (error) {
              console.error('Error extracting individual post:', error);
            }
          });
        } catch (error) {
          console.error(`Error with selector "${selector}":`, error);
        }
      }
      
      // Remove duplicates based on post ID
      const uniquePosts = [];
      const seenIds = new Set();
      
      for (const post of posts) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          uniquePosts.push(post);
        }
      }
      
      console.log(`🎯 Found ${uniquePosts.length} unique posts out of ${posts.length} total matches`);
      
      return uniquePosts;
    });
  }

  async extractProfileInfo() {
    console.log("🔍 Extracting profile information...");
    
    return await this.page.evaluate(() => {
      const profileInfo = {
        profileImageUrl: null,
        username: null,
        displayName: null,
        bio: null,
        followersCount: null,
        followingCount: null,
        postsCount: null
      };
      
      // Try different selectors for profile image
      const profileImageSelectors = [
        'img[data-testid="user-avatar"]',
        'img[alt*="profile picture"]',
        'img[alt*="Profile picture"]',
        'header img',
        'div[role="img"] img',
        'img[style*="border-radius"]',
        // More specific selectors for profile images
        'img[src*="profile"]',
        'img[src*="avatar"]',
        // Look for images in header or profile section
        'main header img',
        'section header img',
        '[role="main"] header img'
      ];
      
      for (const selector of profileImageSelectors) {
        const img = document.querySelector(selector);
        if (img && img.src) {
          // Check if this looks like a profile image (usually square and reasonable size)
          const isLikelyProfileImage = img.src.includes('profile') || 
                                     img.src.includes('avatar') ||
                                     img.alt?.toLowerCase().includes('profile') ||
                                     (img.width > 50 && img.width < 300);
          
          if (isLikelyProfileImage) {
            profileInfo.profileImageUrl = img.src;
            break;
          }
        }
      }
      
      // Extract username from URL or page
      const currentUrl = window.location.href;
      const usernameMatch = currentUrl.match(/instagram\.com\/([^\/\?]+)/);
      if (usernameMatch) {
        profileInfo.username = usernameMatch[1];
      }
      
      // Try to get display name
      const displayNameSelectors = [
        'h2',
        'h1',
        '[data-testid="user-name"]',
        'header h1',
        'header h2'
      ];
      
      for (const selector of displayNameSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          const text = element.textContent.trim();
          // Skip if it looks like stats or other content
          if (!text.includes('posts') && !text.includes('followers') && text.length < 50) {
            profileInfo.displayName = text;
            break;
          }
        }
      }
      
      // Try to get bio
      const bioSelectors = [
        '[data-testid="user-bio"]',
        'header div:last-child',
        'main header div span',
        'section div span'
      ];
      
      for (const selector of bioSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          const text = element.textContent.trim();
          // Skip if it's clearly not a bio
          if (!text.includes('posts') && !text.includes('followers') && text.length > 10) {
            profileInfo.bio = text;
            break;
          }
        }
      }
      
      // Try to extract stats (followers, following, posts)
      const statsElements = document.querySelectorAll('a, span, div');
      statsElements.forEach(element => {
        const text = element.textContent?.toLowerCase() || '';
        if (text.includes('followers') || text.includes('following') || text.includes('posts')) {
          const numberMatch = text.match(/[\d,]+/);
          if (numberMatch) {
            const number = numberMatch[0].replace(/,/g, '');
            if (text.includes('followers')) {
              profileInfo.followersCount = number;
            } else if (text.includes('following')) {
              profileInfo.followingCount = number;
            } else if (text.includes('posts')) {
              profileInfo.postsCount = number;
            }
          }
        }
      });
      
      return profileInfo;
    });
  }

  async downloadImage(imageUrl, filename) {
    try {
      console.log(`📥 Downloading image: ${filename}`);
      
      const viewSource = await this.page.goto(imageUrl);
      const imagePath = path.join(this.imagesDir, filename);
      
      fs.writeFileSync(imagePath, await viewSource.buffer());
      
      return filename;
    } catch (error) {
      console.error(`❌ Error downloading image ${filename}:`, error);
      return null;
    }
  }

  getImageExtension(imageUrl) {
    // Extract extension from URL
    const urlParts = imageUrl.split('?')[0]; // Remove query parameters
    const extension = urlParts.split('.').pop().toLowerCase();
    
    // Default to common formats
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
      return `.${extension}`;
    }
    
    // Default to .jpg if unclear
    return '.jpg';
  }

  async downloadProfileImage(profileInfo) {
    if (!profileInfo.profileImageUrl) {
      console.log("⚠️ No profile image URL found");
      return null;
    }

    try {
      console.log("📥 Downloading profile image...");
      
      // Generate filename for profile image
      const username = profileInfo.username || "profile";
      const extension = this.getImageExtension(profileInfo.profileImageUrl);
      const fileName = `${username}-profile${extension}`;
      
      const success = await this.downloadImage(profileInfo.profileImageUrl, fileName);
      
      if (success) {
        console.log(`✅ Profile image downloaded: ${fileName}`);
        return fileName;
      } else {
        console.error("❌ Failed to download profile image");
        return null;
      }
    } catch (error) {
      console.error("❌ Error downloading profile image:", error.message);
      return null;
    }
  }

  async createProductMarkdown(post, imagePath) {
    const slug = this.createSlug(post.title);
    const productDir = path.join(this.outputDir, slug);
    
    this.ensureDirectoryExists(productDir);
    
    const markdownContent = `---
title: "${post.title}"
date: ${post.date}
description: "${post.description || 'Beautiful jewelry piece from our Instagram collection'}"
image: "/img/products/${imagePath}"
pricing:
  - text: "Contact for pricing"
    price: ""
weight: 100
draft: false
instagram_post: "${post.url}"
instagram_id: "${post.id}"
---

${post.description || 'This beautiful jewelry piece is part of our exclusive collection. Contact us for more details and pricing.'}

## Product Details

- **Source**: Instagram Collection
- **Post ID**: ${post.id}
- **Date Added**: ${post.date}

Contact us to learn more about this piece or to place an order.
`;

    const markdownPath = path.join(productDir, 'index.md');
    fs.writeFileSync(markdownPath, markdownContent);
    
    console.log(`✅ Created product: ${slug}`);
    return slug;
  }

  createSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async saveProfileInfo(profileInfo) {
    if (!profileInfo) {
      console.log("⚠️ No profile info to save");
      return;
    }

    try {
      console.log("💾 Saving profile information...");
      
      // Save profile info as JSON for Hugo data
      const dataDir = path.join(this.outputDir, "..", "data");
      this.ensureDirectoryExists(dataDir);
      
      const profileData = {
        username: profileInfo.username,
        displayName: profileInfo.displayName,
        bio: profileInfo.bio,
        profileImage: profileInfo.profileImageFile ? `/img/products/${profileInfo.profileImageFile}` : null,
        stats: {
          posts: profileInfo.postsCount,
          followers: profileInfo.followersCount,
          following: profileInfo.followingCount
        },
        lastUpdated: new Date().toISOString()
      };
      
      const profilePath = path.join(dataDir, "instagram-profile.json");
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      
      console.log(`✅ Profile information saved to: ${profilePath}`);
      
      return profilePath;
    } catch (error) {
      console.error("❌ Error saving profile info:", error.message);
      return null;
    }
  }

  async processPostsAsProducts(posts) {
    console.log(`🏭 Processing ${posts.length} posts as products...`);
    
    const results = [];
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`Processing post ${i + 1}/${posts.length}: ${post.id}`);
      
      try {
        // Download image
        const imageExtension = post.imageUrl.includes('.jpg') ? '.jpg' : '.png';
        const imageName = `${post.id}${imageExtension}`;
        const downloadedImage = await this.downloadImage(post.imageUrl, imageName);
        
        if (downloadedImage) {
          // Create product markdown
          const productSlug = await this.createProductMarkdown(post, downloadedImage);
          
          results.push({
            success: true,
            postId: post.id,
            productSlug: productSlug,
            imagePath: downloadedImage
          });
        } else {
          results.push({
            success: false,
            postId: post.id,
            error: 'Failed to download image'
          });
        }
        
        // Add delay between requests
        await this.wait(1000);
        
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error);
        results.push({
          success: false,
          postId: post.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async close() {
    try {
      if (this.browser) {
        // Save session one more time before closing
        if (this.isLoggedIn) {
          console.log('💾 Saving final session before closing...');
          try {
            await this.saveSession();
            console.log('✅ Final session saved successfully!');
          } catch (sessionError) {
            console.error('⚠️  Warning: Could not save final session:', sessionError.message);
          }
        }
        
        console.log('🔄 Closing browser...');
        await this.browser.close();
        console.log('✅ Browser closed successfully');
      }
    } catch (error) {
      console.error('❌ Error closing browser:', error.message);
      // Force close if normal close fails
      try {
        if (this.browser) {
          await this.browser.close();
        }
      } catch (forceCloseError) {
        console.error('❌ Force close also failed:', forceCloseError.message);
      }
    }
  }

  // Method to manually clear saved session
  async clearSavedSession() {
    console.log('🗑️  Clearing saved login session...');
    this.clearSession();
    this.isLoggedIn = false;
    console.log('✅ Session cleared! You will need to login again next time.');
  }

  // Main method to scrape and convert Instagram posts to products
  async scrapeAndCreateProducts(instagramUrl, options = {}) {
    const {
      maxPosts = 20,
      skipExisting = true
    } = options;

    try {
      await this.init();
      
      // Scrape Instagram page
      const scrapedData = await this.scrapeInstagramPage(instagramUrl);
      const posts = scrapedData.posts;
      const profile = scrapedData.profile;
      
      // Save profile information
      if (profile) {
        await this.saveProfileInfo(profile);
      }
      
      // Limit posts if specified
      const postsToProcess = posts.slice(0, maxPosts);
      
      // Process posts as products
      const results = await this.processPostsAsProducts(postsToProcess);
      
      // Generate summary
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log('\n📊 SUMMARY:');
      console.log(`✅ Successfully created: ${successful.length} products`);
      console.log(`❌ Failed: ${failed.length} posts`);
      
      if (profile) {
        console.log(`👤 Profile: ${profile.username || 'Unknown'}`);
        console.log(`🖼️ Profile image: ${profile.profileImageFile ? 'Downloaded' : 'Not found'}`);
      }
      
      if (failed.length > 0) {
        console.log('\n❌ Failed posts:');
        failed.forEach(f => {
          console.log(`- ${f.postId}: ${f.error}`);
        });
      }
      
      return {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        results: results
      };
      
    } catch (error) {
      console.error('❌ Fatal error:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Export for use as module
module.exports = InstagramScraper;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📱 Instagram to Products Scraper

Usage: node instagram-scraper.js <instagram-url> [options]

Examples:
  node instagram-scraper.js "https://www.instagram.com/yourbrand/"
  node instagram-scraper.js "https://www.instagram.com/yourbrand/" --max-posts=10
  node instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass

Options:
  --max-posts=N    Maximum number of posts to process (default: 20)
  --skip-existing  Skip existing products (default: true)
  --username=USER  Instagram username for private pages
  --password=PASS  Instagram password for private pages
    `);
    process.exit(1);
  }

  const instagramUrl = args[0];
  const options = {};
  const credentials = {};
  
  // Parse options
  args.slice(1).forEach(arg => {
    if (arg.startsWith('--max-posts=')) {
      options.maxPosts = parseInt(arg.split('=')[1]);
    }
    if (arg === '--no-skip-existing') {
      options.skipExisting = false;
    }
    if (arg.startsWith('--username=')) {
      credentials.username = arg.split('=')[1];
    }
    if (arg.startsWith('--password=')) {
      credentials.password = arg.split('=')[1];
    }
  });

  // Create scraper with credentials if provided
  const scraper = credentials.username && credentials.password 
    ? new InstagramScraper(credentials)
    : new InstagramScraper();
  
  scraper.scrapeAndCreateProducts(instagramUrl, options)
    .then(results => {
      console.log('\n🎉 Scraping completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Scraping failed:', error);
      process.exit(1);
    });
}
