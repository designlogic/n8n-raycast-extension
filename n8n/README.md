# n8n Raycast Extension

A Raycast extension that provides quick access to your n8n workflows and data transformation tools. This extension enables you to search workflows, create new ones, and handle data mappings directly from Raycast.

## Overview

This extension is built using the Raycast extension framework and provides a seamless integration with n8n. It allows you to:
- Search and browse workflows with tag filtering
- Create new workflows
- Convert JSON and manual mappings
- Create and parse webhooks
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
├── src/
│   ├── search-workflows.tsx      # Search and browse workflows
│   ├── create-workflow.tsx       # Create new workflows
│   ├── convert-json-mapping.tsx  # Convert JSON to n8n mapping
│   ├── convert-manual-mapping.tsx # Convert manual mapping
│   ├── create-webhook.tsx        # Create webhooks
│   ├── parse-webhook.tsx         # Parse webhook data
│   ├── types.ts                  # TypeScript type definitions
│   ├── utils.ts                  # Utility functions
│   └── config.ts                 # Configuration settings
├── assets/                       # Extension assets
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript configuration
```

## Available Commands

### Search Workflows
- Browse all workflows
- Filter by tags
- View workflow details
- Quick access to workflow actions

### Create Workflow
- Create new workflows with specified names
- Quick setup for new automation tasks

### Convert JSON Mapping
- Convert JSON data to n8n mapping format
- Streamline data transformation

### Convert Manual Mapping
- Convert manual mapping data to n8n format
- Simplify mapping creation

### Create Webhook
- Generate new webhooks for workflows
- Configure webhook settings

### Parse Webhook
- Analyze webhook data
- View webhook details

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