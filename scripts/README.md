# Instagram Scraper for Products

This script scrapes Instagram posts and converts them into Hugo products for your CMS.

## Installation

The required dependencies should already be installed, but you need to install Chrome for Puppeteer:

```bash
# Install dependencies (if not already done)
yarn add puppeteer puppeteer-extra puppeteer-extra-plugin-stealth

# Install Chrome for Puppeteer (REQUIRED)
npx puppeteer browsers install chrome

# Test the installation
yarn scrape:test
```

**Note**: The Chrome installation is required and will download ~170MB.

## Usage

### Command Line Usage

```bash
# Basic usage - scrape up to 20 posts from public page
node scripts/instagram-scraper.js "https://www.instagram.com/yourbrand/"

# Limit number of posts
node scripts/instagram-scraper.js "https://www.instagram.com/yourbrand/" --max-posts=10

# Scrape private page with login credentials
node scripts/instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass

# Private page with limited posts
node scripts/instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass --max-posts=5

# Don't skip existing products
node scripts/instagram-scraper.js "https://www.instagram.com/yourbrand/" --no-skip-existing
```

### Programmatic Usage

```javascript
const InstagramScraper = require('./scripts/instagram-scraper');

// For public pages
const scraper = new InstagramScraper();

// For private pages with credentials
const scraper = new InstagramScraper({
  username: 'your_username',
  password: 'your_password'
});

scraper.scrapeAndCreateProducts('https://www.instagram.com/yourbrand/', {
  maxPosts: 15,
  skipExisting: true
}).then(results => {
  console.log('Results:', results);
}).catch(error => {
  console.error('Error:', error);
});
```

## Features

- **Stealth Mode**: Uses puppeteer-extra-plugin-stealth to avoid detection
- **Private Page Support**: Can login and scrape private Instagram accounts
- **Auto-scroll**: Automatically scrolls to load more posts
- **Image Download**: Downloads images to `site/static/img/products/`
- **Hugo Integration**: Creates Hugo-compatible markdown files in `site/content/products/`
- **Error Handling**: Robust error handling with detailed logging
- **Login Management**: Handles Instagram login dialogs and 2FA prompts
- **Customizable**: Configurable options for max posts, credentials, etc.

## Output Structure

For each Instagram post, the script creates:

1. **Product Directory**: `site/content/products/instagram-post-{id}/`
2. **Markdown File**: `index.md` with Hugo front matter
3. **Image File**: Downloaded to `site/static/img/products/{id}.jpg`

## Generated Hugo Front Matter

```yaml
---
title: "Instagram Post ABC123"
date: 2025-08-05
description: "Beautiful jewelry piece from our Instagram collection"
image: "/img/products/ABC123.jpg"
pricing:
  - text: "Contact for pricing"
    price: ""
weight: 100
draft: false
instagram_post: "https://www.instagram.com/p/ABC123/"
instagram_id: "ABC123"
---
```

## Security & Credentials

### For Private Pages

When scraping private Instagram pages, you'll need to provide your login credentials. The script supports several ways to do this:

#### Method 1: Command Line Arguments
```bash
node scripts/instagram-scraper.js "https://www.instagram.com/privatepage/" --username=myuser --password=mypass
```

#### Method 2: Interactive Mode (Recommended)
```bash
yarn scrape:interactive
# You'll be prompted for credentials only if needed
```

#### Method 3: Programmatic
```javascript
const scraper = new InstagramScraper({
  username: 'your_username',
  password: 'your_password'
});
```

### Security Considerations

⚠️ **Important Security Notes:**

1. **Never commit credentials to your repository**
2. **Use environment variables for automation:**
   ```bash
   export INSTAGRAM_USERNAME="your_username"
   export INSTAGRAM_PASSWORD="your_password"
   ```
3. **Consider using Instagram Basic Display API for production use**
4. **Be aware of Instagram's rate limits and terms of service**
5. **The script runs in non-headless mode by default so you can monitor the login process**

### Two-Factor Authentication

If your account has 2FA enabled:
1. The script will pause at the 2FA screen
2. You can manually enter the code in the browser
3. The script will continue once you're logged in

## Troubleshooting

### Common Issues

1. **"Could not find Chrome" Error**
   ```bash
   # Install Chrome for Puppeteer
   npx puppeteer browsers install chrome
   
   # Test the installation
   yarn scrape:test
   ```

2. **Instagram blocks the scraper**
   - Try running with `headless: false` to see what's happening
   - Add more delays between requests
   - Use different User-Agent strings

3. **No posts found**
   - Instagram might have changed their HTML structure
   - Check the selectors in the `extractPosts()` method
   - Try accessing the page manually first

4. **Images not downloading**
   - Check if the image URLs are valid
   - Ensure the `site/static/img/products/` directory exists
   - Check file permissions

### Debug Mode

Set `headless: false` in the script to see the browser in action:

```javascript
this.browser = await puppeteer.launch({
  headless: false, // This will show the browser
  // ... other options
});
```

## Notes

- The script respects Instagram's rate limits with built-in delays
- Images are downloaded directly from Instagram's CDN
- Products are created with basic Hugo front matter - customize as needed
- The script can handle various Instagram post layouts
- All posts are marked as draft initially - review before publishing
