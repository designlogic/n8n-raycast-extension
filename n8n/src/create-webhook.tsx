import { showToast, Toast, Clipboard, Form, ActionPanel, Action } from "@raycast/api";
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect } from "react";
import parseCurl from 'parse-curl';
import { sentenceCase } from "change-case";
import { InstanceSelector } from "./components/InstanceSelector";
import { N8nInstance } from "./types";

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
  meta?: {
    instanceId: string;
    instanceName: string;
  };
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

function generateWebhookJson(
  curlData: { url: string; method: string; headers: Record<string, string>; body?: string }, 
  originalCurl: string,
  instance: N8nInstance
): WebhookJson {
  const urlObj = new URL(curlData.url);
  // Extract path after webhook-test
  const pathMatch = urlObj.pathname.match(/\/webhook-test(.*)/)?.slice(1) || [urlObj.pathname];
  const path = pathMatch[0];
  
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
    },
    meta: {
      instanceId: instance.id,
      instanceName: instance.name
    }
  };
}

export default function Command() {
  const [curlCommand, setCurlCommand] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<N8nInstance>();

  useEffect(() => {
    const initClipboard = async () => {
      try {
        const text = await Clipboard.readText();
        if (text) {
          const trimmedText = text.trim();
          if (trimmedText.toLowerCase().startsWith('curl')) {
            setCurlCommand(trimmedText);
          }
        }
      } catch (error) {
        // Silently handle clipboard errors
      }
    };
    
    initClipboard();
  }, []);

  const handleSubmit = async () => {
    if (!selectedInstance) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No instance selected",
        message: "Please select an n8n instance",
      });
      return;
    }

    try {
      const trimmedCommand = curlCommand.trim();
      const parsedCurl = parseCurlCommand(trimmedCommand);
      const webhookJson = generateWebhookJson(parsedCurl, trimmedCommand, selectedInstance);
      
      await Clipboard.copy(JSON.stringify(webhookJson, null, 2));
      
      await showToast({
        style: Toast.Style.Success,
        title: "Webhook JSON copied to clipboard",
        message: `For instance: ${selectedInstance.name}`,
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
      <InstanceSelector
        onInstanceSelect={setSelectedInstance}
        selectedInstanceId={selectedInstance?.id}
      />
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
