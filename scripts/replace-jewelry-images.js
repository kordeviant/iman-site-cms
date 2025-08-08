const fs = require("fs");
const path = require("path");

// Jewelry-themed SVG generator
class JewelryImageGenerator {
  constructor() {
    this.goldGradient = `
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#FFA500;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FF8C00;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#E5E5E5;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#C0C0C0;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#A0A0A0;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="gemGradient" cx="50%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:0.9" />
          <stop offset="50%" style="stop-color:#4169E1;stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:#191970;stop-opacity:0.8" />
        </radialGradient>
      </defs>
    `;
  }

  generateRing(width = 400, height = 300) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${this.goldGradient}
        <rect width="100%" height="100%" fill="#f8f8f8"/>
        
        <!-- Ring band -->
        <ellipse cx="${width/2}" cy="${height/2}" rx="80" ry="60" 
                 fill="none" stroke="url(#goldGradient)" stroke-width="20"/>
        
        <!-- Center gem -->
        <polygon points="${width/2},${height/2-30} ${width/2+15},${height/2-10} ${width/2+10},${height/2+10} ${width/2-10},${height/2+10} ${width/2-15},${height/2-10}"
                 fill="url(#gemGradient)" stroke="#000080" stroke-width="1"/>
        
        <!-- Small accent gems -->
        <circle cx="${width/2-25}" cy="${height/2-15}" r="4" fill="url(#gemGradient)"/>
        <circle cx="${width/2+25}" cy="${height/2-15}" r="4" fill="url(#gemGradient)"/>
        
