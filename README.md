# n8n Raycast Extension

A powerful Raycast extension that integrates with n8n, providing quick access to your workflows and data transformation tools. This extension allows you to search workflows, create new ones, and handle data mappings directly from Raycast.

## Features

- 🔍 Search and browse workflows with filtering capabilities
- ➕ Create new workflows directly from Raycast
- 🔄 Convert JSON and manual mappings
- 🌐 Create and parse webhooks
- ⚡ Quick access to your n8n instance
- 🔐 Secure API token management

## Prerequisites

- [Raycast](https://raycast.com/) installed on your machine
- Running n8n instance (self-hosted or cloud)
- n8n API access token

## Installation

1. Install the extension from the Raycast store or:
   ```bash
   git clone https://github.com/designlogic/n8n-raycast-extension.git
   cd n8n-raycast-extension
   ```

2. Configure your n8n credentials in Raycast:
   - Open Raycast
   - Search for "n8n"
   - Go to extension settings
   - Add your n8n instance URL and API token

## Development

To work on the extension locally:

1. Clone the repository
2. Navigate to the n8n directory:
   ```bash
   cd n8n
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Available Commands

- `Search Workflows`: Browse and search through your n8n workflows with tag filtering
- `Create Workflow`: Create a new workflow with a specified name
- `Convert JSON Mapping`: Convert JSON data to n8n mapping format
- `Convert Manual Mapping`: Convert manual mapping data to n8n format
- `Create Webhook`: Create a new webhook for your workflows
- `Parse Webhook`: Parse and analyze webhook data

## Configuration

In Raycast preferences, configure:
- n8n Instance URL
- API Token
- Default view preferences
- Refresh intervals

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
