import { showToast, Toast, Clipboard, Form, ActionPanel, Action, Icon } from "@raycast/api";
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect } from "react";
import parseCurl from 'parse-curl';
import { sentenceCase } from "change-case";
import { InstanceSelector } from "./components/InstanceSelector";
import { StoredInstance } from "./types";
import { getApiEndpoints } from "./config";
import fetch from "node-fetch";

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

const EXAMPLE_CURL = `curl --location 'https://api.example.com/webhook' \\
--header 'Content-Type: application/json' \\
--data '{
    "event": "user.created",
    "data": {
        "id": 123,
        "name": "John Doe"
    }
}'`;

async function toggleWorkflowStatus(instance: StoredInstance, workflowId: string, active: boolean): Promise<void> {
  const apiEndpoints = getApiEndpoints(instance);
  const response = await fetch(`${apiEndpoints.workflows}/${workflowId}`, {
    method: 'PATCH',
    headers: {
      'X-N8N-API-KEY': instance.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ active })
  });

  if (!response.ok) {
    throw new Error(`Failed to ${active ? 'activate' : 'deactivate'} workflow: ${response.statusText}`);
  }
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
  const lastSegment = segments[segments.length - 1] || 'webhook';
  
  // Convert kebab-case or snake_case to Title Case
  return sentenceCase(lastSegment.replace(/[-_]/g, ' '));
}

function generateWebhookJson(
  curlData: { url: string; method: string; headers: Record<string, string>; body?: string }, 
  originalCurl: string,
  instance: StoredInstance,
  active: boolean = false
): WebhookJson {
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

  const json: WebhookJson = {
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

  return json;
}

export default function Command() {
  const [curlCommand, setCurlCommand] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<StoredInstance>();
  const [activateOnCreate, setActivateOnCreate] = useState(false);

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
        title: "No Instance Selected",
        message: "Please select an n8n instance"
      });
      return;
    }

    try {
      const trimmedCommand = curlCommand.trim() || EXAMPLE_CURL;
      const parsedCurl = parseCurlCommand(trimmedCommand);
      const webhookJson = generateWebhookJson(parsedCurl, trimmedCommand, selectedInstance, activateOnCreate);
      
      await Clipboard.copy(JSON.stringify(webhookJson, null, 2));
      
      await showToast({
        style: Toast.Style.Success,
        title: "Webhook JSON copied to clipboard",
        message: `For instance: ${selectedInstance.name}${activateOnCreate ? ' (will activate on create)' : ''}`
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to parse curl command",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handlePasteExample = () => {
    setCurlCommand(EXAMPLE_CURL);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert and Copy" onSubmit={handleSubmit} />
          <Action 
            title="Paste Example" 
            icon={Icon.Document}
            onAction={handlePasteExample}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Create Webhook Node"
        text={`Convert a curl command into an n8n webhook node configuration. 
        
Paste a curl command (like one exported from Postman) and it will be converted into a webhook node configuration that you can paste into n8n.

The curl command should include:
- URL (required)
- Method (GET, POST, etc.)
- Headers (optional)
- Request body (optional)

Example curl command structure:
${EXAMPLE_CURL}`}
      />
      
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

      <Form.Checkbox
        id="activate"
        label="Activate Workflow"
        value={activateOnCreate}
        onChange={setActivateOnCreate}
      />
    </Form>
  );
}
