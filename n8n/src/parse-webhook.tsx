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
    const init = async () => {
      console.log("Command initialized");
      try {
        console.log("Starting getSelectedText...");
        const text = await getSelectedText();
        console.log("getSelectedText completed:", { text, length: text?.length, type: typeof text });
        
        // If no text is selected or text is empty, just return
        if (!text?.trim()) {
          console.log("No text selected or empty text, returning...");
          return;
        }

        try {
          const trimmed = text.trim();
          console.log("Trimmed text:", { trimmed, length: trimmed.length });
          
          if (trimmed.startsWith('{')) {
            console.log("Text starts with {, attempting to parse as JSON...");
            // Test if it's valid JSON
            const parsed = JSON.parse(trimmed);
            console.log("Successfully parsed JSON:", { nodeCount: parsed.nodes?.length });
            setWebhookJson(trimmed);
          } else {
            console.log("Text doesn't start with {, ignoring...");
          }
        } catch (e: unknown) {
          // Any error, default to empty input
          const error = e as Error;
          console.error("Error processing selected text:", { 
            error,
            message: error.message, 
            stack: error.stack 
          });
          setWebhookJson("");
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Failed to get selected text:", {
          error,
          message: error.message,
          stack: error.stack,
          type: error.constructor.name
        });

        // Show a helpful message if it's a permissions error
        if (error.message.includes("Unable to get selected text")) {
          await showToast({
            style: Toast.Style.Failure,
            title: "⚠️ Permission Required",
            message: "Please grant Accessibility permission to Raycast in System Settings → Privacy & Security → Accessibility",
          });
        }
        setWebhookJson("");
      }
    };

    // Show initial toast to indicate we're checking for selected text
    showToast({
      style: Toast.Style.Animated,
      title: "Checking for selected text...",
    });

    init().catch(console.error);
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