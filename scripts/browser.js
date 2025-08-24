import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

/**
 * Create and setup browser instance
 */
export async function createBrowser() {
  console.log("🚀 Starting browser...");

  const launchOptions = {
    headless: false,
    userDataDir: "d:\\puppeteer-data",
    args: (() => {
      const proxy = process.env.PUPPETEER_PROXY || process.env.PROXY || process.env.HTTP_PROXY || "http://localhost:10808";
      const base = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ];
      if (proxy) {
        base.unshift(`--proxy-server=${proxy}`);
      }
      return base;
    })(),
  };

  // Try default launch first. If Puppeteer can't find Chrome, try common Windows paths
  try {
    return await puppeteer.launch(launchOptions);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // Detect common error message when Chrome/Chromium isn't found
    if (!/Could not find Chrome|No usable chromium|Chromium revision|Failed to launch the browser/.test(msg)) {
      throw err;
    }

    console.log("⚠️ Puppeteer failed to find a browser. Trying common executable paths...");

    // Candidate paths to check (env vars first)
    const candidates = [];
    const env = process.env;
    if (env.CHROME_PATH) candidates.push(env.CHROME_PATH);
    if (env.CHROMIUM_PATH) candidates.push(env.CHROMIUM_PATH);
    if (env.PUPPETEER_EXECUTABLE_PATH) candidates.push(env.PUPPETEER_EXECUTABLE_PATH);

    // Common Windows install locations
    const programFiles = env["PROGRAMFILES"] || "C:\\Program Files";
    const programFilesx86 = env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const localAppData = path.join(env.USERPROFILE || "C:\\Users\\Default", "AppData", "Local");

    candidates.push(path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"));
    candidates.push(path.join(programFilesx86, "Google", "Chrome", "Application", "chrome.exe"));
    candidates.push(path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"));

    // Also try Edge (Chromium) as a fallback
    candidates.push(path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"));
    candidates.push(path.join(programFilesx86, "Microsoft", "Edge", "Application", "msedge.exe"));

    // Filter and dedupe
    const tried = new Set();
    const available = candidates.filter((p) => {
      if (!p || tried.has(p)) return false;
      tried.add(p);
      return fs.existsSync(p);
    });

    for (const exe of available) {
      try {
        console.log(`🔎 Trying executable: ${exe}`);
        const opts = { ...launchOptions, executablePath: exe };
        const browser = await puppeteer.launch(opts);
        console.log(`✅ Launched browser using: ${exe}`);
        return browser;
      } catch (innerErr) {
        console.log(`❌ Launch with ${exe} failed: ${innerErr.message || innerErr}`);
        // continue to next candidate
      }
    }

    // If we get here, rethrow original error for visibility
    throw err;
  }
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