        <text x="${width/2}" y="${height-20}" text-anchor="middle" 
              font-family="serif" font-size="16" fill="#B8860B">
          Beautiful Gold Ring
        </text>
      </svg>
    `;
  }

  generateNecklace(width = 400, height = 300) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${this.goldGradient}
        <rect width="100%" height="100%" fill="#f8f8f8"/>
        
        <!-- Chain -->
        <path d="M 50 80 Q ${width/2} 180 ${width-50} 80" 
              fill="none" stroke="url(#goldGradient)" stroke-width="8"/>
        
        <!-- Chain links -->
        ${Array.from({length: 12}, (_, i) => {
          const x = 50 + (i * (width-100) / 11);
          const y = 80 + Math.sin(i * 0.5) * 20;
          return `<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="url(#silverGradient)" stroke="#B8860B"/>`;
        }).join("")}
        
        <!-- Pendant -->
        <polygon points="${width/2},140 ${width/2+20},160 ${width/2},200 ${width/2-20},160"
                 fill="url(#gemGradient)" stroke="#000080" stroke-width="2"/>
        
        <text x="${width/2}" y="${height-20}" text-anchor="middle" 
              font-family="serif" font-size="16" fill="#B8860B">
          Elegant Necklace
        </text>
      </svg>
    `;
  }

  generateEarrings(width = 400, height = 300) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${this.goldGradient}
        <rect width="100%" height="100%" fill="#f8f8f8"/>
        
        <!-- Left earring -->
        <g transform="translate(120,80)">
          <circle cx="0" cy="0" r="8" fill="url(#goldGradient)" stroke="#B8860B"/>
          <polygon points="0,15 10,35 0,50 -10,35" fill="url(#gemGradient)" stroke="#000080"/>
        </g>
        
        <!-- Right earring -->
        <g transform="translate(280,80)">
          <circle cx="0" cy="0" r="8" fill="url(#goldGradient)" stroke="#B8860B"/>
          <polygon points="0,15 10,35 0,50 -10,35" fill="url(#gemGradient)" stroke="#000080"/>
        </g>
        
        <text x="${width/2}" y="${height-20}" text-anchor="middle" 
              font-family="serif" font-size="16" fill="#B8860B">
          Diamond Earrings
        </text>
      </svg>
    `;
  }

  generateBracelet(width = 400, height = 300) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${this.goldGradient}
        <rect width="100%" height="100%" fill="#f8f8f8"/>
        
        <!-- Bracelet band -->
        <ellipse cx="${width/2}" cy="${height/2}" rx="120" ry="40" 
                 fill="none" stroke="url(#goldGradient)" stroke-width="12"/>
        
        <!-- Gems along the bracelet -->
        ${Array.from({length: 8}, (_, i) => {
          const angle = (i * Math.PI * 2) / 8;
          const x = width/2 + Math.cos(angle) * 100;
          const y = height/2 + Math.sin(angle) * 30;
          return `<circle cx="${x}" cy="${y}" r="6" fill="url(#gemGradient)" stroke="#000080"/>`;
        }).join("")}
        
        <text x="${width/2}" y="${height-20}" text-anchor="middle" 
              font-family="serif" font-size="16" fill="#B8860B">
          Gold Bracelet
        </text>
      </svg>
    `;
  }

  generateJewelryDisplay(width = 400, height = 300) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${this.goldGradient}
        <rect width="100%" height="100%" fill="#f8f8f8"/>
        
        <!-- Display case -->
        <rect x="50" y="80" width="300" height="150" 
              fill="none" stroke="#8B4513" stroke-width="3" rx="10"/>
        
        <!-- Jewelry pieces in display -->
        <circle cx="120" cy="140" r="20" fill="url(#goldGradient)" stroke="#B8860B" stroke-width="2"/>
        <polygon points="200,120 220,140 200,180 180,140" fill="url(#gemGradient)" stroke="#000080"/>
        <ellipse cx="280" cy="150" rx="25" ry="15" fill="url(#silverGradient)" stroke="#B8860B"/>
        
        <!-- Sparkle effects -->
        <g stroke="#FFD700" stroke-width="2" fill="none">
          <path d="M 100 100 L 110 100 M 105 95 L 105 105"/>
          <path d="M 300 110 L 310 110 M 305 105 L 305 115"/>
          <path d="M 150 200 L 160 200 M 155 195 L 155 205"/>
        </g>
        
        <text x="${width/2}" y="50" text-anchor="middle" 
              font-family="serif" font-size="18" font-weight="bold" fill="#B8860B">
          6side Jewelry Collection
        </text>
      </svg>
    `;
  }
}

// Mapping of old images to new jewelry themes
const imageReplacements = {
  "about-direct-sourcing.jpg": {
    generator: "generateJewelryDisplay",
    alt: "Direct sourcing of precious metals and gems"
  },
  "about-reinvest-profits.jpg": {
    generator: "generateRing", 
    alt: "Reinvesting in quality craftsmanship"
  },
  "about-shade-grown.jpg": {
    generator: "generateNecklace",
    alt: "Ethically sourced jewelry"
  },
  "about-single-origin.jpg": {
    generator: "generateEarrings",
    alt: "Single-origin precious stones"
  },
  "about-sustainable-farming.jpg": {
    generator: "generateBracelet",
    alt: "Sustainable jewelry practices"
  },
  "about-jumbotron.jpg": {
    generator: "generateJewelryDisplay",
    alt: "6side Jewelry - Exceptional Craftsmanship"
  },
  "blog-index.jpg": {
    generator: "generateRing",
    alt: "Latest jewelry trends and news"
  },
  "home-about-section.jpg": {
    generator: "generateNecklace",
    alt: "About our jewelry heritage"
  },
  "home-jumbotron.jpg": {
    generator: "generateJewelryDisplay",
    alt: "Welcome to 6side Jewelry"
  },
  "products-full-width.jpg": {
    generator: "generateJewelryDisplay",
    alt: "Our complete jewelry collection"
  },
  "products-grid1.jpg": {
    generator: "generateRing",
    alt: "Premium ring collection"
  },
  "products-grid2.jpg": {
    generator: "generateNecklace", 
    alt: "Elegant necklace designs"
  },
  "products-grid3.jpg": {
    generator: "generateEarrings",
    alt: "Beautiful earring styles"
  },
  "products-jumbotron.jpg": {
    generator: "generateBracelet",
    alt: "Discover our jewelry products"
  },
  "og-image.jpg": {
    generator: "generateJewelryDisplay",
    alt: "6side Jewelry - Handcrafted Excellence"
  }
};

// Replace coffee/food related illustrations with jewelry icons
const illustrationReplacements = {
  "illustrations-coffee.svg": `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700"/>
          <stop offset="100%" style="stop-color:#FFA500"/>
        </linearGradient>
      </defs>
      <polygon points="50,10 65,25 60,50 40,50 35,25" fill="url(#gold)" stroke="#B8860B" stroke-width="2"/>
      <circle cx="50" cy="30" r="6" fill="#4169E1" opacity="0.8"/>
      <text x="50" y="80" text-anchor="middle" font-size="12" fill="#B8860B">Diamond</text>
    </svg>
  `,
  
  "illustrations-coffee-gear.svg": `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="silver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#E5E5E5"/>
          <stop offset="100%" style="stop-color:#C0C0C0"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="40" r="25" fill="none" stroke="url(#silver)" stroke-width="4"/>
      <polygon points="50,20 55,30 50,50 45,30" fill="#4169E1"/>
      <text x="50" y="80" text-anchor="middle" font-size="12" fill="#B8860B">Ring</text>
    </svg>
  `,
  
  "illustrations-meeting-space.svg": `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700"/>
          <stop offset="100%" style="stop-color:#FFA500"/>
        </linearGradient>
      </defs>
      <path d="M 20 60 Q 50 40 80 60" fill="none" stroke="url(#gold)" stroke-width="6"/>
      <polygon points="50,35 60,45 50,65 40,45" fill="#4169E1"/>
      <text x="50" y="85" text-anchor="middle" font-size="12" fill="#B8860B">Necklace</text>
    </svg>
  `,
  
  "illustrations-tutorials.svg": `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700"/>
          <stop offset="100%" style="stop-color:#FFA500"/>
        </linearGradient>
      </defs>
      <circle cx="35" cy="40" r="6" fill="url(#gold)" stroke="#B8860B"/>
      <polygon points="35,50 40,60 35,70 30,60" fill="#4169E1"/>
      <circle cx="65" cy="40" r="6" fill="url(#gold)" stroke="#B8860B"/>
      <polygon points="65,50 70,60 65,70 60,60" fill="#4169E1"/>
      <text x="50" y="85" text-anchor="middle" font-size="12" fill="#B8860B">Earrings</text>
    </svg>
  `
};

async function replaceJewelryImages() {
  console.log("💎 Replacing coffee/kaldi images with jewelry-themed content...");
  
  const imgDir = path.join(__dirname, "../site/static/img");
  const generator = new JewelryImageGenerator();
  
  let replacedCount = 0;
  
  // Replace main images with jewelry SVGs
  for (const [filename, config] of Object.entries(imageReplacements)) {
    const filePath = path.join(imgDir, filename);
    
    if (fs.existsSync(filePath)) {
      console.log(`📷 Replacing ${filename} with jewelry theme...`);
      
      const svgContent = generator[config.generator](600, 400);
      
      // Create SVG version
      const svgPath = filePath.replace(/\.(jpg|png)$/, ".svg");
      fs.writeFileSync(svgPath, svgContent);
      
      // Remove old image
      fs.unlinkSync(filePath);
      
      replacedCount++;
      console.log(`✅ Created ${path.basename(svgPath)}`);
    }
  }
  
  // Replace illustrations
  for (const [filename, svgContent] of Object.entries(illustrationReplacements)) {
    const filePath = path.join(imgDir, filename);
    
    if (fs.existsSync(filePath)) {
      console.log(`🎨 Replacing ${filename} with jewelry icon...`);
      fs.writeFileSync(filePath, svgContent);
      replacedCount++;
    }
  }
  
  console.log(`✅ Replaced ${replacedCount} images with jewelry themes`);
  console.log("");
  console.log("🎯 NEXT STEPS:");
  console.log("1. All coffee/kaldi images replaced with jewelry-themed SVGs");
  console.log("2. Logo updated to '6side jewelry' with hexagon design");
  console.log("3. For production, consider replacing SVGs with actual jewelry photos");
  console.log("");
  console.log("📸 Recommended Real Jewelry Photo Sources:");
  console.log("- Unsplash.com (free jewelry photos)");
  console.log("- Pexels.com (free jewelry stock photos)");
  console.log("- Your own jewelry photography");
  console.log("- Stock photo services (Shutterstock, Getty Images)");
  console.log("");
  console.log("🔍 Image specifications for replacement:");
  console.log("- Home jumbotron: 1200x600px");
  console.log("- Product grids: 400x300px");
  console.log("- About sections: 600x400px");
  console.log("- Blog images: 800x500px");
}

// CLI usage
if (require.main === module) {
  replaceJewelryImages()
    .then(() => {
      console.log("🎉 Image replacement completed successfully!");
    })
    .catch((error) => {
      console.error("❌ Error replacing images:", error);
    });
}

module.exports = { JewelryImageGenerator, replaceJewelryImages };
