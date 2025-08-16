# Roblox Community Wealth Tracker

A Chrome extension that analyzes Roblox community members and ranks them by their wealth based on limited item ownership.

## Features

- 📊 **Community Analysis**: Extract and analyze all members from Roblox communities
- 💰 **Wealth Ranking**: Rank members by their total RAP (Recent Average Price) value
- 🚀 **Fast Processing**: Optimized batch processing for large communities (2M+ members)
- 🔄 **Real-time Updates**: Refresh functionality without re-entering community links
- 💎 **High-Value Filter**: Only counts limited items worth more than 10,000 Robux
- 👤 **Username Display**: Shows usernames (not display names) with total RAP values

## Installation

1. **Download the Extension**
   - Download all files from this repository
   - Keep all files in the same folder

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Pin the Extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Roblox Community Wealth Tracker" and pin it

## Usage

1. **Navigate to Roblox**
   - Go to https://www.roblox.com and log in to your account
   - The extension needs you to be logged in to access Roblox APIs

2. **Get Community Link**
   - Find a Roblox community (group) you want to analyze
   - Copy the community link (format: `https://www.roblox.com/communities/12345678/Name#!/about`)

3. **Use the Extension**
   - Click the extension icon in your toolbar
   - Paste the community link in the text box
   - Click "Search for List" to start analysis

4. **View Results**
   - Wait for the analysis to complete (progress is shown)
   - View the ranked list of wealthy members
   - Use "Refresh" to update data without re-entering the link

## How It Works

### Community ID Extraction
- Extracts the numeric ID from 2025 Roblox community URLs
- Validates the ID format and ensures it's a valid community

### Member Fetching
- Uses Roblox Groups API to fetch all community members
- Handles pagination to get complete member lists
- Optimized for large communities with millions of members

### Wealth Analysis
- Fetches each member's collectible inventory
- Calculates total RAP value from limited items
- Only includes items worth more than 10,000 Robux
- Sorts members by total wealth in descending order

### Performance Optimizations
- Concurrent batch processing (50 members per batch, 5 batches simultaneously)
- Smart rate limiting to avoid API restrictions
- Progress tracking for large communities
- Efficient data caching and processing

## API Compatibility

This extension is designed to work with Roblox's 2025 website updates and uses the following APIs:

- **Groups API**: For fetching community members
- **Inventory API**: For accessing user collectibles
- **Economy API**: For item value data

## Limitations

- Requires user to be logged in to Roblox
- Rate limited by Roblox API restrictions
- Only analyzes publicly visible inventories
- Limited to collectible items (hats, gear, faces, packages)

## Troubleshooting

### "No members found" Error
- Check if the community link is correct
- Ensure the community is public
- Verify you're logged in to Roblox

### Slow Processing
- Large communities take time to process
- Check your internet connection
- Wait for rate limiting to clear

### Extension Not Working
- Refresh the Roblox page
- Disable and re-enable the extension
- Check Chrome console for errors

## Privacy & Security

- Extension only accesses Roblox APIs
- No data is sent to external servers
- Uses your existing Roblox session cookies
- All processing happens locally in your browser

## Support

If you encounter issues:
1. Check the Chrome DevTools console for errors
2. Ensure you're using the latest version of Chrome
3. Verify all extension files are present
4. Try reloading the extension

## Version History

- **v1.0**: Initial release with community analysis and wealth ranking

---

**Note**: This extension is not affiliated with Roblox Corporation. Use responsibly and respect Roblox's Terms of Service.