# n8n Raycast Extension

A powerful Raycast extension that integrates with n8n, allowing you to manage and interact with your n8n workflows directly from your command bar. This extension provides quick access to your n8n instance, enabling you to execute workflows, monitor their status, and manage workflow states without leaving your workflow.

## Features

- 🚀 Execute n8n workflows directly from Raycast
- 📊 Monitor workflow execution status
- 🔄 Toggle workflow activation states
- 🔍 Search and filter workflows
- ⚡ Quick access to your n8n instance
- 🔐 Secure API token management

## Prerequisites

- [Raycast](https://raycast.com/) installed on your machine
- Running n8n instance (self-hosted or cloud)
- n8n API access token

## Installation

1. Install the extension from the Raycast store or:
   ```bash
   git clone https://github.com/yourusername/n8n-raycast-extension.git
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

## Usage

1. Open Raycast (`⌘` + `Space`)
2. Type "n8n" to see available commands:
   - View Workflows
   - Execute Workflow
   - Toggle Workflow State
   - Open n8n Dashboard

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
