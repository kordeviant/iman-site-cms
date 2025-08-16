/* eslint-env node, es2020 */

/**
 * Validate Instagram URL format
 */
function validateUrl(url) {
  if (!url) {
    throw new Error("Please provide an Instagram profile URL");
  }

  if (!url.includes("instagram.com") || !url.startsWith("http")) {
    throw new Error(
      "Please provide a valid Instagram URL (e.g., https://www.instagram.com/username)"
    );
  }

  return true;
}

module.exports = {
  validateUrl,
};
