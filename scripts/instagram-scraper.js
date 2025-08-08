/**
 * Enhanced Instagram Scraper with Persistent Browser Data
 * 
 * Features:
 * - Persistent browser data stored in d:\puppeteer-data
 * - Maintains login sessions across script runs (no more repeated logins!)
 * - Acts like a normal browser with saved cookies, cache, and preferences
 * - Anti-detection with stealth configuration
 * - Modal/captcha handling with manual intervention
 * - Complete page sync with existing CMS products
 * - Enhanced media handling (images + videos)
 * - Professional CMS integration with Hugo/Decap
 * 
 * The persistent browser data means:
 * ✅ Login once, stay logged in across script runs
 * ✅ Browser remembers your preferences and settings
 * ✅ Looks more like regular browser usage to Instagram
 * ✅ Faster startup times (no need to rebuild browser state)
 * ✅ Session persistence even after script restarts
 */

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
    this.imagesDir = path.join(__dirname, '../site/static/img'); // Main CMS media folder
    this.instagramDir = path.join(__dirname, '../site/static/img'); // Same as main folder for CMS visibility
    this.sessionDir = path.join(__dirname, '../.instagram-session');
    this.cookiesFile = path.join(this.sessionDir, 'cookies.json');
    this.sessionFile = path.join(this.sessionDir, 'session.json');
    this.userDataDir = "d:\\puppeteer-data"; // Persistent browser data directory
    
    // Ensure directories exist
    this.ensureDirectoryExists(this.outputDir);
    this.ensureDirectoryExists(this.imagesDir);
    this.ensureDirectoryExists(this.sessionDir);
    this.ensureDirectoryExists(this.userDataDir);
  }

  // Utility function to replace deprecated waitForTimeout
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForModalHandling(context = "general") {
    // Skip modal checking when we're just viewing posts/content
    if (context === "viewing_posts" || context === "extracting_data") {
      return false;
    }
    
    console.log(`🔍 Checking for modals/captchas (context: ${context})...`);
    
    const modalSelectors = [
      // Only check for actual security/captcha modals, not content modals
      '[data-testid="captcha"]',
      'iframe[src*="recaptcha"]',
      'iframe[title*="reCAPTCHA"]',
      '.g-recaptcha',
      '#captcha',
      '[aria-label*="captcha"]',
      '[class*="captcha"]',
      'div[class*="challenge"]',
      
      // Security check modals (be more specific)
      'div:contains("We Detected Unusual Activity")',
      'div:contains("Suspicious Login Attempt")',
      'div:contains("Confirm Your Identity")',
      'div:contains("Security Check")',
      'div:contains("Please confirm")',
      'div:contains("Challenge Required")',
      
      // Phone/Email verification
      'div:contains("Enter Confirmation Code")',
      'div:contains("Two-Factor Authentication")',
      'div:contains("Login Code")',
      'div:contains("We sent you a code")',
      
      // Rate limiting modals (only these specific ones)
      'div:contains("Try Again Later")',
      'div:contains("Please wait a few minutes")',
      'div:contains("Too many requests")',
      'div:contains("Action Blocked")'
    ];
    
    let modalFound = false;
    let modalType = "unknown";
    
    for (const selector of modalSelectors) {
      try {
        let element = null;
        
        // Handle text-based selectors
        if (selector.includes(":contains(")) {
          const searchText = selector.match(/:contains\("([^"]+)"\)/)[1];
          const allElements = await this.page.$$("div, span, p, h1, h2, h3");
          
          for (const el of allElements) {
            const text = await this.page.evaluate((elem) => elem.textContent?.trim(), el);
            if (text && text.includes(searchText)) {
              element = el;
              modalType = searchText;
              break;
            }
          }
        } else {
          // Regular CSS selectors
          element = await this.page.$(selector);
          if (element) {
            modalType = selector;
          }
        }
        
        if (element) {
          // Check if the modal is actually visible and blocking
          const isVisible = await this.page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisibleElement = rect.width > 0 && rect.height > 0 &&
                   style.display !== "none" &&
                   style.visibility !== "hidden" &&
                   style.opacity !== "0";
            
            // Additional check: is it actually a blocking modal?
            const isModal = style.position === "fixed" || 
                          style.position === "absolute" ||
                          el.closest('[role="dialog"]') !== null ||
                          el.closest('[aria-modal="true"]') !== null;
            
            return isVisibleElement && isModal;
          }, element);
          
          if (isVisible) {
            modalFound = true;
            console.log(`🚨 BLOCKING MODAL DETECTED: ${modalType}`);
            break;
          }
        }
      } catch (e) {
        // Continue checking other selectors
        continue;
      }
    }
    
    if (modalFound) {
      console.log("\n🛑 ===============================================");
      console.log("🚨 MANUAL INTERVENTION REQUIRED");
      console.log("===============================================");
      console.log(`📝 Modal Type: ${modalType}`);
      console.log("👤 Please handle the modal/captcha manually:");
      console.log("   1. Complete any captcha if present");
      console.log("   2. Enter verification codes if requested");
      console.log("   3. Handle any security challenges");
      console.log("   4. Click through any required buttons");
      console.log("   5. Wait until you return to normal Instagram page");
      console.log("\n⏳ Script will automatically continue when modal is gone...");
      console.log("💡 Press Ctrl+C if you want to cancel");
      console.log("===============================================\n");
      
      // Wait for modal to disappear
      let modalStillPresent = true;
      let checkCount = 0;
      const maxChecks = 300; // 5 minutes maximum
      
      while (modalStillPresent && checkCount < maxChecks) {
        await this.wait(1000); // Check every second
        checkCount++;
        
        // Re-check if modal is still present
        modalStillPresent = false;
        
        for (const selector of modalSelectors) {
          try {
            let element = null;
            
            if (selector.includes(":contains(")) {
              const searchText = selector.match(/:contains\("([^"]+)"\)/)[1];
              const allElements = await this.page.$$("div, span, p, h1, h2, h3");
              
              for (const el of allElements) {
                const text = await this.page.evaluate((elem) => elem.textContent?.trim(), el);
                if (text && text.includes(searchText)) {
                  element = el;
                  break;
                }
              }
            } else {
              element = await this.page.$(selector);
            }
            
            if (element) {
              const isVisible = await this.page.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 &&
                       style.display !== "none" &&
                       style.visibility !== "hidden" &&
                       style.opacity !== "0";
              }, element);
              
              if (isVisible) {
                modalStillPresent = true;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // Show progress every 10 seconds
        if (checkCount % 10 === 0) {
          console.log(`⏳ Still waiting for modal to be handled... (${checkCount}s elapsed)`);
        }
      }
      
      if (modalStillPresent) {
        throw new Error("Modal handling timeout: Please complete the required actions within 5 minutes");
      } else {
        console.log("✅ Modal handled successfully! Continuing...");
        // Wait a bit more to ensure page stabilizes
        await this.wait(3000);
      }
    }
    
    return modalFound;
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
        // First check for modals/captchas that need manual handling
        const modalHandled = await this.waitForModalHandling();
        if (modalHandled) {
          // If a modal was handled, continue checking for login completion
          console.log('✅ Modal handled, continuing login check...');
        }
        
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
      
      // More conservative human behavior - reduced randomness
      // Random scroll to simulate reading (smaller amounts)
      await this.page.evaluate(() => {
        const scrollAmount = Math.random() * 100 + 50; // Reduced from 300+100
        window.scrollBy(0, scrollAmount);
      });
      
      // Shorter wait times
      await this.wait(500 + Math.random() * 1000); // Reduced from 1000 + 2000
      
      // Reduce mouse movement frequency and distance
      if (Math.random() > 0.8) { // Reduced from 0.7
        const viewport = this.page.viewport();
        const x = Math.random() * (viewport.width * 0.5) + (viewport.width * 0.25); // Stay in center area
        const y = Math.random() * (viewport.height * 0.5) + (viewport.height * 0.25); // Stay in center area
        
        await this.page.mouse.move(x, y, { steps: 5 }); // Reduced steps from 10
        await this.wait(200 + Math.random() * 300); // Reduced wait time
      }
      
      // Remove random clicking during scrolling - this might cause navigation
      // if (Math.random() > 0.7) {
      //   await this.page.mouse.click(x, y);
      //   await this.wait(500);
      // }
      
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

  checkPersistentDataExists() {
    try {
      // Check if the browser data directory has been used before
      const browserDataExists = fs.existsSync(this.userDataDir) && 
                               fs.readdirSync(this.userDataDir).length > 0;
      
      if (browserDataExists) {
        console.log("📁 Found existing browser data - login may be preserved");
        return true;
      } else {
        console.log("📁 No existing browser data found - fresh start");
        return false;
      }
    } catch (error) {
      console.log("⚠️ Could not check browser data directory");
      return false;
    }
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async init() {
    console.log("🚀 Starting Instagram scraper...");
    console.log("🌐 Using proxy: localhost:10808");
    console.log("💾 Using persistent browser data: d:\\puppeteer-data");
    
    // Check if we have existing browser data
    this.checkPersistentDataExists();
    
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Keep visible to appear more human
        defaultViewport: null,
        userDataDir: this.userDataDir, // Use persistent browser data directory
        args: [
          // Proxy configuration
          "--proxy-server=localhost:10808",
          
          // Basic security
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          
          // Anti-detection measures
          "--disable-blink-features=AutomationControlled",
          "--disable-features=VizDisplayCompositor",
          "--disable-automation",
          "--disable-web-security",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-client-side-phishing-detection",
          "--disable-sync",
          "--disable-default-apps",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-hang-monitor",
          "--disable-popup-blocking",
          "--disable-prompt-on-repost",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-features=TranslateUI,BlinkGenPropertyTrees",
          "--no-first-run",
          "--no-default-browser-check",
          "--no-zygote",
          "--disable-gpu",
          
          // Make it look more like a real browser
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "--window-size=1920,1080",
          "--disable-infobars",
          "--start-maximized",
          
          // Additional privacy flags (remove incognito as it conflicts with userDataDir)
          "--disable-logging",
          "--disable-gpu-logging",
          "--silent"
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
    
    // Set larger viewport for better content visibility
    await this.page.setViewport({ 
      width: 1920, 
      height: 1080,
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
      
      // Check for modals/captchas before proceeding
      await this.waitForModalHandling("login");

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
      console.log('   ✅ Session persistence (login once, stay logged in)');
      console.log('   ✅ Automatic modal/captcha detection\n');

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
      console.log(`📱 Navigating directly to ${instagramUrl}...`);
      
      // Navigate directly to the target page first
      try {
        await this.page.goto(instagramUrl, { 
          waitUntil: "networkidle0",
          timeout: 90000
        });
        
        await this.wait(3000);
        
        // Check if we're already logged in using persistent browser data
        const alreadyLoggedIn = await this.checkLoginStatus();
        if (alreadyLoggedIn) {
          console.log("✅ Already logged in via persistent browser data!");
          this.isLoggedIn = true;
        } else {
          console.log("⚠️ Not logged in, will need to authenticate");
          
          // Check if we got redirected to login page
          const currentUrl = this.page.url();
          if (currentUrl.includes('/accounts/login/') && this.credentials) {
            console.log("🔄 Redirected to login page, will authenticate first");
            await this.login();
            // Navigate back to target page after login
            console.log(`📱 Returning to ${instagramUrl}...`);
            await this.page.goto(instagramUrl, { 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            await this.wait(3000);
          }
        }
        
      } catch (error) {
        console.log("⚠️ Direct navigation failed, trying login first approach...");
        
        // Fallback: Login first if credentials are provided and we're not logged in
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
      }

      // Wait for page to load (increased for proxy)
      await this.wait(8000);
      
      // Check for modals/captchas after page load
      await this.waitForModalHandling("page_load");

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
          // Check for modals after re-navigation
          await this.waitForModalHandling("re_navigation");
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

      // Prevent accidental navigation by disabling certain click events during scrolling
      await this.page.evaluate(() => {
        // Temporarily disable navigation clicks during scrolling
        const preventNavigation = (event) => {
          // Don't prevent all clicks, just navigation ones
          const target = event.target;
          if (target && (target.tagName === 'A' || target.closest('a'))) {
            const href = target.href || target.closest('a')?.href;
            if (href && (href.includes('/p/') || href.includes('/reel/') || href.includes('/tv/'))) {
              console.log('🚫 Preventing navigation click during scrolling:', href);
              event.preventDefault();
              event.stopPropagation();
              return false;
            }
          }
        };
        
        // Add the event listener
        document.addEventListener('click', preventNavigation, true);
        
        // Store it so we can remove it later
        window.__scrollingNavPrevention = preventNavigation;
      });

      // Load all posts from the page (scroll to bottom to get everything)
      await this.loadAllPosts();

      // Remove the navigation prevention
      await this.page.evaluate(() => {
        if (window.__scrollingNavPrevention) {
          document.removeEventListener('click', window.__scrollingNavPrevention, true);
          delete window.__scrollingNavPrevention;
        }
      });

      // Add more human behavior after scrolling
      await this.addHumanBehavior();

      // Get all posts
      const posts = await this.extractPosts();
      
      console.log(`✅ Found ${posts.length} total posts on the page`);
      
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

  async loadAllPosts() {
    console.log('📜 Loading all posts from the page...');
    
    // Store the target URL to ensure we don't navigate away
    const targetUrl = this.page.url();
    console.log(`🎯 Target URL: ${targetUrl}`);
    
    let previousPostCount = 0;
    let stableCount = 0;
    let lastScrollHeight = 0;
    const maxScrollAttempts = 200; // Increased to ensure we get everything
    
    for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
      // Check if we're still on the correct page
      const currentUrl = this.page.url();
      if (!currentUrl.includes(targetUrl.split('?')[0])) {
        console.log(`🚨 Page navigation detected! Expected: ${targetUrl}, Current: ${currentUrl}`);
        console.log(`� Navigating back to target page...`);
        await this.page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.wait(3000);
      }
      
      console.log(`�📜 Scroll attempt ${attempt + 1}/${maxScrollAttempts}`);
      
      // Get current post count and scroll height
      const { currentPostCount, currentScrollHeight } = await this.page.evaluate(() => {
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
        
        return {
          currentPostCount: totalPosts,
          currentScrollHeight: document.body.scrollHeight
        };
      });
      
      console.log(`📊 Found ${currentPostCount} posts so far`);
      
      // Detect weird jumps that indicate page issues
      const postDifference = currentPostCount - previousPostCount;
      const heightDifference = currentScrollHeight - lastScrollHeight;
      
      if (attempt > 0 && (postDifference < -10 || heightDifference < -1000)) {
        console.log(`🚨 Unusual content change detected! Posts: ${postDifference}, Height: ${heightDifference}px`);
        console.log(`🔄 This suggests page navigation or dynamic content changes.`);
        
        // Wait longer and check URL again
        await this.wait(5000);
        const urlCheck = this.page.url();
        if (!urlCheck.includes(targetUrl.split('?')[0])) {
          console.log(`🚨 Confirmed page navigation! Returning to target page...`);
          await this.page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await this.wait(3000);
          continue; // Restart this attempt
        }
      }
      
      // Check if we've reached the end - both post count and scroll height stable
      const noNewPosts = currentPostCount === previousPostCount;
      const noMoreHeight = currentScrollHeight === lastScrollHeight;
      
      if (noNewPosts && noMoreHeight) {
        stableCount++;
        console.log(`⏸️ No changes detected (posts: ${currentPostCount}, height: ${currentScrollHeight}) - stable count: ${stableCount}`);
        
        // If nothing changed for 5 attempts (reduced from 10), try one final aggressive scroll
        if (stableCount >= 5) {
          console.log('⚡ Making final aggressive scroll attempt...');
          await this.page.evaluate(() => {
            // Scroll to absolute bottom
            window.scrollTo(0, document.body.scrollHeight);
          });
          await this.wait(2000); // Reduced from 3000
          
          // Check if this revealed more content
          const finalCheck = await this.page.evaluate(() => {
            const totalPosts = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length;
            return {
              currentPostCount: totalPosts,
              currentScrollHeight: document.body.scrollHeight
            };
          });
          
          if (finalCheck.currentPostCount > currentPostCount) {
            console.log(`🎯 Found ${finalCheck.currentPostCount - currentPostCount} more posts after aggressive scroll!`);
            stableCount = 0; // Reset and continue
            continue;
          }
          
          console.log('✅ Reached end of page - all posts loaded');
          break;
        }
      } else {
        stableCount = 0; // Reset stable count if something changed
        if (!noNewPosts && postDifference > 0) {
          console.log(`📈 Found ${postDifference} new posts`);
        }
        if (!noMoreHeight && heightDifference > 0) {
          console.log(`📏 Page height increased: ${heightDifference}px`);
        }
      }
      
      previousPostCount = currentPostCount;
      lastScrollHeight = currentScrollHeight;
      
      // Check if we're at the bottom of the page
      const isAtBottom = await this.page.evaluate(() => {
        return window.innerHeight + window.scrollY >= document.body.scrollHeight - 100;
      });
      
      if (isAtBottom && stableCount >= 2) {
        console.log('✅ Reached bottom of page and no new content loading');
        break;
      }
      
      // Perform more careful scrolling to avoid triggering navigation
      await this.page.evaluate(async () => {
        const currentScroll = window.scrollY;
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        const scrollStep = Math.min(300, maxScroll - currentScroll); // Smaller scroll steps
        
        if (scrollStep > 0) {
          // Scroll more gradually
          window.scrollBy(0, scrollStep);
          await new Promise(resolve => setTimeout(resolve, 1500)); // Longer wait for content loading
        }
      });
      
      // Wait for new content to load - reduced time
      await this.wait(1000); // Reduced from 4000
      
      // Only check for modals occasionally during scrolling to avoid false positives
      if (attempt % 5 === 0) {
        await this.waitForModalHandling("scrolling");
      }
      
      // Reduce human behavior during scrolling to avoid issues
      if (attempt % 3 === 0) {
        await this.addHumanBehavior();
      }
    }
    
    // Final verification and get complete post list
    const finalStats = await this.page.evaluate(() => {
      const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      const uniquePosts = new Map();
      
      postLinks.forEach(link => {
        const href = link.href;
        if (href && (href.includes('/p/') || href.includes('/reel/'))) {
          const match = href.match(/\/(?:p|reel)\/([^\/\?]+)/);
          if (match) {
            const postId = match[1];
            if (!uniquePosts.has(postId)) {
              uniquePosts.set(postId, {
                id: postId,
                url: href,
                type: href.includes('/reel/') ? 'reel' : 'post'
              });
            }
          }
        }
      });
      
      return {
        totalPosts: uniquePosts.size,
        scrollHeight: document.body.scrollHeight,
        isAtBottom: window.innerHeight + window.scrollY >= document.body.scrollHeight - 50,
        posts: Array.from(uniquePosts.values())
      };
    });
    
    console.log(`📊 Final stats: ${finalStats.totalPosts} unique posts, height: ${finalStats.scrollHeight}px, at bottom: ${finalStats.isAtBottom}`);
    
    // Log the complete post list
    console.log('\n📋 COMPLETE POST LIST:');
    console.log('========================');
    finalStats.posts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.type.toUpperCase()}: ${post.id} - ${post.url}`);
    });
    console.log('========================\n');
    
    // Store the post list for later use
    this.discoveredPosts = finalStats.posts;
    
    return finalStats.posts;
  }

  async extractPosts() {
    console.log("🔍 Extracting posts data...");
    
    try {
      // First, let's debug what HTML structure we're actually seeing
      const debugInfo = await this.page.evaluate(() => {
        // Get some sample HTML to understand the structure
        const body = document.body;
        const main = document.querySelector('main');
        const articles = document.querySelectorAll('article');
        
        // Sample some post links
        const allLinks = Array.from(document.querySelectorAll('a')).slice(0, 20);
        const postLinks = allLinks.filter(a => a.href && (a.href.includes('/p/') || a.href.includes('/reel/')));
        
        return {
          bodyHtml: body ? body.innerHTML.substring(0, 1000) + '...' : 'No body found',
          mainHtml: main ? main.innerHTML.substring(0, 1000) + '...' : 'No main found',
          articleCount: articles.length,
          allLinksCount: allLinks.length,
          postLinksCount: postLinks.length,
          samplePostLinks: postLinks.slice(0, 5).map(a => ({
            href: a.href,
            outerHTML: a.outerHTML.substring(0, 200) + '...',
            parentHTML: a.parentElement ? a.parentElement.outerHTML.substring(0, 300) + '...' : 'No parent'
          }))
        };
      });
      
      console.log("🔍 DEBUG: Page structure analysis:");
      console.log("📊 Article elements found:", debugInfo.articleCount);
      console.log("📊 Total links found:", debugInfo.allLinksCount);
      console.log("📊 Post links found:", debugInfo.postLinksCount);
      console.log("🔗 Sample post links:", JSON.stringify(debugInfo.samplePostLinks, null, 2));
      
      // If we found very few posts, dump more HTML structure
      if (debugInfo.postLinksCount < 5) {
        console.log("⚠️ Very few posts found, dumping HTML structure:");
        console.log("📄 Body HTML sample:", debugInfo.bodyHtml);
        console.log("📄 Main HTML sample:", debugInfo.mainHtml);
      }
      
      // Now proceed with the original extraction logic but with better selectors
      const selectorCounts = await this.page.evaluate(() => {
        const postSelectors = [
          "a[href*=\"/p/\"]",
          "a[href*=\"/reel/\"]",
          "article a",
          "main a",
          "[role=\"link\"]",
          "div a[href*=\"instagram.com\"]"
        ];
        
        const counts = {};
        for (const selector of postSelectors) {
          const elements = document.querySelectorAll(selector);
          counts[selector] = elements.length;
        }
        return counts;
      });
      
      console.log("📊 Post selector counts:", selectorCounts);
      
      // Save HTML structure to file for debugging
      const htmlDump = await this.page.evaluate(() => {
        const main = document.querySelector('main');
        return {
          title: document.title,
          url: window.location.href,
          mainHTML: main ? main.outerHTML.substring(0, 10000) : 'No main found',
          bodyHTML: document.body.outerHTML.substring(0, 5000)
        };
      });
      
      // Save to file for inspection
      const fs = require('fs');
      const path = require('path');
      const debugFile = path.join(__dirname, 'instagram-debug.html');
      const debugContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Instagram Debug - ${htmlDump.title}</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .section { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        pre { white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>Instagram Page Debug</h1>
    <div class="section">
        <h2>Page Info</h2>
        <p><strong>URL:</strong> ${htmlDump.url}</p>
        <p><strong>Title:</strong> ${htmlDump.title}</p>
    </div>
    <div class="section">
        <h2>Main Element HTML</h2>
        <pre>${htmlDump.mainHTML.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>
    <div class="section">
        <h2>Body HTML (first 5000 chars)</h2>
        <pre>${htmlDump.bodyHTML.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>
</body>
</html>`;
      
      fs.writeFileSync(debugFile, debugContent);
      console.log(`📄 HTML structure saved to: ${debugFile}`);
      console.log("💡 Open this file in a browser to inspect the HTML structure");
      
      // Find the selector with the most matches
      const bestSelector = Object.keys(selectorCounts).reduce((a, b) => 
        selectorCounts[a] > selectorCounts[b] ? a : b
      );
      
      console.log(`🎯 Using best selector: "${bestSelector}" (${selectorCounts[bestSelector]} elements)`);
      
      const posts = await this.page.evaluate((selectedSelector) => {
        const posts = [];
        const seenUrls = new Set();
        
        try {
          const elements = document.querySelectorAll(selectedSelector);
          
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            
            try {
              let postUrl = "";
              
              // Get post URL - handle both direct links and nested links
              if (element.tagName === "A") {
                postUrl = element.href;
              } else {
                const linkElement = element.querySelector("a[href*=\"/p/\"], a[href*=\"/reel/\"], a[href*=\"/tv/\"]");
                postUrl = linkElement ? linkElement.href : "";
              }
              
              // Clean the URL
              if (postUrl && postUrl.includes("#")) {
                postUrl = postUrl.split("#")[0];
              }
              
              // Skip if we've already seen this URL or it's invalid
              if (!postUrl || seenUrls.has(postUrl)) {
                continue;
              }
              
              // More flexible URL validation
              const isValidInstagramUrl = postUrl.includes("instagram.com") &&
                                        (postUrl.includes("/p/") ||
                                         postUrl.includes("/reel/") ||
                                         postUrl.includes("/tv/"));
              
              if (!isValidInstagramUrl) {
                continue;
              }
              
              // Extract post ID with better error handling
              let postId = "";
              try {
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
                  // Generate fallback ID
                  const urlParts = postUrl.split("/");
                  for (let j = urlParts.length - 1; j >= 0; j--) {
                    if (urlParts[j] && urlParts[j].length > 5) {
                      postId = urlParts[j].split("?")[0];
                      break;
                    }
                  }
                  
                  if (!postId) {
                    postId = `post-${Date.now()}-${i}`;
                  }
                }
              } catch (idError) {
                postId = `post-${Date.now()}-${i}`;
              }
              
              // Determine post type
              let postType = "image";
              if (postUrl.includes("/reel/") || postUrl.includes("/tv/")) {
                postType = "video";
              }
              
              // Create basic media data structure
              const mediaData = {
                images: [],
                videos: [],
                type: postType
              };
              
              // Try to find associated media elements
              try {
                // Look for images or videos near this link
                const container = element.closest("div") || element.parentElement;
                if (container) {
                  const imgs = container.querySelectorAll("img");
                  const videos = container.querySelectorAll("video");
                  
                  imgs.forEach(img => {
                    if (img.src && img.src.startsWith("http") &&
                        !img.src.includes("profile") && !img.src.includes("avatar") &&
                        img.width > 50 && img.height > 50) {
                      mediaData.images.push({
                        url: img.src,
                        alt: img.alt || "",
                        width: img.naturalWidth || img.width,
                        height: img.naturalHeight || img.height
                      });
                    }
                  });
                  
                  videos.forEach(video => {
                    if (video.src || video.currentSrc) {
                      mediaData.videos.push({
                        url: video.src || video.currentSrc,
                        type: video.type || "video/mp4",
                        width: video.videoWidth || video.offsetWidth,
                        height: video.videoHeight || video.offsetHeight,
                        poster: video.poster || ""
                      });
                    }
                  });
                }
              } catch (mediaError) {
                // Continue without media if extraction fails
              }
              
              seenUrls.add(postUrl);
              posts.push({
                id: postId,
                url: postUrl,
                mediaData: mediaData,
                description: `Instagram ${postType} post`,
                title: `Instagram ${postType === "video" ? "Video" : "Post"} ${postId}`,
                date: new Date().toISOString().split("T")[0],
                type: postType
              });
              
            } catch (elementError) {
              // Continue to next element if this one fails
              continue;
            }
          }
          
        } catch (selectorError) {
          // Return empty array if selector fails
          return [];
        }
        
        return posts;
        
      }, bestSelector);
      
      console.log(`✅ Successfully extracted ${posts.length} posts`);
      console.log("📋 Post IDs:", posts.map(p => p.id).join(", "));
      
      return posts;
      
    } catch (error) {
      console.error("❌ Error in extractPosts:", error.message);
      console.error("� Stack trace:", error.stack);
      return []; // Return empty array on error
    }
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

  async downloadMedia(mediaUrl, filename, mediaType = 'image') {
    try {
      console.log(`📥 Downloading ${mediaType}: ${filename}`);
      
      // Create a new page for downloading to avoid affecting the main page
      const downloadPage = await this.browser.newPage();
      
      try {
        // Set proper headers to mimic a browser request
        await downloadPage.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        // Try to get the media with proper referrer
        const response = await downloadPage.goto(mediaUrl, { 
          waitUntil: 'networkidle0',
          timeout: 30000,
          referer: 'https://www.instagram.com/'
        });
        
        if (!response || !response.ok()) {
          // If direct access fails, try alternative method
          console.log(`⚠️ Direct download failed (${response?.status()}), trying alternative method...`);
          
          // Try to load the image in a more browser-like way
          await downloadPage.evaluate((url) => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('Image load failed'));
              img.src = url;
            });
          }, mediaUrl);
          
          // Now try to get it again
          const retryResponse = await downloadPage.goto(mediaUrl, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
          });
          
          if (!retryResponse || !retryResponse.ok()) {
            throw new Error(`Failed to fetch media after retry: ${retryResponse?.status() || 'no response'}`);
          }
          
          const buffer = await retryResponse.buffer();
          const mediaPath = path.join(this.imagesDir, filename);
          fs.writeFileSync(mediaPath, buffer);
          
        } else {
          // Direct access worked
          const buffer = await response.buffer();
          const mediaPath = path.join(this.imagesDir, filename);
          fs.writeFileSync(mediaPath, buffer);
        }
        
        console.log(`✅ Downloaded ${mediaType}: ${filename} (${mediaType === 'image' ? 'image' : 'video'} file)`);
        return filename;
        
      } finally {
        // Always close the download page
        await downloadPage.close();
      }
      
    } catch (error) {
      console.error(`❌ Error downloading ${mediaType} ${filename}:`, error.message);
      
      // Try one more approach - screenshot the image element from the main page
      if (mediaType === 'image') {
        try {
          console.log(`🔄 Attempting screenshot method for ${filename}...`);
          
          // Find the image element on the main page
          const imgElement = await this.page.$(`img[src="${mediaUrl}"]`);
          if (imgElement) {
            const screenshotBuffer = await imgElement.screenshot();
            const mediaPath = path.join(this.imagesDir, filename);
            fs.writeFileSync(mediaPath, screenshotBuffer);
            console.log(`✅ Downloaded ${mediaType} via screenshot: ${filename}`);
            return filename;
          }
        } catch (screenshotError) {
          console.error(`❌ Screenshot method also failed:`, screenshotError.message);
        }
      }
      
      return null;
    }
  }

  async downloadMediaFromPage(mediaUrl, filename, mediaType = "image") {
    try {
      console.log(`📸 Capturing ${mediaType} from page: ${filename}`);
      
      // Wait for page to be fully loaded
      await this.wait(2000);
      
      // Find all image and video elements on the current page
      const mediaElements = await this.page.$$("img, video");
      let targetElement = null;
      
      // Look for the media element that matches our URL
      for (const element of mediaElements) {
        const src = await this.page.evaluate(el => el.src || el.currentSrc, element);
        
        // Check if this element's src matches our target URL
        if (src && (src === mediaUrl || src.includes(mediaUrl.split("?")[0]) || mediaUrl.includes(src.split("?")[0]))) {
          // Verify the element is visible
          const isVisible = await this.page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 50 && rect.height > 50 &&
                   style.display !== "none" &&
                   style.visibility !== "hidden" &&
                   style.opacity !== "0";
          }, element);
          
          if (isVisible) {
            targetElement = element;
            console.log(`📍 Found matching visible ${mediaType} element`);
            break;
          }
        }
      }
      
      // If we didn't find a match by URL, try to find the largest visible image/video
      if (!targetElement && mediaType === "image") {
        console.log('🔍 No URL match found, looking for largest visible image...');
        
        const largestElement = await this.page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          let largest = null;
          let maxArea = 0;
          
          for (const img of images) {
            const rect = img.getBoundingClientRect();
            const style = window.getComputedStyle(img);
            const area = rect.width * rect.height;
            
            // Check if image is visible and reasonable size
            if (rect.width > 200 && rect.height > 200 &&
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                area > maxArea) {
              maxArea = area;
              largest = img;
            }
          }
          
          return largest;
        });
        
        if (largestElement) {
          targetElement = largestElement;
          console.log('📍 Using largest visible image as fallback');
        }
      }
      
      if (targetElement) {
        if (mediaType === "image") {
          // Screenshot the image element
          const screenshotBuffer = await targetElement.screenshot({
            type: "jpeg",
            quality: 90
          });
          
          const mediaPath = path.join(this.imagesDir, filename);
          fs.writeFileSync(mediaPath, screenshotBuffer);
          console.log(`✅ Captured image from page: ${filename}`);
          return filename;
        } else if (mediaType === "video") {
          // For videos, try to get the video URL and download it
          const videoSrc = await this.page.evaluate(el => {
            return el.src || el.currentSrc || 
                   (el.querySelector("source") && el.querySelector("source").src);
          }, targetElement);
          
          if (videoSrc) {
            return await this.downloadMedia(videoSrc, filename, mediaType);
          }
        }
      }
      
      console.log(`❌ Could not find visible ${mediaType} element on page`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error capturing ${mediaType} from page:`, error.message);
      return null;
    }
  }

  async extractMediaFromPostPage() {
    console.log("🔍 Extracting media from post page...");
    
    return await this.page.evaluate(() => {
      const mediaData = { images: [], videos: [] };
      
      // Look for images - Instagram post images
      const images = document.querySelectorAll('img');
      
      images.forEach(img => {
        if (img.src && img.src.startsWith('http') && !img.src.includes('profile') && !img.src.includes('avatar')) {
          // Check if it's a content image (not a UI element)
          const rect = img.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            // Get higher resolution version if available
            let imageUrl = img.src;
            
            // Instagram often has different resolutions in srcset
            if (img.srcset) {
              const srcsetEntries = img.srcset.split(',');
              // Get the highest resolution available
              const highestRes = srcsetEntries[srcsetEntries.length - 1];
              if (highestRes) {
                imageUrl = highestRes.trim().split(' ')[0];
              }
            }
            
            mediaData.images.push({
              url: imageUrl,
              alt: img.alt || '',
              width: img.naturalWidth || rect.width,
              height: img.naturalHeight || rect.height
            });
          }
        }
      });
      
      // Look for videos
      const videos = document.querySelectorAll('video');
      
      videos.forEach(video => {
        if (video.src || video.currentSrc) {
          const rect = video.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            mediaData.videos.push({
              url: video.src || video.currentSrc,
              type: video.type || 'video/mp4',
              width: video.videoWidth || rect.width,
              height: video.videoHeight || rect.height,
              poster: video.poster || ''
            });
          }
        }
      });
      
      // Remove duplicates
      mediaData.images = mediaData.images.filter((img, index, arr) => 
        arr.findIndex(i => i.url === img.url) === index
      );
      mediaData.videos = mediaData.videos.filter((vid, index, arr) => 
        arr.findIndex(v => v.url === vid.url) === index
      );
      
      console.log(`📊 Extracted ${mediaData.images.length} images and ${mediaData.videos.length} videos from post page`);
      
      return mediaData;
    });
  }

  async downloadPostMedia(post) {
    const downloadedFiles = {
      images: [],
      videos: [],
      primaryMedia: null,
      mediaType: post.type
    };

    try {
      console.log(`📱 Processing ${post.type} post: ${post.id}`);
      
      // Navigate to the actual post page to get better media access
      let postUrl = post.url;
      
      // Clean the URL and ensure it's a direct post URL
      if (postUrl.includes('#')) {
        postUrl = postUrl.split('#')[0];
      }
      if (postUrl.includes('?')) {
        postUrl = postUrl.split('?')[0];
      }
      
      // Ensure it's a proper post URL format
      if (!postUrl.includes('/p/') && !postUrl.includes('/reel/')) {
        console.log(`⚠️ Invalid post URL format: ${postUrl}`);
        return downloadedFiles;
      }
      
      console.log(`🔗 Navigating to post page: ${postUrl}`);
      
      try {
        // Navigate to the actual post page
        await this.page.goto(postUrl, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });
        await this.wait(3000);
        
        // Extract media from the actual post page
        const pageMediaData = await this.extractMediaFromPostPage();
        
        if (pageMediaData.images.length > 0) {
          post.mediaData.images = pageMediaData.images;
          console.log(`📸 Found ${pageMediaData.images.length} images on post page`);
        }
        
        if (pageMediaData.videos.length > 0) {
          post.mediaData.videos = pageMediaData.videos;
          console.log(`🎥 Found ${pageMediaData.videos.length} videos on post page`);
        }
        
      } catch (navError) {
        console.log(`⚠️ Could not navigate to post page: ${navError.message}`);
        console.log('📋 Will try with original media data');
      }
      
      // Download images
      if (post.mediaData.images && post.mediaData.images.length > 0) {
        console.log(`📸 Found ${post.mediaData.images.length} images`);
        
        for (let i = 0; i < post.mediaData.images.length; i++) {
          const img = post.mediaData.images[i];
          const extension = this.getImageExtension(img.url);
          const filename = `instagram-${post.id}-img-${i + 1}${extension}`;
          
          // Try the enhanced download method first, then fallback to page capture
          let downloaded = await this.downloadMedia(img.url, filename, "image");
          
          // If download failed, try capturing from the current page
          if (!downloaded) {
            console.log(`🔄 Trying page capture method for ${filename}...`);
            downloaded = await this.downloadMediaFromPage(img.url, filename, "image");
          }
          
          if (downloaded) {
            downloadedFiles.images.push({
              filename: downloaded,
              alt: img.alt || "",
              width: img.width,
              height: img.height,
              url: `/img/${downloaded}`
            });
            
            // Set first image as primary if no primary set
            if (!downloadedFiles.primaryMedia) {
              downloadedFiles.primaryMedia = downloaded;
            }
          }
          
          // Add delay between downloads
          await this.wait(1000);
        }
      }
      
      // Download videos
      if (post.mediaData.videos && post.mediaData.videos.length > 0) {
        console.log(`🎥 Found ${post.mediaData.videos.length} videos`);
        
        for (let i = 0; i < post.mediaData.videos.length; i++) {
          const video = post.mediaData.videos[i];
          const extension = this.getVideoExtension(video.url);
          const filename = `instagram-${post.id}-video-${i + 1}${extension}`;
          
          const downloaded = await this.downloadMedia(video.url, filename, 'video');
          if (downloaded) {
            downloadedFiles.videos.push({
              filename: downloaded,
              type: video.type || 'video/mp4',
              width: video.width,
              height: video.height,
              poster: video.poster || '',
              url: `/img/${downloaded}`
            });
            
            // Set first video as primary if no primary set (videos take priority)
            if (!downloadedFiles.primaryMedia || post.type === 'video') {
              downloadedFiles.primaryMedia = downloaded;
              downloadedFiles.mediaType = 'video';
            }
          }
          
          // Add delay between downloads
          await this.wait(1500);
        }
      }
      
      return downloadedFiles;
      
    } catch (error) {
      console.error(`❌ Error downloading media for post ${post.id}:`, error.message);
      return downloadedFiles;
    }
  }

  getVideoExtension(videoUrl) {
    // Extract extension from URL
    const urlParts = videoUrl.split('?')[0]; // Remove query parameters
    const extension = urlParts.split('.').pop().toLowerCase();
    
    // Default to common video formats
    if (['mp4', 'mov', 'avi', 'webm', 'm4v'].includes(extension)) {
      return `.${extension}`;
    }
    
    // Default to .mp4 if unclear
    return '.mp4';
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
      console.log("📥 Downloading profile image for site logo...");
      
      // Generate filename for profile image
      const username = profileInfo.username || "profile";
      const extension = this.getImageExtension(profileInfo.profileImageUrl);
      const fileName = `${username}-profile${extension}`;
      
      // Download using the new media download system
      const success = await this.downloadMedia(profileInfo.profileImageUrl, fileName, "image");
      
      if (success) {
        // Also copy as site logo
        const logoPath = path.join(__dirname, '../site/static/img/logo.svg');
        const profilePath = path.join(this.imagesDir, fileName);
        const logoBackupPath = path.join(__dirname, '../site/static/img/logo-backup.svg');
        
        try {
          // Backup existing logo if it exists
          if (fs.existsSync(logoPath)) {
            if (!fs.existsSync(logoBackupPath)) {
              fs.copyFileSync(logoPath, logoBackupPath);
              console.log("📄 Backed up existing logo");
            }
          }
          
          // Copy profile image as new logo (keeping original extension)
          const newLogoPath = path.join(__dirname, '../site/static/img', `logo${extension}`);
          fs.copyFileSync(profilePath, newLogoPath);
          console.log(`✅ Profile image set as site logo: logo${extension}`);
          
        } catch (logoError) {
          console.log("⚠️ Could not replace logo, but profile image downloaded successfully");
        }
        
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

  async cleanExistingInstagramProducts() {
    console.log("🧹 Cleaning existing Instagram products...");
    
    try {
      const productsDirs = fs.readdirSync(this.outputDir);
      let removedCount = 0;
      
      for (const dir of productsDirs) {
        const fullPath = path.join(this.outputDir, dir);
        
        if (fs.statSync(fullPath).isDirectory() && dir.startsWith('instagram-post-')) {
          console.log(`🗑️ Removing existing Instagram product: ${dir}`);
          
          // Remove the directory and all its contents
          fs.rmSync(fullPath, { recursive: true, force: true });
          removedCount++;
        }
      }
      
      console.log(`✅ Removed ${removedCount} existing Instagram products`);
      return removedCount;
      
    } catch (error) {
      console.error("❌ Error cleaning existing products:", error.message);
      return 0;
    }
  }

  async createProductMarkdown(post, mediaFiles, profileUsername) {
    const slug = this.createSlug(post.title);
    const productDir = path.join(this.outputDir, slug);
    
    this.ensureDirectoryExists(productDir);
    
    // Determine primary media and build gallery
    const primaryMedia = mediaFiles.primaryMedia;
    const primaryMediaType = mediaFiles.mediaType;
    
    // Build gallery arrays for images and videos
    const imageGallery = mediaFiles.images.length > 1 ? 
      mediaFiles.images.slice(1).map(img => img.url) : [];
    const videoGallery = mediaFiles.videos.map(vid => vid.url);
    
    // Combine all media for gallery (excluding primary)
    const allGallery = [...imageGallery, ...videoGallery];
    
    // Create media metadata for CMS
    const mediaMetadata = {
      images: mediaFiles.images,
      videos: mediaFiles.videos,
      primaryType: primaryMediaType
    };
    
    // Helper function to safely escape YAML strings
    const escapeYaml = (str) => {
      if (!str) return '';
      // Replace problematic characters and use proper YAML escaping
      return str
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/"/g, '\\"')    // Escape quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '')      // Remove carriage returns
        .replace(/\t/g, ' ')     // Replace tabs with spaces
        .trim();
    };

    const markdownContent = `---
title: "${escapeYaml(post.title)}"
date: ${post.date}
description: "${escapeYaml(post.description || 'Beautiful jewelry piece from our Instagram collection')}"
image: "/img/${primaryMedia}"
primary_media_type: "${primaryMediaType}"
${allGallery.length > 0 ? `gallery:\n${allGallery.map(url => `  - "${url}"`).join('\n')}\n` : ''}${mediaFiles.images.length > 0 ? `images:\n${mediaFiles.images.map(img => `  - url: "${img.url}"\n    alt: "${escapeYaml(img.alt)}"\n    width: ${img.width}\n    height: ${img.height}`).join('\n')}\n` : ''}${mediaFiles.videos.length > 0 ? `videos:\n${mediaFiles.videos.map(vid => `  - url: "${vid.url}"\n    type: "${vid.type}"\n    width: ${vid.width}\n    height: ${vid.height}${vid.poster ? `\n    poster: "${vid.poster}"` : ''}`).join('\n')}\n` : ''}price: 0
category: "Instagram Collection"
in_stock: true
featured: false
weight: 100
draft: false
instagram_post: "${post.url}"
instagram_id: "${post.id}"
instagram_account: "${profileUsername || 'unknown'}"
post_type: "${post.type}"
media_count: ${mediaFiles.images.length + mediaFiles.videos.length}
---

${post.description || 'This beautiful jewelry piece is part of our exclusive collection. Contact us for more details and pricing.'}

## Product Details

- **Source**: Instagram Collection
- **Post ID**: ${post.id}
- **Account**: ${profileUsername || 'N/A'}
- **Date Added**: ${post.date}
- **Media Type**: ${primaryMediaType === 'video' ? 'Video Content' : 'Image Content'}
- **Total Media Files**: ${mediaFiles.images.length + mediaFiles.videos.length}
${mediaFiles.images.length > 0 ? `- **Images**: ${mediaFiles.images.length} files\n` : ''}${mediaFiles.videos.length > 0 ? `- **Videos**: ${mediaFiles.videos.length} files\n` : ''}${allGallery.length > 0 ? `- **Gallery Items**: ${allGallery.length} additional media files\n` : ''}

## Media Gallery

${mediaFiles.images.length > 0 ? `### Images (${mediaFiles.images.length})
${mediaFiles.images.map((img, index) => `${index + 1}. ![${img.alt}](${img.url})${img.alt ? ` - ${img.alt}` : ''}`).join('\n')}

` : ''}${mediaFiles.videos.length > 0 ? `### Videos (${mediaFiles.videos.length})
${mediaFiles.videos.map((vid, index) => `${index + 1}. [Video ${index + 1}](${vid.url}) (${vid.type})${vid.poster ? `\n   - Thumbnail: ![Video Thumbnail](${vid.poster})` : ''}`).join('\n')}

` : ''}Contact us to learn more about this piece or to place an order.

---
*This product was automatically imported from Instagram and may need pricing and description updates.*
`;

    const markdownPath = path.join(productDir, 'index.md');
    fs.writeFileSync(markdownPath, markdownContent);
    
    // Also save media metadata as JSON for advanced CMS features
    const metadataPath = path.join(productDir, 'media.json');
    fs.writeFileSync(metadataPath, JSON.stringify(mediaMetadata, null, 2));
    
    console.log(`✅ Created CMS product with ${mediaFiles.images.length + mediaFiles.videos.length} media files: ${slug}`);
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

  async getExistingProductIds() {
    console.log("🔍 Checking for existing Instagram products...");
    
    try {
      const existingIds = new Set();
      
      if (!fs.existsSync(this.outputDir)) {
        console.log("📁 Products directory doesn't exist yet");
        return existingIds;
      }
      
      const productDirs = fs.readdirSync(this.outputDir);
      
      for (const dir of productDirs) {
        const fullPath = path.join(this.outputDir, dir);
        
        if (fs.statSync(fullPath).isDirectory()) {
          const indexPath = path.join(fullPath, 'index.md');
          
          if (fs.existsSync(indexPath)) {
            try {
              const content = fs.readFileSync(indexPath, 'utf8');
              
              // Extract Instagram ID from frontmatter
              const instagramIdMatch = content.match(/instagram_id:\s*"([^"]+)"/);
              if (instagramIdMatch) {
                existingIds.add(instagramIdMatch[1]);
              }
              
              // Also check for old-style post IDs in directory names
              if (dir.startsWith('instagram-post-')) {
                const oldStyleId = dir.replace('instagram-post-', '');
                existingIds.add(oldStyleId);
              }
            } catch (error) {
              console.log(`⚠️ Could not read ${indexPath}:`, error.message);
            }
          }
        }
      }
      
      console.log(`📊 Found ${existingIds.size} existing Instagram products`);
      return existingIds;
      
    } catch (error) {
      console.error("❌ Error checking existing products:", error.message);
      return new Set();
    }
  }

  async syncPostsWithProducts(posts, profileUsername) {
    console.log(`🔄 Syncing ${posts.length} posts with existing products...`);
    
    // Get existing product IDs
    const existingIds = await this.getExistingProductIds();
    
    // Filter out posts that already have products
    const newPosts = posts.filter(post => !existingIds.has(post.id));
    const skippedPosts = posts.filter(post => existingIds.has(post.id));
    
    console.log(`📊 Sync Analysis:`);
    console.log(`   Total posts found: ${posts.length}`);
    console.log(`   Already have products: ${skippedPosts.length}`);
    console.log(`   New posts to process: ${newPosts.length}`);
    
    if (skippedPosts.length > 0) {
      console.log(`⏭️ Skipping existing products for posts: ${skippedPosts.map(p => p.id).join(', ')}`);
    }
    
    if (newPosts.length === 0) {
      console.log(`✅ All posts are already synced as products! No new work needed.`);
      return {
        total: posts.length,
        existing: skippedPosts.length,
        processed: 0,
        results: []
      };
    }
    
    console.log(`🚀 Processing ${newPosts.length} new posts...`);
    
    // Process only the new posts
    const results = [];
    
    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i];
      console.log(`Processing new post ${i + 1}/${newPosts.length}: ${post.id} (${post.type})`);
      
      try {
        // Download all media files for this post
        const mediaFiles = await this.downloadPostMedia(post);
        
        if (mediaFiles.primaryMedia) {
          // Create CMS-compatible product markdown with media support
          const productSlug = await this.createProductMarkdown(post, mediaFiles, profileUsername);
          
          results.push({
            success: true,
            postId: post.id,
            productSlug: productSlug,
            mediaFiles: mediaFiles,
            mediaCount: mediaFiles.images.length + mediaFiles.videos.length,
            primaryMediaType: mediaFiles.mediaType,
            isNew: true
          });
          
          console.log(`✅ Created product with ${mediaFiles.images.length} images and ${mediaFiles.videos.length} videos`);
        } else {
          results.push({
            success: false,
            postId: post.id,
            error: "No media files could be downloaded",
            isNew: true
          });
        }
        
        // Add delay between requests to be respectful
        await this.wait(2000); // Increased delay for media downloads
        
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error);
        results.push({
          success: false,
          postId: post.id,
          error: error.message,
          isNew: true
        });
      }
    }
    
    return {
      total: posts.length,
      existing: skippedPosts.length,
      processed: newPosts.length,
      results: results
    };
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

  // Main method to scrape and sync Instagram posts with CMS products
  async scrapeAndCreateProducts(instagramUrl, options = {}) {
    const {
      cleanExisting = false // Changed default to false since we're syncing now
    } = options;

    try {
      await this.init();
      
      // Only clean existing Instagram products if explicitly requested
      if (cleanExisting) {
        console.log("🧹 Cleaning existing products as requested...");
        await this.cleanExistingInstagramProducts();
      }
      
      // Scrape Instagram page to get all posts
      const scrapedData = await this.scrapeInstagramPage(instagramUrl);
      const posts = scrapedData.posts;
      const profile = scrapedData.profile;
      
      // Save profile information and handle logo replacement
      if (profile) {
        await this.saveProfileInfo(profile);
      }
      
      // Sync posts with existing products (only create new ones)
      const syncResults = await this.syncPostsWithProducts(posts, profile?.username);
      
      // Generate summary
      const successful = syncResults.results.filter(r => r.success);
      const failed = syncResults.results.filter(r => !r.success);
      
      console.log("\n📊 SYNC SUMMARY:");
      console.log(`📄 Total posts on page: ${syncResults.total}`);
      console.log(`✅ Already synced as products: ${syncResults.existing}`);
      console.log(`🆕 New products created: ${successful.length}`);
      console.log(`❌ Failed to create: ${failed.length}`);
      console.log(`📁 Images stored in: /img/ (visible in CMS media library)`);
      
      if (profile) {
        console.log(`👤 Profile: ${profile.username || "Unknown"}`);
        console.log(`🖼️ Profile image: ${profile.profileImageFile ? "Downloaded and set as logo" : "Not found"}`);
      }
      
      if (syncResults.existing > 0) {
        console.log(`\n⏭️ Skipped ${syncResults.existing} posts that already have products`);
      }
      
      if (failed.length > 0) {
        console.log("\n❌ Failed posts:");
        failed.forEach(f => {
          console.log(`- ${f.postId}: ${f.error}`);
        });
      }
      
      console.log("\n🎯 Next Steps:");
      console.log("1. All Instagram posts are now synced as CMS products");
      console.log("2. Only new posts were processed to avoid duplicates");
      console.log("3. Run this script again to sync any newly posted content");
      console.log("4. Edit product details through the CMS admin panel");
      console.log("5. Images are visible in CMS media library with 'instagram-' prefix");
      
      return {
        total: syncResults.total,
        existing: syncResults.existing,
        newProducts: successful.length,
        failed: failed.length,
        results: syncResults.results,
        profile: profile
      };
      
    } catch (error) {
      console.error("❌ Fatal error:", error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Export for use as module
module.exports = {InstagramScraper};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📱 Instagram to CMS Products Sync Tool with Smart Modal Handling

Usage: node instagram-scraper.js <instagram-url> [options]

Examples:
  node instagram-scraper.js "https://www.instagram.com/yourbrand/"
  node instagram-scraper.js "https://www.instagram.com/yourbrand/" --clean-existing
  node instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass

Options:
  --clean-existing     Remove all existing Instagram products before syncing
  --username=USER      Instagram username for private pages
  --password=PASS      Instagram password for private pages

🔄 SYNC BEHAVIOR:
  • Loads ALL posts from the Instagram page (scrolls to bottom)
  • Only creates products for NEW posts (avoids duplicates)
  • Skips posts that already have products
  • Perfect for keeping your CMS in sync with Instagram

Features:
  ✅ Downloads profile picture as site logo
  ✅ Creates CMS-compatible product entries for ALL page posts
  ✅ Smart sync - only processes new posts
  ✅ Organizes images in /img/ folder (CMS media library)
  ✅ Supports private Instagram accounts with login
  ✅ Compatible with Decap CMS admin interface
  ✅ 🆕 Automatic modal/captcha detection and pause
  ✅ 🆕 Handles verification codes and security challenges
  ✅ 🆕 Smart wait for manual intervention when needed
  ✅ 🆕 Complete page sync (all posts → all products)
    `);
    process.exit(1);
  }

  const instagramUrl = args[0];
  const options = {};
  const credentials = {};
  
  // Parse options
  args.slice(1).forEach((arg) => {
    if (arg === "--clean-existing") {
      options.cleanExisting = true;
    }
    if (arg.startsWith("--username=")) {
      credentials.username = arg.split("=")[1];
    }
    if (arg.startsWith("--password=")) {
      credentials.password = arg.split("=")[1];
    }
  });

  // Create scraper with credentials if provided
  const scraper = credentials.username && credentials.password 
    ? new InstagramScraper(credentials)
    : new InstagramScraper();
  
  scraper.scrapeAndCreateProducts(instagramUrl, options)
    .then(results => {
      console.log("\n🎉 Scraping completed successfully!");
      console.log(`📊 Total: ${results.total}, Success: ${results.successful}, Failed: ${results.failed}`);
      console.log("🔗 Access your CMS admin panel to manage the new products");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n💥 Scraping failed:", error);
      process.exit(1);
    });
}
