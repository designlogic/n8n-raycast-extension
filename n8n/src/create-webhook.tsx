import { showToast, Toast, Clipboard, Form, ActionPanel, Action } from "@raycast/api";
import { v4 as uuidv4 } from 'uuid';
import { useState } from "react";

interface WebhookNode {
  parameters: {
    httpMethod: string;
    path: string;
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
  console.log("Input curl command:", curlCommand);
  
  // Normalize line endings and remove line continuations
  const normalizedCommand = curlCommand
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\\\n/g, ' ')   // Remove line continuations
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();

  console.log("Normalized command:", normalizedCommand);
  
  const result = {
    url: "",
    method: "GET",
    headers: {} as Record<string, string>,
    body: undefined as string | undefined
  };

  // Extract URL - handle both single and double quotes
  const urlMatch = normalizedCommand.match(/['"]([^'"]+)['"]/);
  if (urlMatch) {
    result.url = urlMatch[1];
    console.log("Extracted URL:", result.url);
  }

  // Check for method
  if (normalizedCommand.includes("--location")) {
    result.method = "POST";
    console.log("Method set to POST");
  }

  // Extract headers - handle both single and double quotes
  const headerMatches = normalizedCommand.matchAll(/--header\s+['"]([^:]+):\s*([^'"]+)['"]/g);
  for (const match of headerMatches) {
    result.headers[match[1]] = match[2];
    console.log("Extracted header:", match[1], match[2]);
  }

  // Extract body - handle both single and double quotes and multi-line JSON
  const bodyMatch = normalizedCommand.match(/--data\s+['"]([\s\S]*?)['"]/);
  if (bodyMatch) {
    try {
      // Try to parse the body as JSON to validate and normalize it
      const parsedBody = JSON.parse(bodyMatch[1]);
      result.body = JSON.stringify(parsedBody);
      console.log("Extracted and validated body:", result.body);
    } catch (e) {
      console.log("Failed to parse body as JSON:", e);
      result.body = bodyMatch[1];
    }
  }

  console.log("Final parsed result:", result);
  return result;
}

function generateWebhookJson(curlData: { url: string; method: string; headers: Record<string, string>; body?: string }): WebhookJson {
  console.log("Generating webhook JSON from:", curlData);
  const urlObj = new URL(curlData.url);
  const parsedBody = curlData.body ? JSON.parse(curlData.body) : {};
  console.log("Parsed body:", parsedBody);
  
  const webhookNode: WebhookNode = {
    parameters: {
      httpMethod: curlData.method,
      path: urlObj.pathname
    },
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    id: uuidv4(),
    name: "Webhook",
    webhookId: uuidv4(),
    notes: curlData.body ? `curl command with body: ${JSON.stringify(parsedBody, null, 2)}` : "curl command"
  };

  const result = {
    nodes: [webhookNode],
    connections: {},
    pinData: {
      "Webhook": [
        {
          body: parsedBody,
          webhookUrl: curlData.url,
          executionMode: "test"
        }
      ]
    }
  };

  console.log("Final webhook JSON:", result);
  return result;
}

export default function Command() {
  const defaultCurl = `curl --location 'https://workflow.sanctifai.com/webhook-test/hgi/find-humans' \
--header 'Content-Type: application/json' \
--data '{
    "description":"I need a human to draw me a picture"
}'`;
  
  const [curlCommand, setCurlCommand] = useState(defaultCurl);

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