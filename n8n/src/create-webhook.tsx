import { showToast, Toast, Clipboard, Form, ActionPanel, Action } from "@raycast/api";
import { v4 as uuidv4 } from 'uuid';
import { useState } from "react";
import parseCurl from 'parse-curl';

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
  
  try {
    const parsed = parseCurl(curlCommand);
    console.log("Parsed curl:", parsed);
    
    const result = {
      url: parsed.url || "",
      method: parsed.method || "GET",
      headers: parsed.header || {},
      body: parsed.body
    };

    console.log("Final parsed result:", result);
    return result;
  } catch (error) {
    console.error("Failed to parse curl:", error);
    throw error;
  }
}

function generateWebhookJson(curlData: { url: string; method: string; headers: Record<string, string>; body?: string }, originalCurl: string): WebhookJson {
  console.log("Generating webhook JSON from:", curlData);
  const urlObj = new URL(curlData.url);
  // Extract path after webhook-test
  const pathMatch = urlObj.pathname.match(/\/webhook-test(.*)/);
  const path = pathMatch ? pathMatch[1] : urlObj.pathname;
  console.log("Extracted path:", path);
  
  const parsedBody = curlData.body ? JSON.parse(curlData.body) : {};
  console.log("Parsed body:", parsedBody);
  
  const webhookNode: WebhookNode = {
    parameters: {
      httpMethod: curlData.method,
      path: path
    },
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    id: uuidv4(),
    name: "Webhook",
    webhookId: uuidv4(),
    notes: `Original curl command:\n${originalCurl}`
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
      const webhookJson = generateWebhookJson(parsedCurl, curlCommand);
      
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