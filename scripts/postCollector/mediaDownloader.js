import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import fetch from "node-fetch";

const BASE_DIR = path.resolve("downloads");

// --- UTILITIES ---
export function stripByteRangeParams(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete("bytestart");
    u.searchParams.delete("byteend");
    return u.toString();
  } catch {
    return url;
  }
}

export function makeVideoSignature(url) {
  try {
    const u = new URL(url);
    // remove volatile params so all chunks map to one key
    ["bytestart", "byteend", "oh"].forEach(p => u.searchParams.delete(p));
    return `${u.origin}${u.pathname}?${u.searchParams.toString()}`;
  } catch {
    return url;
  }
}



// --- VIDEO DOWNLOADER ---
export async function saveVideoToFolder(page, slug, src, index) {
  try {
    const finalUrl = stripByteRangeParams(src);
    console.log(`⬇️ Downloading full video from: ${finalUrl}`);

    const resp = await fetch(finalUrl, {
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,fa;q=0.8",
        "cache-control": "no-cache",
        "origin": "https://www.instagram.com",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "referer": "https://www.instagram.com/",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36 Edg/139",
      },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = await resp.buffer();

  const folder = path.join(BASE_DIR, slug);
  await fsPromises.mkdir(folder, { recursive: true });
  const filename = `video_${String(index).padStart(2, "0")}.mp4`;
  await fsPromises.writeFile(path.join(folder, filename), buffer);
  console.log(`✅ Saved ${slug}/${filename}`);
  return filename;
  } catch (err) {
    console.warn(`⚠️ Video save failed for ${slug} [${src}]: ${err.message}`);
  return null;
  }
}


export async function saveImageToFolder(page, slug, src, index) {
  const res = await page.evaluate(async (url) => {
    const r = await fetch(url);
    const b = await r.blob();
    const ab = await b.arrayBuffer();
    return {
      bytes: Array.from(new Uint8Array(ab)),
      mime: b.type || "image/jpeg",
    };
  }, src);

  const buffer = Buffer.from(res.bytes);
  const ext = res.mime.includes("png") ? ".png" : ".jpg";
  const folder = path.join(BASE_DIR, slug);
  const filename = `media${String(index).padStart(2, "0")}${ext}`;
  const fullPath = path.join(folder, filename);

  await fsPromises.mkdir(folder, { recursive: true });
  await fsPromises.writeFile(fullPath, buffer);
  console.log(`   ↳ saved ${slug}/${filename}`);
  return filename;
}
