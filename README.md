# Tampermonkey Scripts

A collection of useful Tampermonkey scripts for various purposes.

## Available Scripts

### Rich Content to Markdown Converter
A script that converts webpage content to clean, well-formatted markdown using the Groq API. It preserves images, formatting, and structure while removing unnecessary elements.

**Features:**
- Converts any webpage content to markdown
- Preserves images (as base64 or URLs)
- Maintains headings, lists, and formatting
- Handles large pages by splitting content
- Easy copy-to-clipboard functionality
- Settings button to update API key

**Setup:**
1. Install the script in Tampermonkey
2. Get a Groq API key from [console.groq.com](https://console.groq.com)
3. Enter your API key when prompted
4. Click the "📝 Copy Rich Content" button on any webpage

### E-Factura Bulk Downloader (In Development)
A script to help download multiple e-factura documents. Currently under development.

## Development

### Prerequisites
- Node.js
- pnpm
- TypeScript

### Installation
```bash
# Install dependencies
pnpm install

# Build scripts
pnpm build

# Watch for changes during development
pnpm dev
```

### Environment Variables
Create a `.env` file in the root directory with your API keys:
```env
USERSCRIPT_GROQ_API_KEY=your_groq_api_key_here
```

### Project Structure
```
├── src/                # Source TypeScript files
│   ├── groq-webscraper.ts
│   └── efactura-bulk-downloader.ts
├── dist/              # Compiled JavaScript files
├── .env              # Environment variables (not committed)
└── build.js          # Build script for injecting env variables
```

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License
ISC License 