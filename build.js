const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Directory containing built JS files
const distDir = path.join(__dirname, "dist");

// Read all files in dist directory
fs.readdir(distDir, (err, files) => {
  if (err) {
    console.error("Error reading dist directory:", err);
    return;
  }

  files.forEach((file) => {
    if (file.endsWith(".js")) {
      const filePath = path.join(distDir, file);
      let content = fs.readFileSync(filePath, "utf8");

      // Replace environment variables in the content
      Object.entries(process.env).forEach(([key, value]) => {
        // Only replace variables that start with USERSCRIPT_
        if (key.startsWith("USERSCRIPT_")) {
          const placeholder = `process.env.${key}`;
          content = content.replace(placeholder, `"${value}"`);
        }
      });

      // Write the modified content back to the file
      fs.writeFileSync(filePath, content);
      console.log(`Injected environment variables into ${file}`);
    }
  });
});
