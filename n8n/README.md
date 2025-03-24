# n8n Raycast Extension

A Raycast extension that provides quick access to your n8n workflows, allowing you to execute and manage them directly from your command bar.

## Overview

This extension is built using the Raycast extension framework and provides a seamless integration with n8n. It allows you to:
- Execute workflows with a single command
- Monitor workflow execution status
- Toggle workflow activation states
- Search through your workflows
- Access your n8n instance quickly

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Import the extension in Raycast:
   - Open Raycast
   - Press `⌘` + `Space`
   - Type "Import Extension"
   - Select the n8n directory

## Project Structure

```
n8n/
├── src/              # Source code
├── assets/           # Extension assets
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

## Available Commands

- `Execute Workflow`: Run a selected workflow
- `View Workflows`: List all available workflows
- `Toggle Workflow State`: Enable/disable workflows
- `Open n8n Dashboard`: Quick access to n8n web interface

## Configuration

The extension requires the following configuration in Raycast preferences:
- n8n Instance URL
- API Token
- Default view preferences

## Building

To build the extension for distribution:

```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

[MIT License](../LICENSE)