import { showToast, Toast, Clipboard, Form, ActionPanel, Action, getSelectedText } from "@raycast/api";
import { useState, useEffect } from "react";

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
  };
}

function generateCurlCommand(webhookJson: WebhookJson): string {
  const webhookNode = webhookJson.nodes[0];
  const nodeName = webhookNode.name;
  const pinData = webhookJson.pinData[nodeName]?.[0];
  
  if (!webhookNode || !pinData) {
    throw new Error("Invalid webhook JSON structure");
  }

  const { httpMethod } = webhookNode.parameters;
  const { body, webhookUrl } = pinData;

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
  const [webhookJson, setWebhookJson] = useState("");

  useEffect(() => {
    // Get selected text when command is launched
    getSelectedText().then((text) => {
      try {
        if (text) {
          const trimmed = text.trim();
          if (trimmed.startsWith('{')) {
            // Test if it's valid JSON
            JSON.parse(trimmed);
            setWebhookJson(trimmed);
          }
        }
      } catch (e) {
        // Any error, default to empty input
        console.error("Error processing selected text:", e);
        setWebhookJson("");
      }
    }).catch((e) => {
      // Error getting selected text, default to empty input
      console.error("Error getting selected text:", e);
      setWebhookJson("");
    });
  }, []);

  const handleSubmit = async () => {
    try {
      const trimmedJson = webhookJson.trim();
      const parsedJson = JSON.parse(trimmedJson) as WebhookJson;
      const curlCommand = generateCurlCommand(parsedJson);
      
      await Clipboard.copy(curlCommand);
      
      await showToast({
        style: Toast.Style.Success,
        title: "Curl command copied to clipboard",
      });
    } catch (error) {
      console.error("Error generating curl command:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to parse webhook JSON",
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
        id="webhook"
        title="Webhook JSON"
        placeholder="Paste your webhook JSON here..."
        value={webhookJson}
        onChange={setWebhookJson}
      />
    </Form>
  );
} 