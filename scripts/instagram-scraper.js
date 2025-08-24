/* eslint-env node, es2020 */
/* eslint-disable no-console */

/**
 * Instagram Profile Picture Scraper - Main Script
 */

import { createBrowser, createPage, closeBrowser } from "./browser.js";
import { navigateToProfile } from "./instagram.js";
import { saveProfilePicture } from "./profilePicSaver.js";
import { processPosts } from "./postCollector/index.js";
import { validateUrl } from "./utils.js";

/**
 * Main execution
 */
async function main() {
  const argv = process.argv.slice(2);
  const instagramUrl = argv[0];
  const flags = argv.slice(1);

  // Flags: --media, --metadata, --both
  // Default: media enabled, metadata disabled
  const options = {
    media:
      flags.includes("--media") ||
      flags.includes("--both") ||
      flags.length === 0,
    metadata: flags.includes("--metadata") || flags.includes("--both"),
  };
  let browser;

  try {
    validateUrl(instagramUrl);

    console.log("🔧 Starting Instagram scraper...");
    console.log(`🎯 Target: ${instagramUrl}`);

    // Setup browser and page
    browser = await createBrowser();
    const page = await createPage(browser);

    // Navigate to Instagram profile
    await navigateToProfile(page, instagramUrl);

    // Save profile picture
    console.log("💾 Saving profile picture...");
    await saveProfilePicture(browser, page);

    // Process all posts (pass options to enable media and/or metadata)
    console.log(
      `⚙️ Options: media=${options.media}, metadata=${options.metadata}`
    );
    await processPosts(page, options);

    console.log("🎉 Scraping completed successfully!");
  } catch (error) {
    console.error("❌ Failed:", error.message);
    console.log("\nUsage: node index.js <instagram_url>");
    console.log(
      "Example: node index.js https://www.instagram.com/6_side_jewelry"
    );
    process.exit(1);
  } finally {
    await closeBrowser(browser);
  }
}

// Run if called directly
main();
