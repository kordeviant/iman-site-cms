/* eslint-env node, es2020 */
'use strict';

const fs = require('fs');
const path = require('path');

const MODAL_SELECTOR = 'div[role="dialog"]';
const NEXT_BUTTON_SELECTORS = [
  `${MODAL_SELECTOR} button[aria-label="Next"]`,
  `${MODAL_SELECTOR} div[role="button"][aria-label="Next"]`,
];
const CLOSE_BUTTON_SELECTORS = [
  `${MODAL_SELECTOR} button[aria-label="Close"]`,
  `${MODAL_SELECTOR} svg[aria-label="Close"]`,
  `${MODAL_SELECTOR} div[role="button"][aria-label="Close"]`,
];
const MODAL_TIMEOUT = 8000;
const MODAL_IDLE = 400;
const SLIDE_WAIT = 700;
const MAX_SLIDES_PER_POST = 20;

const MEDIA_ROOT = path.resolve(process.cwd(), 'media');

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function sanitizeSegment(seg) { return seg.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 150); }
function keyToFolderName({ type, code }) { return `${type}_${code}`; }

function guessExtFromUrl(u) {
  try {
    const { pathname } = new URL(u);
    const m = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (!m) return null;
    const ext = m[1].toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
  } catch {
    return null;
  }
}

function extFromContentType(ct) {
  if (!ct) return null;
  const t = ct.split(';')[0].trim().toLowerCase();
  if (t.includes('jpeg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('mp4')) return 'mp4';
  return null;
}

function parsePostUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const m = u.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const type = m[1], code = m[2];
    const key = `${type}/${code}`;
    const canonical = `${u.origin}/${type}/${code}/`;
    const selector = `a[href*='/${type}/${code}']`;
    return { key, canonical, selector, type, code };
  } catch {
    return null;
  }
}

/**
 * Small sleep helper to keep behavior consistent across modules.
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  // constants
  MODAL_SELECTOR,
  NEXT_BUTTON_SELECTORS,
  CLOSE_BUTTON_SELECTORS,
  MODAL_TIMEOUT,
  MODAL_IDLE,
  SLIDE_WAIT,
  MAX_SLIDES_PER_POST,
  MEDIA_ROOT,

  // helpers
  ensureDir,
  sanitizeSegment,
  keyToFolderName,
  guessExtFromUrl,
  extFromContentType,
  parsePostUrl,
  sleep,
};