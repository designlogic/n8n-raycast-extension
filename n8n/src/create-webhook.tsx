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
  const lines = curlCommand.split("\n").map(line => line.trim());
  console.log("Split lines:", lines);
  
  const result = {
    url: "",
    method: "GET",
    headers: {} as Record<string, string>,
    body: undefined as string | undefined
  };

  const currentLine = lines[0];
  console.log("First line:", currentLine);
  
  // Extract URL
  const urlMatch = currentLine.match(/'([^']+)'/);
  if (urlMatch) {
    result.url = urlMatch[1];
    console.log("Extracted URL:", result.url);
  }

  // Check for method
  if (currentLine.includes("--location")) {
    result.method = "POST";
    console.log("Method set to POST");
  }

  // Process remaining lines
  let i = 1;
  while (i < lines.length) {
    const line = lines[i];
    console.log("Processing line:", line);
    
    if (line.startsWith("--header")) {
      const headerMatch = line.match(/'([^:]+):\s*([^']+)'/);
      if (headerMatch) {
        result.headers[headerMatch[1]] = headerMatch[2];
        console.log("Extracted header:", headerMatch[1], headerMatch[2]);
      }
      i++;
    } else if (line.startsWith("--data")) {
      // Handle multi-line JSON body
      const bodyLines = [];
      i++; // Skip the --data line
      
      // Collect all lines until we find the closing quote
      while (i < lines.length && !lines[i].endsWith("'")) {
        bodyLines.push(lines[i]);
        i++;
      }
      // Add the last line with the closing quote
      if (i < lines.length) {
        bodyLines.push(lines[i]);
      }
      
      // Join the lines and extract the JSON
      const fullBody = bodyLines.join("\n");
      const dataMatch = fullBody.match(/'({[\s\S]*})'/);
      if (dataMatch) {
        result.body = dataMatch[1];
        console.log("Extracted body:", result.body);
      }
      i++;
    } else {
      i++;
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
  const defaultCurl = `curl --location 'https://workflow.sanctifai.com/webhook-test/hgi/find-humans' \\
--header 'Content-Type: application/json' \\
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