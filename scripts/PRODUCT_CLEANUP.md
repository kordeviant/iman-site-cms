# Product Cleanup Script

This script helps clean up all product-related content from the CMS while preserving important site assets like profile images.

## Features

- ✅ Removes all product content files (.md files in `site/content/products/`)
- ✅ Removes product images (except profile images used for logos)
- ✅ Cleans up product references in other content files
- ✅ Preserves profile images that are used for site branding
- ✅ Safe preview mode to see what would be deleted
- ✅ Removes empty directories after cleanup

## Usage

### Preview Mode (Recommended first)
```bash
node clean-products.js --preview
```
or
```bash
node clean-products.js -p
```

This will show you exactly what files would be deleted without actually deleting them.

### Execute Cleanup
```bash
node clean-products.js --execute
```
or
```bash
node clean-products.js -e
```

This will actually perform the cleanup operation.

### Help
```bash
node clean-products.js
```

Shows usage information and available options.

## What Gets Deleted

1. **Product Content Files**: All `.md` files in `site/content/products/` directory
2. **Product Images**: All image files in `site/static/img/products/` except profile images
3. **Product References**: Cleans up product gallery references and image links in content files
4. **Empty Directories**: Removes empty directories after cleanup

## What Gets Preserved

- **Profile Images**: Any image file containing `-profile.` in the filename
- **Site Logo**: The Instagram profile image used as the site logo
- **Directory Structure**: Main directories are preserved
- **Other Content**: Blog posts, pages, and other non-product content

## Safety Features

- **Preview Mode**: Always run preview first to see what will be affected
- **Profile Image Protection**: Automatically skips profile images
- **Error Handling**: Continues operation even if individual files fail
- **Detailed Logging**: Shows exactly what files are being processed

## Example Output

```
🧹 Starting product cleanup...
📁 Removing product content files...
🗑️  Deleted: content/products/ring-collection.md
🗑️  Deleted: content/products/necklace-series.md
🖼️  Removing product images...
⏭️  Skipping profile image: 6_side_jewelry-profile.jpg
🗑️  Deleted: static/img/products/ring-photo.jpg
🔗 Cleaning product references...
🔄 Updated: content/_index.md
✅ Product cleanup completed! Removed 4 items.
```

## Integration

This script is designed to work with:
- Hugo static site generator
- 6side jewelry CMS structure
- Instagram profile integration
- Existing site branding

The script preserves the profile image that's used by the Instagram scraper and site navigation, ensuring your site branding remains intact after product cleanup.
