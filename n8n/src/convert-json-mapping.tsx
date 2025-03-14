import { showToast, Toast, Form, ActionPanel, Action, popToRoot, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';

interface ConvertJsonMappingArguments {
  json?: string;
}

interface N8nNode {
  parameters: {
    mode?: string;
    jsonOutput?: string;
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

interface ConversionSuccess {
  success: true;
  data: {
    assignments: {
      assignments: Assignment[];
    };
  };
}

interface ConversionError {
  success: false;
  error: string;
}

type ConversionResult = ConversionSuccess | ConversionError;

function parseJsonContent(jsonString: string) {
  try {
    const jsonContent = jsonString.trim();
    const parsedJson = JSON.parse(jsonContent) as N8nWorkflow;
    return { success: true, data: parsedJson };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function convertToManualMapping(jsonOutput: string): ConversionResult {
  try {
    // Remove the "=" prefix if it exists and clean up the JSON string
    let cleanJson = jsonOutput.startsWith("=") ? jsonOutput.slice(1) : jsonOutput;
    
    console.log("Original JSON input:", jsonOutput);
    
    // First, try to parse the raw JSON
    try {
      const parsedJson = JSON.parse(cleanJson);
      console.log("Successfully parsed JSON on first attempt");
      return processJsonObject(parsedJson);
    } catch (initialError) {
      console.log("First parsing attempt failed:", initialError);
      
      // Pre-process the JSON to handle expressions and formatting
      cleanJson = cleanJson
        // Remove extra whitespace and newlines first
        .replace(/\n/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        // Handle boolean expressions first (more specific)
        .replace(/:\s*({{\s*[^}]+}})/g, (match, expr) => {
          // If the expression contains comparison operators or functions, treat as boolean expression
          if (expr.match(/[<>!=]|\.|indexOf|toLowerCase/)) {
            return ': "=' + expr.trim().replace(/"/g, '\\"') + '"';
          }
          return ': "=' + expr.trim() + '"';
        })
        // Fix any remaining formatting issues
        .replace(/,\s+/g, ', ')
        .replace(/:\s+/g, ': ')
        .replace(/{\s+/g, '{')
        .replace(/\s+}/g, '}');
      
      console.log("Cleaned JSON (step 2):", cleanJson);
      
      try {
        const parsedJson = JSON.parse(cleanJson);
        console.log("Successfully parsed JSON on second attempt");
        return processJsonObject(parsedJson);
      } catch (error) {
        console.log("Second parsing attempt failed:", error);
        throw new Error(`Could not parse JSON: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    console.error("Error in convertToManualMapping:", error);
    return { 
      success: false, 
      error: `Failed to convert JSON: ${(error as Error).message}. Please check your JSON format.`
    };
  }
}

function processJsonObject(parsedJson: any): ConversionSuccess {
  const assignments = Object.entries(parsedJson).map(([key, value]) => {
    let finalValue = value;
    let type = "string";

    if (typeof value === "string") {
      // Handle expressions
      if (value.startsWith("={{") || value.startsWith("=\"={{")) {
        // Remove extra quotes and = if they exist
        finalValue = value.replace(/^="={{/, "={{").replace(/^={{/, "={{");
        
        // Determine if it's a boolean expression
        if (value.match(/[<>!=]|\.|indexOf|toLowerCase/)) {
          type = "boolean";
        }
      } else if (value.startsWith("{{")) {
        finalValue = "=" + value;
      }
    } else if (typeof value === "boolean") {
      type = "boolean";
    } else if (typeof value === "number") {
      type = "number";
    } else if (typeof value === "object" && value !== null) {
      finalValue = JSON.stringify(value);
    }

    return {
      id: uuidv4(),
      name: key.trim(),
      value: finalValue,
      type: type
    };
  });

  return {
    success: true,
    data: {
      assignments: {
        assignments
      }
    }
  };
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
        (node: N8nNode) => node.type === "n8n-nodes-base.set" && node.parameters?.mode === "raw" && node.parameters?.jsonOutput
      );

      if (setNodes.length === 0) {
        throw new Error("No Set nodes with JSON output found in the workflow");
      }

      // Process each node
      const newNodes = nodeData.nodes.map((node: N8nNode) => {
        if (node.type === "n8n-nodes-base.set" && node.parameters?.mode === "raw" && node.parameters?.jsonOutput) {
          const conversionResult = convertToManualMapping(node.parameters.jsonOutput);
          if (!conversionResult.success) {
            throw new Error(`Failed to convert JSON output in node "${node.name}": ${conversionResult.error}`);
          }

          return {
            ...node,
            parameters: {
              ...node.parameters,
              ...conversionResult.data,
              mode: undefined,
              jsonOutput: undefined
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
          <Action.SubmitForm title="Convert" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="json"
        title="Node JSON"
        placeholder="Paste your node JSON here..."
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