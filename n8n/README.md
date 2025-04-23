# n8n Raycast Extension

A Raycast extension for managing n8n workflows and instances. This extension provides a seamless interface between Raycast and n8n, allowing you to manage your automation workflows efficiently.

## Features

### Comprehensive Multi-Instance Support
- Connect to multiple n8n instances simultaneously (unlimited instances)
- Compatible with all n8n deployment types:
  - Self-hosted installations (local servers)
  - Cloud-hosted instances (AWS, GCP, Azure, etc.)
  - n8n.cloud accounts
  - Docker deployments
  - Kubernetes clusters
- Color-coded instance differentiation for easy visual identification
- Individual connection status monitoring for each instance
- Instance-specific workflow management
- Automatic instance status refresh

### Workflow Management
- Search and filter workflows across all instances
- Advanced fuzzy search with progressive matching strategy
- Create new workflows directly from Raycast
- Activate/deactivate workflows with status indicators
- Batch workflow processing for performance optimization

### Utilities
- Convert between curl commands and n8n webhooks
- Convert between JSON and Manual Mapping formats

## Installation

1. Install [Raycast](https://raycast.com/)
2. Install this extension from the Raycast store
3. Configure your n8n instance(s) in the extension settings

## Usage

The extension provides several commands:
- **Manage n8n Instances**: Add, edit, or remove n8n instances
- **Search Workflows**: Search and manage your n8n workflows across all instances
- **Create Workflow**: Create a new n8n workflow in your preferred instance
- **Create/Parse Webhook**: Convert between curl commands and n8n webhooks
- **Convert JSON/Manual Mapping**: Convert between Set node formats

## Security

- Authentication support for both API Key and Bearer Token methods
- Production dependencies are regularly monitored for vulnerabilities
- Automated dependency updates via Renovate
- API keys are securely stored in Raycast's secure storage

## Development

```bash
# Install dependencies
npm install

# Start development
npm run dev
```

## Contributors

This extension is currently maintained by:
- Daniel Willitzer ([@dwillitzer](https://github.com/dwillitzer))

Originally created by:
- Tyler Thompson ([@designlogic](https://github.com/designlogic))

## License

MIT License - see LICENSE file for details
