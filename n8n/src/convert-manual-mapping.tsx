import { showToast, Toast, Form, ActionPanel, Action, popToRoot, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";

interface N8nNode {
  parameters: {
    mode?: string;
    assignments?: {
      assignments: Assignment[];
    };
    [key: string]: any;
  };
  type: string;
  typeVersion: number;
  position: [number, number];
  id: string;
  name: string;
  notesInFlow: boolean;
}

interface N8nWorkflow {
  nodes: N8nNode[];
  connections: Record<string, any>;
  pinData: Record<string, any>;
  meta: {
    templateCredsSetupCompleted: boolean;
    instanceId: string;
  };
}

interface Assignment {
  id: string;
  name: string;
  value: unknown;
  type: string;
}

function parseJsonContent(jsonString: string) {
  try {
    const jsonContent = jsonString.trim();
    const parsedJson = JSON.parse(jsonContent) as N8nWorkflow;
    return { success: true, data: parsedJson };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function convertToJsonOutput(assignments: Assignment[]): string {
  try {
    const jsonObject: Record<string, any> = {};
    
    assignments.forEach(assignment => {
      let value = assignment.value;
      
      // Handle different value types
      if (typeof value === "string") {
        if (value.startsWith("=")) {
          // Remove the "=" prefix for expressions
          value = value.slice(1);
        } else if (assignment.type === "boolean") {
          // Convert string boolean to actual boolean if it's not an expression
          if (!value.includes("{{")) {
            value = value.toLowerCase() === "true";
          }
        } else if (assignment.type === "number") {
          // Convert string number to actual number if it's not an expression
          if (!value.includes("{{")) {
            value = Number(value);
          }
        }
      }
      
      // Handle JSON strings that need to be parsed
      if (typeof value === "string" && value.startsWith("{") && value.endsWith("}") && !value.includes("{{")) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If it can't be parsed as JSON, keep it as a string
          console.debug("Could not parse value as JSON:", value);
        }
      }
      
      jsonObject[assignment.name] = value;
    });
    
    // Format the JSON with newlines and proper indentation, then prefix with "="
    return "=" + JSON.stringify(jsonObject, null, 2);
  } catch (error) {
    console.error("Error converting to JSON:", error);
    throw new Error(`Failed to convert to JSON: ${(error as Error).message}`);
  }
}

export default function Command() {
  const [jsonInput, setJsonInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkClipboard() {
      try {
        const clipboardText = await Clipboard.readText();
        if (clipboardText) {
          try {
            // Try to parse as JSON to validate
            JSON.parse(clipboardText);
            // If parsing succeeds, set the input
            setJsonInput(clipboardText);
          } catch (e) {
            // Not valid JSON, ignore silently
            console.debug("Clipboard content is not valid JSON");
          }
        }
      } catch (error) {
        console.error("Error reading clipboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkClipboard();
  }, []);

  const handleSubmit = async () => {
    try {
      if (!jsonInput.trim()) {
        throw new Error("Please enter JSON input");
      }

      // Parse the input JSON
      const parseResult = parseJsonContent(jsonInput);
      if (!parseResult.success) {
        throw new Error(`Invalid JSON input: ${parseResult.error}`);
      }

      const nodeData = parseResult.data;
      if (!nodeData?.nodes || !Array.isArray(nodeData.nodes)) {
        throw new Error("Invalid node data: 'nodes' array is required");
      }

      // Check if there are any Set nodes to convert
      const setNodes = nodeData.nodes.filter(
        (node: N8nNode) => node.type === "n8n-nodes-base.set" && node.parameters?.assignments?.assignments
      );

      if (setNodes.length === 0) {
        throw new Error("No Set nodes with Manual Mapping found in the workflow");
      }

      // Process each node
      const newNodes = nodeData.nodes.map((node: N8nNode) => {
        if (node.type === "n8n-nodes-base.set" && node.parameters?.assignments?.assignments) {
          const jsonOutput = convertToJsonOutput(node.parameters.assignments.assignments);
          
          return {
            ...node,
            parameters: {
              ...node.parameters,
              mode: "raw",
              jsonOutput,
              assignments: undefined
            }
          };
        }
        return node;
      });

      // Create the output JSON
      const outputJson = {
        ...nodeData,
        nodes: newNodes
      };

      // Copy to clipboard
      const formattedJson = JSON.stringify(outputJson, null, 2);
      await Clipboard.copy(formattedJson);
      
      await showToast({
        style: Toast.Style.Success,
        title: `Successfully converted ${setNodes.length} Set node${setNodes.length > 1 ? 's' : ''}`,
        message: "The converted JSON has been copied to your clipboard"
      });

      await popToRoot();
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      const errorMsg = (error as Error).message;
      setErrorMessage(errorMsg);
      await showToast({
        style: Toast.Style.Failure,
        title: "Conversion failed",
        message: errorMsg
      });
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert to JSON" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="json"
        title="Node JSON"
        placeholder="Paste your node JSON with Manual Mapping here..."
        value={jsonInput}
        onChange={(newValue) => {
          setJsonInput(newValue);
          setErrorMessage(undefined); // Clear error when input changes
        }}
        error={errorMessage}
      />
    </Form>
  );
} 