import fs from 'fs/promises';
import path from 'path';

const BASE_DIR = path.resolve('downloads');

export async function saveImageToFolder(page, slug, src, index) {
  const res = await page.evaluate(async (url) => {
    const r = await fetch(url);
    const b = await r.blob();
    const ab = await b.arrayBuffer();
    return {
      bytes: Array.from(new Uint8Array(ab)),
      mime: b.type || 'image/jpeg'
    };
  }, src);

  const buffer = Buffer.from(res.bytes);
  const ext = res.mime.includes('png') ? '.png' : '.jpg';
  const folder = path.join(BASE_DIR, slug);
  const filename = `media${index}${ext}`;
  const fullPath = path.join(folder, filename);

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(fullPath, buffer);
  console.log(`   ↳ saved ${slug}/${filename}`);
}