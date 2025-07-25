# Domain URL Recorder

A Chrome extension that records all URLs visited and found within HTML content based on specified patterns, including dynamically loaded content.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-brightgreen?logo=googlechrome)](https://chromewebstore.google.com/detail/domain-url-recorder/aeiigknfkfbiniabffiofgmokiheboia)
[![GitHub Release](https://img.shields.io/github/v/release/iranzo/url_recorder)](https://github.com/iranzo/url_recorder/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🚀 Features

- **Pattern-Based Recording**: Records URLs according to user-defined regular expression patterns
- **Dynamic Content Support**: Captures URLs from dynamically loaded content, not just static HTML
- **Flexible Filtering**: Define custom regex patterns to match specific URL formats or domains
- **Export Functionality**: Download the recorded URL list as a file
- **Easy Management**: Clear recorded URLs with a single click
- **Lightweight**: Only 33KB in size with minimal performance impact

## 📦 Installation

### From Chrome Web Store (Recommended)

1. Visit the [Domain URL Recorder on Chrome Web Store](https://chromewebstore.google.com/detail/domain-url-recorder/aeiigknfkfbiniabffiofgmokiheboia)
2. Click "Add to Chrome"
3. Confirm the installation by clicking "Add extension"

### Manual Installation (Development)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## 🎯 Usage

1. **Set Up Patterns**: Click the extension icon to open the popup and configure your URL patterns using regular expressions
2. **Browse Normally**: Visit websites as usual - the extension will automatically record URLs matching your patterns
3. **Export URLs**: Click the download button to export your recorded URLs as a text file
4. **Clear History**: Use the clear button to reset your recorded URL list

### Example Patterns

- `.*\.pdf$` - Capture all PDF file URLs
- `https://example\.com/.*` - Capture all URLs from example.com
- `.*\.(jpg|png|gif)$` - Capture all image URLs
- `https://.*\.github\.io/.*` - Capture all GitHub Pages URLs

## 🔒 Privacy

This extension prioritizes your privacy:

- **No Data Collection**: The extension does not collect or store any personal information
- **Local Storage Only**: All recorded URLs are stored locally in your browser
- **No Third-Party Sharing**: Your data is never sent to external servers
- **No Tracking**: The extension does not track your browsing behavior beyond the specified patterns and just for your own usage

For more details, see our [Privacy Policy](PRIVACY.md).

## 🛠️ Development

### Project Structure

```
domain_url_recorder/
├── manifest.json          # Extension manifest
├── background.js          # Background script
├── content.js            # Content script for page interaction
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Building

The extension uses vanilla JavaScript and doesn't require a build process. Simply load the directory as an unpacked extension in Chrome for development.

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Requirements

- Chrome browser (version 88 or higher recommended)
- Manifest V3 support

## 🐛 Issues & Support

If you encounter any issues or have suggestions:

1. Check the [existing issues](https://github.com/iranzo/url_recorder/issues)
2. Create a new issue if needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

---

⭐ If you find this extension useful, please consider leaving a review on the Chrome Web Store!
