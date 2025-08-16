import puppeteer from "puppeteer";

/**
 * Create and setup browser instance
 */
export async function createBrowser() {
  console.log("🚀 Starting browser...");

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "d:\\puppeteer-data",
    args: [
      "--proxy-server=localhost:10808",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  return browser;
}

/**
 * Create and setup page with user agent
 */
export async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  return page;
}

/**
 * Close browser safely
 */
export async function closeBrowser(browser) {
  if (browser) {
    console.log("⏳ Closing browser...");
    await browser.close();
  }
}
