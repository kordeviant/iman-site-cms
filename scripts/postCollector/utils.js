// utils.js

export async function waitForMediaReadyInModal(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const scope = document.querySelector('div[role="dialog"] article');
    if (!scope) return false;
    const imgs = [...scope.querySelectorAll('img')];
    const vids = [...scope.querySelectorAll('video')];
    if (imgs.length + vids.length === 0) return false;
    return true;
  }, { timeout });

  // Ensure decode/ready
  await page.evaluate(async () => {
    const scope = document.querySelector('div[role="dialog"] article');
    const els = [...scope.querySelectorAll('img, video')];
    await Promise.all(els.map(el => {
      if (el.tagName === 'IMG') {
        if (el.complete) return;
        return new Promise(res => {
          el.addEventListener('load', res, { once: true });
          el.addEventListener('error', res, { once: true });
        });
      }
      if (el.tagName === 'VIDEO') {
        if (el.readyState >= 2) return;
        return new Promise(res => {
          const done = () => res();
          el.addEventListener('loadeddata', done, { once: true });
          el.addEventListener('error', done, { once: true });
        });
      }
    }));
  });
}

// Observe grid and wait for more items to render after scrolling
export async function waitForNewGridItems(page, gridAnchorSelector, prevCount, minDelta = 6, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const count = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, gridAnchorSelector);
    if (count >= prevCount + minDelta) return count;
    await sleep(150);
  }
  return prevCount; // no change detected within timeout
}

export async function scrollIntoViewIfNeeded(page, selector) {
  const handle = await page.$(selector);
  if (!handle) return;
  await handle.evaluate(el => el.scrollIntoView({ block: 'center' }));
}
export const sleep = ms => new Promise(res => setTimeout(res, ms));

export async function waitForModalOpen(page, timeout = 10000) {
  await page.waitForSelector('article[role="presentation"]', { timeout });
}

export async function waitForModalClose(page, timeout = 10000) {
  await page.waitForSelector('div[role="dialog"]', { hidden: true, timeout });
}