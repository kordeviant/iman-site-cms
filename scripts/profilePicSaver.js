/* eslint-env node, es2020 */

const path = require("path");
const { findProfilePictureUrl } = require("./instagram");
const { saveImageFromUrl } = require("./fileSaver");

/**
 * Save Instagram profile picture to site/static/img/logo.jpg
 */
async function saveProfilePicture(browser, page) {
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

module.exports = {
  saveProfilePicture,
};
