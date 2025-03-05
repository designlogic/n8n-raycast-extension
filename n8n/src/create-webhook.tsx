import { showToast, Toast, Clipboard, Form, ActionPanel, Action } from "@raycast/api";
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect } from "react";
import parseCurl from 'parse-curl';
import { sentenceCase } from "change-case";

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
  const parsed = parseCurl(curlCommand);
  return {
    url: parsed.url || "",
    method: parsed.method || "GET",
    headers: parsed.header || {},
    body: parsed.body
  };
}

function getWebhookNameFromPath(path: string): string {
  // Remove leading/trailing slashes and get the last segment
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const segments = cleanPath.split('/');
  const lastSegment = segments[segments.length - 1];
  
  // Convert kebab-case or snake_case to Title Case
  return sentenceCase(lastSegment.replace(/[-_]/g, ' '));
}

function generateWebhookJson(curlData: { url: string; method: string; headers: Record<string, string>; body?: string }, originalCurl: string): WebhookJson {
  const urlObj = new URL(curlData.url);
  // Extract path after webhook-test
  const pathMatch = urlObj.pathname.match(/\/webhook-test(.*)/);
  const path = pathMatch ? pathMatch[1] : urlObj.pathname;
  
  const parsedBody = curlData.body ? JSON.parse(curlData.body) : {};
  
  // Get webhook name from the last segment of the path
  const webhookName = getWebhookNameFromPath(path);
  
  const webhookNode: WebhookNode = {
    parameters: {
      httpMethod: curlData.method,
      path: path
    },
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    id: uuidv4(),
    name: webhookName,
    webhookId: uuidv4(),
    notes: `Original curl command:\n${originalCurl}`
  };

  return {
    nodes: [webhookNode],
    connections: {},
    pinData: {
      [webhookName]: [
        {
          body: parsedBody,
          webhookUrl: curlData.url,
          executionMode: "test"
        }
      ]
    }
  };
}

export default function Command() {
  const [curlCommand, setCurlCommand] = useState("");

  useEffect(() => {
    const initClipboard = async () => {
      try {
        const text = await Clipboard.readText();
        console.log("Clipboard content:", text);
        
        if (!text) {
          console.log("No clipboard content found");
          return;
        }

        const trimmedText = text.trim();
        console.log("Trimmed text starts with '{':", trimmedText.startsWith('{'));
        
        if (trimmedText.startsWith('{')) {
          console.log("Attempting to parse JSON");
          const jsonData = JSON.parse(trimmedText) as WebhookJson;
          console.log("Parsed JSON:", jsonData);
          
          if (jsonData.pinData) {
            console.log("Found pinData:", jsonData.pinData);
            const nodeData = Object.values(jsonData.pinData)[0];
            console.log("First node data:", nodeData);
            
            if (Array.isArray(nodeData) && nodeData[0]?.webhookUrl) {
              console.log("Found webhook URL:", nodeData[0].webhookUrl);
              const method = jsonData.nodes?.[0]?.parameters?.httpMethod || 'GET';
              const body = nodeData[0].body ? JSON.stringify(nodeData[0].body) : '';
              const curlCmd = `curl -X ${method} "${nodeData[0].webhookUrl}"${body ? ` -d '${body}'` : ''}`;
              console.log("Generated curl command:", curlCmd);
              setCurlCommand(curlCmd);
            } else {
              console.log("No webhook URL found in node data");
            }
          } else {
            console.log("No pinData found in JSON");
          }
        } else {
          console.log("Clipboard content doesn't start with '{'");
        }
      } catch (error) {
        console.error("Error processing clipboard:", error);
      }
    };
    
    initClipboard();
  }, []);

  const handleSubmit = async () => {
    try {
      const trimmedCommand = curlCommand.trim();
      const parsedCurl = parseCurlCommand(trimmedCommand);
      const webhookJson = generateWebhookJson(parsedCurl, trimmedCommand);
      
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