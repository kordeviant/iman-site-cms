/* eslint-env node, es2020 */

const fs = require("fs").promises;
const path = require("path");

/**
 * Save image from URL to specified path
 */
async function saveImageFromUrl(browser, imageUrl, savePath) {
  console.log("📥 Fetching image...");

  try {
    // Create a new page to fetch the image
    const imagePage = await browser.newPage();

    // Navigate to the image URL
    const response = await imagePage.goto(imageUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    if (!response.ok()) {
      throw new Error(`Failed to fetch image: ${response.status()}`);
    }

    // Get the image buffer
    const imageBuffer = await response.buffer();
    console.log(`📊 Image size: ${Math.round(imageBuffer.length / 1024)}KB`);

    // Close the image page
    await imagePage.close();

    // Save the image
    await saveBufferToFile(imageBuffer, savePath);

    return savePath;
  } catch (error) {
    console.error("❌ Error saving image:", error.message);
    throw error;
  }
}

/**
 * Save buffer to file with directory creation
 */
async function saveBufferToFile(buffer, filePath) {
  const saveDir = path.dirname(filePath);

  console.log("📁 Creating directory:", saveDir);
  await fs.mkdir(saveDir, { recursive: true });

  console.log("💾 Saving image to:", filePath);
  await fs.writeFile(filePath, buffer);

  // Verify the file was saved
  const stats = await fs.stat(filePath);
  console.log(
    `✅ File saved successfully! Size: ${Math.round(stats.size / 1024)}KB`
  );
}

/**
 * Take screenshot of element as fallback
 */
async function screenshotElement(page, selector, savePath) {
  console.log("📸 Taking screenshot as fallback...");

  const element = await page.$(selector);

  if (!element) {
    throw new Error("Could not find element for screenshot");
  }

  // Scroll element into view
  await element.scrollIntoView();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Create directory
  const saveDir = path.dirname(savePath);
  await fs.mkdir(saveDir, { recursive: true });

  // Take screenshot
  await element.screenshot({
    path: savePath,
    type: "jpeg",
    quality: 90,
  });

  console.log(`✅ Screenshot saved to: ${savePath}`);
}

module.exports = {
  saveImageFromUrl,
  saveBufferToFile,
  screenshotElement,
};
