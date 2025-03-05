import { showToast, Toast, Clipboard, Form, ActionPanel, Action } from "@raycast/api";
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
    const init = async () => {
      try {
        const text = await Clipboard.readText();
        if (text?.trim() && text.trim().startsWith('{')) {
          try {
            // Validate it's proper JSON
            JSON.parse(text.trim());
            setWebhookJson(text.trim());
          } catch (e) {
            // Invalid JSON, leave input empty
            console.log("Clipboard content is not valid JSON");
          }
        }
      } catch (e) {
        // Error reading clipboard, leave input empty
        console.log("Could not read clipboard");
      }
    };

    init();
  }, []);

  const handleSubmit = async () => {
    try {
      console.log("Handling submit...");
      const trimmedJson = webhookJson.trim();
      console.log("Trimmed JSON length:", trimmedJson.length);
      
      const parsedJson = JSON.parse(trimmedJson) as WebhookJson;
      console.log("Parsed webhook JSON:", { 
        nodeCount: parsedJson.nodes?.length,
        nodeName: parsedJson.nodes?.[0]?.name,
        hasPinData: !!parsedJson.pinData
      });
      
      const curlCommand = generateCurlCommand(parsedJson);
      console.log("Generated curl command length:", curlCommand.length);
      
      await Clipboard.copy(curlCommand);
      
      await showToast({
        style: Toast.Style.Success,
        title: "Curl command copied to clipboard",
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