import { Form, ActionPanel, Action, Icon, useNavigation, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { testConnection } from "../utils/connection";
import { StoredInstance } from "../types";

interface InstanceFormProps {
  instance?: StoredInstance;
  onSubmit: (values: { name: string; baseUrl: string; apiKey: string; color: string }) => Promise<void>;
  title: string;
}

export function InstanceForm({ instance, onSubmit, title }: InstanceFormProps) {
  const { push } = useNavigation();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [color, setColor] = useState(instance?.color || "#FF6B6B");

  async function handleTest(values: { name: string; baseUrl: string; apiKey: string; color: string }) {
    setIsLoading(true);
    const result = await testConnection(values.baseUrl, values.apiKey);
    setTestResult(result);
    setIsLoading(false);

    await showToast({
      style: result.success ? Toast.Style.Success : Toast.Style.Failure,
      title: result.success ? "Connection Test Successful" : "Connection Test Failed",
      message: result.message
    });
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm 
            onSubmit={(values) => onSubmit({ ...values, color })} 
          />
          <Action
            title="Pick Color"
            icon={Icon.Swatch}
            onAction={() => {
              push(
                <ColorPicker
                  defaultColor={color}
                  onColorSelect={(newColor) => {
                    setColor(newColor);
                    push(<InstanceForm instance={instance} onSubmit={onSubmit} title={title} />);
                  }}
                />
              );
            }}
          />
          <Action
            title="Test Connection"
            icon={Icon.Network}
            onAction={(e) => {
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              handleTest({
                name: formData.get("name") as string,
                baseUrl: formData.get("baseUrl") as string,
                apiKey: formData.get("apiKey") as string,
                color: color
              });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Instance Name"
        placeholder="Production"
        defaultValue={instance?.name}
        required
      />
      <Form.TextField
        id="baseUrl"
        title="Base URL"
        placeholder="https://n8n.example.com"
        defaultValue={instance?.baseUrl}
        required
      />
      <Form.PasswordField
        id="apiKey"
        title="API Key"
        placeholder="Enter your n8n API key"
        defaultValue={instance?.apiKey}
        required
      />
      <Form.Description
        title="Instance Color"
        text={`Current color: ${color}`}
      />
      <Form.Description
        title="💡 Tip"
        text="Use the 'Pick Color' action in the top right to select a color"
      />
      {testResult && (
        <Form.Description
          title={testResult.success ? "Connection Status: Success" : "Connection Status: Failed"}
          text={testResult.message}
        />
      )}
    </Form>
  );
}
