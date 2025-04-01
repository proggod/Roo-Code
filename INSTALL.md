# Installing Roo Code Extension

This guide explains how to install the Roo Code extension directly from a .vsix file.

## Prerequisites

- Visual Studio Code (version 1.84.0 or higher)
- Node.js (version 20.18.1 or higher)

## Installation Steps

1. **Download the Extension**

    - Get the `roo-cline-<version>.vsix` file from the distributor
    - Save it to a location you can easily find (e.g., Downloads folder)

2. **Install in VS Code**

    - Open Visual Studio Code
    - Press `Cmd+Shift+P` (on macOS) or `Ctrl+Shift+P` (on Windows/Linux) to open the command palette
    - Type "Install from VSIX"
    - Select the .vsix file you downloaded
    - Click "Install" when prompted

3. **Verify Installation**
    - After installation, VS Code will prompt you to reload
    - Click "Reload" to restart VS Code
    - Look for the Roo Code icon in the activity bar (left sidebar)
    - If you don't see it, you can also press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) and type "Roo Code" to see available commands

## Troubleshooting

If you encounter any issues:

1. **Extension Not Showing**

    - Try reloading VS Code manually (File > Reload Window)
    - Check if the extension is listed in the Extensions panel (Cmd+Shift+X or Ctrl+Shift+X)

2. **Installation Failed**

    - Make sure you have the correct VS Code version (1.84.0 or higher)
    - Try installing with administrator/sudo privileges
    - Check if the .vsix file is not corrupted (try downloading again)

3. **Extension Not Working**
    - Check the VS Code output panel (View > Output) and select "Roo Code" from the dropdown
    - Look for any error messages
    - Make sure you have the required Node.js version installed

## Support

If you continue to experience issues, please contact the extension distributor for support.

## Security Note

This extension is being installed from a .vsix file rather than the VS Code Marketplace. Make sure you trust the source of the .vsix file before installation.
