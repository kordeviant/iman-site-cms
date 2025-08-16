/* eslint-env node, es2020 */
"use strict";

const { parsePostUrl } = require("./utils");

async function discoverLinks(
  page,
  store,
  queue,
  { includeReels } = { includeReels: true }
) {
  const selectorParts = ["a[href*='/p/']"];
  if (includeReels) selectorParts.push("a[href*='/reel/']");
  const selector = selectorParts.join(",");

  const hrefs = await page.$$eval(selector, (els) =>
    Array.from(new Set(els.map((el) => el.href)))
  );

  let added = 0;
  for (const href of hrefs) {
    const parsed = parsePostUrl(href);
    if (!parsed) continue;
    if (!store.has(parsed.key)) {
      store.set(parsed.key, parsed);
      queue.push(parsed.key);
      added++;
    }
  }
  return added;
}

module.exports = { discoverLinks };
