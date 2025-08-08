# Instagram CMS Integration Scripts

This folder contains scripts for integrating Instagram content with your Decap CMS.

## Quick Start

### 1. Interactive Mode (asks for URL)
```bash
npm run scrape:interactive
```

### 2. Direct URL Mode (no prompts) ✨ NEW
```bash
npm run scrape:url https://www.instagram.com/yourbrand/
```

### 3. Clear Saved Session
```bash
npm run scrape:clear-session
```

## What's Fixed ✨

### ✅ Direct Navigation
- No longer goes to instagram.com first
- Goes directly to your target page 
- Faster and more efficient

### ✅ Command Line URL Support
- Can pass URL as argument to skip prompts
- Perfect for automation and scripts

### ✅ Enhanced Media Download
- Multiple fallback methods for 403 errors
- Proper browser headers and referrer
- Screenshot method for protected images
- Better handling of Instagram's protection

### ✅ Persistent Browser Data
- Uses `d:\puppeteer-data` for session storage
- Login once, stay logged in
- Works like a normal browser

## Main Scripts

### 🎯 Interactive Instagram Sync
```bash
yarn scrape:interactive
```
**The main script you need!** This comprehensive tool:
- Syncs ALL posts from an Instagram page to your CMS
- Only creates products for NEW posts (prevents duplicates)
- Handles both public and private accounts (with manual login)
- Downloads profile image and sets as site logo
- Saves all images to CMS media library (`/img/` folder)
- Creates CMS-compatible markdown files for each post
- Handles captchas, modals, and login challenges
- Persistent login sessions (login once, stay logged in for 48 hours)
- Complete modal/captcha detection and handling

### 🗑️ Clear Login Session
```bash
yarn scrape:clear-session
```
Clears saved Instagram login session. Use this if:
- You want to login with a different account
- Session seems corrupted
- You're switching between accounts

### 🖼️ Replace Site Images
```bash
yarn replace:jewelry-images
```
Replaces default coffee-themed images with jewelry-themed ones and updates the site logo.

## Features

### 🔄 Complete Page Sync
- Loads ALL posts from Instagram page (scrolls to bottom)
- Smart duplicate detection (won't recreate existing products)
- Works with both public and private accounts
- Handles infinite scroll and loading indicators

### 🤖 Anti-Detection
- Stealth browser configuration
- Human-like mouse movements and scrolling
- Realistic headers and user agent
- Manual login (most human-like approach)
- Random delays and behaviors

### 🛡️ Modal/Captcha Handling
- Automatic detection of security challenges
- Pauses script for manual intervention
- Supports captcha, 2FA, and verification codes
- Context-aware modal checking (avoids false positives)

### 📁 CMS Integration
- Images saved to `/img/` folder (visible in CMS media library)
- Hugo-compatible markdown files
- Proper frontmatter with metadata
- SEO-friendly slugs and descriptions

### 🔐 Session Management
- Persistent login sessions (48-hour validity)
- Automatic session restoration
- Secure cookie and session storage
- Session validation and cleanup

## File Structure

```
scripts/
├── interactive.js           # Main interactive sync script
├── instagram-scraper.js     # Core Instagram scraper class
├── replace-jewelry-images.js # Site theme replacement
└── README.md               # This documentation
```

## Usage Examples

### Sync a Public Instagram Account
```bash
yarn scrape:interactive
# Enter: https://www.instagram.com/publicjewelrypage/
# Choose: N (not private)
# Script will sync all posts automatically
```

### Sync a Private Instagram Account
```bash
yarn scrape:interactive
# Enter: https://www.instagram.com/privatejewelrypage/
# Choose: y (is private)
# Browser opens for manual login
# Complete login manually, script continues automatically
```

### Clear Session and Start Fresh
```bash
yarn scrape:clear-session
yarn scrape:interactive
# Fresh session, will require login again
```

## Requirements

- Node.js and Yarn/NPM
- Chrome browser (installed automatically by Puppeteer)
- Internet connection
- For private accounts: Valid Instagram credentials

## Troubleshooting

### "Chrome not found" Error
```bash
npx puppeteer browsers install chrome
```

### Session Issues
```bash
yarn scrape:clear-session
```

### Network/Proxy Issues
- Check your internet connection
- The script uses `localhost:10808` proxy by default
- Modify proxy settings in `instagram-scraper.js` if needed

## Output

The script creates:
- **Products**: `site/content/products/instagram-post-[ID]/index.md`
- **Images**: `site/static/img/instagram-[ID].[ext]`
- **Profile Data**: `site/data/instagram-profile.json`
- **Logo**: Profile image copied as site logo

All content is immediately available in your Decap CMS for editing and management.
