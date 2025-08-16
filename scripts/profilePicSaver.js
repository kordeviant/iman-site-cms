/* eslint-env node, es2020 */

import path from "path";
import {findProfilePictureUrl} from "./instagram.js";
import {saveImageFromUrl} from "./fileSaver.js";

/**
 * Save Instagram profile picture to site/static/img/logo.jpg
 */
export async function saveProfilePicture(browser, page) {
  const profilePicUrl = await findProfilePictureUrl(page);
  const savePath = path.join(
    process.cwd(),
    "site",
    "static",
    "img",
    "logo.jpg"
  );

  await saveImageFromUrl(browser, profilePicUrl, savePath);
  console.log("✅ Profile picture saved");

  return savePath;
}
