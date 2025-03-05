import { showToast, Toast, Clipboard, Form, ActionPanel, Action } from "@raycast/api";
import { v4 as uuidv4 } from 'uuid';
import { useState } from "react";

interface WebhookNode {
  parameters: {
    httpMethod: string;
    path: string;
    options: {
      rawBody: boolean;
    };
  };
  type: string;
  typeVersion: number;
  position: number[];
  id: string;
  name: string;
  webhookId: string;
  notes: string;
}

interface WebhookJson {
  nodes: WebhookNode[];
  connections: Record<string, unknown>;
  pinData?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

function parseCurlCommand(curlCommand: string): { url: string; method: string; headers: Record<string, string>; body?: string } {
  const lines = curlCommand.split("\n").map(line => line.trim());
  const result = {
    url: "",
    method: "GET",
    headers: {} as Record<string, string>,
    body: undefined as string | undefined
  };

  const currentLine = lines[0];
  // Extract URL
  const urlMatch = currentLine.match(/'([^']+)'/);
  if (urlMatch) {
    result.url = urlMatch[1];
  }

  // Check for method
  if (currentLine.includes("--location")) {
    result.method = "POST";
  }

  // Process remaining lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("--header")) {
      const headerMatch = line.match(/'([^:]+):\s*([^']+)'/);
      if (headerMatch) {
        result.headers[headerMatch[1]] = headerMatch[2];
      }
    } else if (line.startsWith("--data")) {
      const dataMatch = line.match(/'({[^}]+})'/);
      if (dataMatch) {
        result.body = dataMatch[1];
      }
    }
  }

  return result;
}

function generateWebhookJson(curlData: { url: string; method: string; headers: Record<string, string>; body?: string }): WebhookJson {
  const urlObj = new URL(curlData.url);
  const webhookNode: WebhookNode = {
    parameters: {
      httpMethod: curlData.method,
      path: urlObj.pathname,
      options: {
        rawBody: false
      }
    },
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    id: uuidv4(),
    name: "Webhook",
    webhookId: uuidv4(),
    notes: curlData.body ? `curl command with body: ${curlData.body}` : "curl command"
  };

  return {
    nodes: [webhookNode],
    connections: {},
  };
}

export default function Command() {
  const [curlCommand, setCurlCommand] = useState("");

  const handleSubmit = async () => {
    try {
      const parsedCurl = parseCurlCommand(curlCommand);
      const webhookJson = generateWebhookJson(parsedCurl);
      
      await Clipboard.copy(JSON.stringify(webhookJson, null, 2));
      
      await showToast({
        style: Toast.Style.Success,
        title: "Webhook JSON copied to clipboard",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to parse curl command",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert and Copy" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="curl"
        title="Curl Command"
        placeholder="Paste your curl command here..."
        value={curlCommand}
        onChange={setCurlCommand}
      />
    </Form>
  );
} 