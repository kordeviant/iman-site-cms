/* eslint-env node, es2020 */
/* eslint-disable no-console */

/**
 * Product Creator - Hugo CMS Product File Generator
 *
 * Handles creation of Hugo-compatible markdown files for Instagram posts
 */

const fs = require("fs").promises;
const path = require("path");

class ProductCreator {
  constructor() {
    this.productsDir = path.join(
      __dirname,
      "..",
      "site",
      "content",
      "products"
    );
  }

  /**
   * Ensure the products directory exists
   */
  async ensureProductsDirectory() {
    await fs.mkdir(this.productsDir, {recursive: true});
  }

  /**
   * Sanitize text for safe YAML frontmatter
   * @param {string} text - Text to sanitize
   * @returns {string} - Sanitized text
   */
  sanitizeYamlText(text) {
    if (!text) return "";

    return text
      .replace(/"/g, "'") // Replace double quotes with single quotes
      .replace(/\n/g, " ") // Replace newlines with spaces
      .replace(/\r/g, "") // Remove carriage returns
      .replace(/\t/g, " ") // Replace tabs with spaces
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Generate Hugo frontmatter for a product
   * @param {Object} productData - Product data object
   * @returns {string} - Complete frontmatter string
   */
  generateFrontMatter(productData) {
    const sanitizedTitle = this.sanitizeYamlText(productData.title);
    const sanitizedDescription = this.sanitizeYamlText(productData.description);

    return `---
title: "${sanitizedTitle}"
description: "${sanitizedDescription}"
date: "${productData.date}"
postId: "${productData.postId}"
mediaFiles: []
price: 0
category: "Instagram Collection"
in_stock: true
featured: false
---

${sanitizedDescription}
`;
  }

  /**
   * Create a Hugo CMS product file from Instagram post data
   * @param {string} postId - Instagram post ID
   * @param {Object} productData - Product data object
   * @returns {Promise<void>}
   */
  async createProduct(postId, productData) {
    try {
      // Ensure directory exists
      await this.ensureProductsDirectory();

      // Generate frontmatter
      const frontMatter = this.generateFrontMatter(productData);

      // Create filename and path
      const filename = `${postId}.md`;
      const filePath = path.join(this.productsDir, filename);

      // Write the file
      await fs.writeFile(filePath, frontMatter);

      console.log(`✅ Created product file: ${filename}`);

    } catch (error) {
      console.error(`❌ Error creating product for post ${postId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a product already exists
   * @param {string} postId - Instagram post ID
   * @returns {Promise<boolean>} - True if product exists
   */
  async productExists(postId) {
    try {
      const filename = `${postId}.md`;
      const filePath = path.join(this.productsDir, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all existing product post IDs
   * @returns {Promise<string[]>} - Array of existing post IDs
   */
  async getExistingProductIds() {
    try {
      await this.ensureProductsDirectory();
      const files = await fs.readdir(this.productsDir);

      return files
        .filter((file) => file.endsWith(".md"))
        .map((file) => file.replace(".md", ""));

    } catch (error) {
      console.error("Error reading existing products:", error.message);
      return [];
    }
  }

  /**
   * Clean up invalid product files (optional utility)
   * @param {string[]} validPostIds - Array of valid post IDs to keep
   * @returns {Promise<number>} - Number of files cleaned up
   */
  async cleanupInvalidProducts(validPostIds) {
    try {
      const existingIds = await this.getExistingProductIds();
      const validSet = new Set(validPostIds);
      let cleanedCount = 0;

      for (const existingId of existingIds) {
        if (!validSet.has(existingId)) {
          const filename = `${existingId}.md`;
          const filePath = path.join(this.productsDir, filename);
          await fs.unlink(filePath);
          console.log(`🗑️ Removed invalid product: ${filename}`);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error("Error during cleanup:", error.message);
      return 0;
    }
  }
}

module.exports = ProductCreator;
