# Zoho UCP Integration Plugin

A browser extension that integrates UCP (Unified Communications Platform) into Zoho CRM and other web applications with a draggable interface and call handling capabilities.

## Features

- **Draggable UCP Interface**: Floating, resizable UCP window that can be positioned anywhere on the screen
- **Call Management**: Handle incoming calls with automatic popup and notifications
- **Cross-Platform Support**: Works on Zoho domains and localhost for testing
- **Persistent State**: Remembers window position and visibility state
- **Browser Notifications**: Desktop notifications for incoming calls
- **Secure Integration**: Message validation and origin checking for security

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the plugin directory
4. The UCP Integration icon should appear in your extensions toolbar

## Usage

### Basic Operation
- Click the extension icon or the "Open UCP" button to show/hide the UCP interface
- Drag the UCP window by its header to reposition it
- Use the minimize (-) or close (×) buttons to hide the interface
- The window is resizable by dragging from the bottom-right corner

### Call Handling
- Incoming calls automatically show the UCP window and display notifications
- The extension will focus the browser tab when calls arrive
- Call events are logged to the browser console for debugging

### Supported Domains
- `*.zoho.com`
- `*.zoho.eu`
- `*.zoho.in` 
- `*.crm.zoho.com`
- `localhost` (for testing)
- `127.0.0.1` (for testing)

## File Structure

```
zoho/
├── manifest.json          # Extension manifest and permissions
├── background.js          # Service worker for background tasks
├── content.js            # Content script for page injection
├── ucp-plugin.html       # UCP interface HTML structure
├── ucp-plugin.css        # Styling for the UCP interface
├── ucp-plugin.js         # UCP functionality and event handling
├── icon.png              # Extension icon
└── UCP/                  # Original React components (reference)
    └── src/
        ├── App.jsx
        ├── pages/ZohoUCP.jsx
        └── components/
            ├── UCP.js
            └── UCP.css
```

## Configuration

The plugin can be configured through Chrome's extension storage:

- `ucpEnabled`: Enable/disable the plugin (default: true)
- `autoOpen`: Automatically open UCP on page load (default: false)
- `ucpUrl`: UCP server URL (default: https://ucdemo.voicemeetme.com/ucp/login)

## API Events

The plugin listens for and handles these UCP message types:

- `UCP_INCOMING_CALL`: Incoming call notification
- `UCP_SESSION_CREATED`: UCP session establishment
- `UCP_FULLSCREEN_CHANGE`: Fullscreen mode toggle
- `UCP_CALL_ENDED`: Call termination

## Development

### Testing Locally
1. Load the extension in developer mode
2. Navigate to a supported domain (e.g., localhost or zoho.com)
3. The UCP interface should automatically inject
4. Use browser developer tools to monitor console logs

### Debugging
- Check the extension's background script logs in `chrome://extensions/`
- Monitor content script logs in the page's developer console
- Use `window.ucpPlugin` and `window.ucpContentScript` for debugging

### Customization
- Modify `ucp-plugin.css` for styling changes
- Update `ucp-plugin.js` for functionality changes
- Edit `manifest.json` to add new permissions or domains

## Security

- All UCP messages are validated for origin security
- Content is sandboxed within iframes
- Only trusted domains are allowed for injection
- Secure message passing between extension components

## Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers with Manifest V3 support

## Troubleshooting

### UCP Not Appearing
1. Check that you're on a supported domain
2. Verify the extension is enabled in `chrome://extensions/`
3. Check browser console for error messages
4. Try refreshing the page

### Call Notifications Not Working
1. Ensure browser notifications are enabled
2. Check that the UCP URL is accessible
3. Verify iframe permissions in browser settings
4. Check network connectivity to UCP servers

### Performance Issues
1. Close unused UCP windows
2. Check for JavaScript errors in console
3. Disable other conflicting extensions
4. Clear browser cache and reload

## License

This plugin is designed for internal use with Zoho CRM and VoiceMeetMe UCP systems.

## Support

For technical support or feature requests, please contact your system administrator or development team.
# zoho_plugin_cdr
