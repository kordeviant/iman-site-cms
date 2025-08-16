/* eslint-env node, es2020 */

/**
 * Sleep utility
 */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle Instagram cookie modal
 */
async function handleCookieModal(page) {
  console.log("🍪 Checking for cookie modal...");

  try {
    const cookieHandled = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const cookieButton = buttons.find((btn) => {
        const text = btn.textContent.trim();
        return (
          text === "Allow all cookies" ||
          text === "Allow essential and optional cookies"
        );
      });

      if (cookieButton) {
        cookieButton.click();
        return true;
      }
      return false;
    });

    if (cookieHandled) {
      console.log("✅ Cookie modal handled");
      await sleep(1000);
    } else {
      console.log("⚠️ No cookie modal found");
    }
  } catch (error) {
    console.log("⚠️ Error handling cookie modal:", error.message);
  }
}

/**
 * Navigate to Instagram profile
 */
async function navigateToProfile(page, instagramUrl) {
  console.log(`🎯 Navigating to: ${instagramUrl}`);

  await page.goto(instagramUrl, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await handleCookieModal(page);
  await sleep(2000); // Wait for page to fully load
}

/**
 * Find profile picture URL on the page
 */
async function findProfilePictureUrl(page) {
  console.log("📸 Looking for profile picture...");

  const profilePicUrl = await page.evaluate(() => {
    const selectors = [
      'img[data-testid="user-avatar"]',
      'img[alt*="profile picture"]',
      "header img",
      "article img:first-of-type",
    ];

    for (const selector of selectors) {
      const img = document.querySelector(selector);
      if (img && img.src && img.src.includes("http")) {
        // Try to get higher quality version
        let src = img.src;
        if (src.includes("/s150x150/") || src.includes("/s320x320/")) {
          src = src.replace(/\/s\d+x\d+\//, "/s1080x1080/");
        }
        return src;
      }
    }
    return null;
  });

  if (!profilePicUrl) {
    throw new Error("Could not find profile picture URL");
  }

  console.log("✅ Found profile picture URL");
  return profilePicUrl;
}

module.exports = {
  sleep,
  handleCookieModal,
  navigateToProfile,
  findProfilePictureUrl,
};
