import { showToast, Toast, Clipboard, Form, ActionPanel, Action, getSelectedText, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import { StoredInstance } from "./types";
import { InstanceSelector } from "./components/InstanceSelector";
import fetch from "node-fetch";
import { getApiEndpoints } from "./config";

interface WebhookNode {
  parameters: {
    httpMethod: string;
    path: string;
    options?: Record<string, unknown>;
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
  id?: string;      // Workflow ID if saved
  active?: boolean; // Workflow active state if saved
  nodes: WebhookNode[];
  connections: Record<string, unknown>;
  pinData: {
    [key: string]: Array<{
      body: Record<string, unknown>;
      webhookUrl: string;
      executionMode: string;
    }>;
  };
  meta?: {
    instanceId: string;
    instanceName: string;
  };
}

async function toggleWorkflowActive(instance: StoredInstance, workflowId: string, active: boolean): Promise<void> {
  if (!workflowId) {
    throw new Error("Workflow ID not found");
  }

  const endpoints = getApiEndpoints(instance);
  const response = await fetch(`${endpoints.workflows}/${workflowId}`, {
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

function generateCurlCommand(webhookJson: WebhookJson, selectedInstance?: StoredInstance): string {
  const webhookNode = webhookJson.nodes[0];
  const nodeName = webhookNode.name;
  const pinData = webhookJson.pinData[nodeName]?.[0];
  
  if (!webhookNode || !pinData) {
    throw new Error("Invalid webhook JSON structure");
  }

  const { httpMethod } = webhookNode.parameters;
  let { webhookUrl } = pinData;

  // If we have a selected instance and it's different from the original instance,
  // update the webhook URL
  if (selectedInstance && webhookJson.meta?.instanceId !== selectedInstance.id) {
    try {
      const originalUrl = new URL(webhookUrl);
      const newUrl = new URL(selectedInstance.baseUrl);
      originalUrl.protocol = newUrl.protocol;
      originalUrl.host = newUrl.host;
      webhookUrl = originalUrl.toString();
    } catch (error) {
      console.error("Error updating webhook URL:", error);
    }
  }

  const { body } = pinData;

  // Build the curl command
  const parts = [
    `curl --location '${webhookUrl}'`,
    `--request '${httpMethod}'`,
    "--header 'Content-Type: application/json'"
  ];

  // Add body if it exists and is not empty
  if (Object.keys(body).length > 0) {
    parts.push(`--data '${JSON.stringify(body, null, 2)}'`);
  }

  return parts.join(" \\\n");
}

export default function Command() {
  const [jsonInput, setJsonInput] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<StoredInstance>();
  const [originalInstanceName, setOriginalInstanceName] = useState<string>();
  const [workflowId, setWorkflowId] = useState<string>();
  const [isActive, setIsActive] = useState<boolean>();

  useEffect(() => {
    const init = async () => {
      let text = "";
      
      // Try selected text first
      try {
        text = await getSelectedText();
      } catch (error) {
        // If selected text fails, try clipboard
        try {
          text = await Clipboard.readText() || "";
        } catch (error) {
          // If both fail, leave input empty
          return;
        }
      }
      
      // Check if text starts with '{'
      const trimmedText = text.trim();
      if (trimmedText.startsWith('{')) {
        setJsonInput(trimmedText);
        try {
          const parsed = JSON.parse(trimmedText) as WebhookJson;
          if (parsed.meta?.instanceName) {
            setOriginalInstanceName(parsed.meta.instanceName);
          }
          if (parsed.id) {
            setWorkflowId(parsed.id);
          }
          if (typeof parsed.active === 'boolean') {
            setIsActive(parsed.active);
          }
        } catch (error) {
          console.error("Clipboard content is not valid JSON");
        }
      }
    };
    
    init();
  }, []);

  const handleSubmit = async () => {
    try {
      const trimmedJson = jsonInput.trim();
      const parsedJson = JSON.parse(trimmedJson) as WebhookJson;
      const curlCommand = generateCurlCommand(parsedJson, selectedInstance);
      
      await Clipboard.copy(curlCommand);
      
      const instanceInfo = selectedInstance
        ? ` for ${selectedInstance.name}`
        : originalInstanceName
          ? ` (original instance: ${originalInstanceName})`
          : '';

      await showToast({
        style: Toast.Style.Success,
        title: "Curl command copied to clipboard",
        message: `Webhook${instanceInfo}`,
      });
    } catch (e: unknown) {
      const error = e as Error;
      console.error("Error generating curl command:", { 
        error,
        message: error.message, 
        stack: error.stack,
        type: error.constructor.name
      });
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to parse webhook JSON",
        message: error.message || "Unknown error occurred",
      });
    }
  };

  const handleToggleActive = async () => {
    if (!workflowId || !selectedInstance) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot toggle workflow state",
        message: "No workflow ID or instance selected"
      });
      return;
    }

    try {
      const newState = !isActive;
      await toggleWorkflowActive(selectedInstance, workflowId, newState);
      setIsActive(newState);
      
      await showToast({
        style: Toast.Style.Success,
        title: `Workflow ${newState ? 'activated' : 'deactivated'}`,
        message: `Successfully ${newState ? 'activated' : 'deactivated'} the workflow`
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to toggle workflow state",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert and Copy" onSubmit={handleSubmit} />
          {workflowId && selectedInstance && (
            <Action
              title={isActive ? "Deactivate Workflow" : "Activate Workflow"}
              icon={isActive ? Icon.StopCircle : Icon.Circle}
              onAction={handleToggleActive}
            />
          )}
        </ActionPanel>
      }
    >
      {originalInstanceName && (
        <Form.Description
          title="Original Instance"
          text={originalInstanceName}
        />
      )}
      <InstanceSelector
        onInstanceSelect={setSelectedInstance}
        selectedInstanceId={selectedInstance?.id}
        dropdownTitle="Target Instance (Optional)"
        dropdownPlaceholder="Select target n8n instance"
      />
      <Form.TextArea
        id="webhook"
        title="Webhook JSON"
        placeholder="Paste your webhook JSON here..."
        value={jsonInput}
        onChange={setJsonInput}
      />
      {workflowId && (
        <Form.Description
          title="Workflow Status"
          text={`Workflow ID: ${workflowId}
Current Status: ${isActive ? '🟢 Active' : '🔴 Inactive'}`}
        />
      )}
    </Form>
  );
}
