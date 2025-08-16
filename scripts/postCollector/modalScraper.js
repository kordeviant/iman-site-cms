import { sleep, waitForModalOpen, waitForModalClose } from './utils.js';
import { saveImageToFolder } from './mediaDownloader.js';

export async function openClickAndScrapeModal(page, { cellSelector, slug }) {
  await page.click(cellSelector, { delay: 10 });
  await waitForModalOpen(page);

  let index = 1;
  const downloaded = new Set();

  while (true) {
    // ✅ Get current slide images
    const srcList = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll(
        'article[role="presentation"] div[role="presentation"]>div>ul li img'
      ));
      return imgs.map(img => img.currentSrc || img.src).filter(Boolean);
    });

    for (const src of srcList) {
      if (!downloaded.has(src)) {
        await saveImageToFolder(page, slug, src, index);
        downloaded.add(src);
        index++;
      }
    }

    // ⏭ Try to click "Next"
    const nextBtn = await page.$('article[role="presentation"] button[aria-label="Next"]');
    if (!nextBtn) break;

    await nextBtn.click();
    await sleep(300); // buffer for DOM update
  }

  // ❌ Close modal (robust)
  try {
    const closeBtn = await page.$('div[role="dialog"] [aria-label="Close"]');
    if (closeBtn) {
      await closeBtn.click();
      await waitForModalClose(page);
    } else {
      // Fallback: press Escape
      await page.keyboard.press('Escape');
      await sleep(500);
    }
  } catch (err) {
    console.warn('⚠️ Modal close failed, trying fallback...');
    await page.keyboard.press('Escape');
    await sleep(500);
  }
}