import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  useNavigation,
  LocalStorage,
  Color,
  Form,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { StoredInstance } from "./types";
import { generateInstanceId } from "./utils";
import { testConnection } from "./utils/connection";
import { ColorPickerField } from "./components/ColorPicker";
import { getInstanceStatus, updateInstanceStatus, getStatusIcon, startStatusAutoRefresh } from "./utils/instanceStatus";

const STORAGE_KEY = "n8n_instances";

function AddInstanceForm() {
  const { pop } = useNavigation();
  const [color, setColor] = useState("#FF6B6B");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsLoading(true);
      const instance: StoredInstance = {
        id: generateInstanceId(values.baseUrl),
        name: values.name,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey.trim(),
        color: values.color
      };

      // Get existing instances
      const existingInstances = await LocalStorage.getItem<string>(STORAGE_KEY);
      const instances: StoredInstance[] = existingInstances ? JSON.parse(existingInstances) : [];
      
      // Check for duplicate baseUrl
      if (instances.some(i => i.baseUrl === instance.baseUrl)) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Instance already exists",
          message: "An instance with this URL already exists"
        });
        return;
      }

      // Test connection before saving
      const status = await updateInstanceStatus(instance.id, instance.baseUrl, instance.apiKey);
      if (!status.isActive) {
        const shouldProceed = await showToast({
          style: Toast.Style.Failure,
          title: "Connection Test Failed",
          message: `${status.error}\nDo you want to add the instance anyway?`,
          primaryAction: {
            title: "Add Anyway",
            onAction: async () => {
              instances.push(instance);
              await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
              await showToast({
                style: Toast.Style.Success,
                title: "Instance added",
                message: `Added ${instance.name} (with warnings)`
              });
              pop();
            },
          },
          secondaryAction: {
            title: "Cancel",
            onAction: () => { }
          },
        });
        return;
      }

      // Add new instance
      instances.push(instance);
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(instances));

      await showToast({
        style: Toast.Style.Success,
        title: "Instance added",
        message: `Added ${instance.name}`
      });

      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to add instance",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Instance Name"
        placeholder="Production"
        required
      />
      <Form.TextField
        id="baseUrl"
        title="Base URL"
        placeholder="https://n8n.example.com"
        required
      />
      <Form.PasswordField
        id="apiKey"
        title="API Key"
        placeholder="Enter your n8n API key"
        required
      />
      <ColorPickerField
        defaultColor={color}
        onChange={setColor}
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

interface FormValues {
  name: string;
  baseUrl: string;
  apiKey: string;
  color: string;
}

function EditInstanceForm({ instance }: { instance: StoredInstance }) {
  const { pop } = useNavigation();
  const [color, setColor] = useState(instance.color || "#FF6B6B");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsLoading(true);
      const updatedInstance: StoredInstance = {
        ...instance,
        name: values.name,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey.trim(),
        color: values.color
      };

      // Get existing instances
      const existingInstances = await LocalStorage.getItem<string>(STORAGE_KEY);
      const instances: StoredInstance[] = existingInstances ? JSON.parse(existingInstances) : [];
      
      // Test connection before saving
      const status = await updateInstanceStatus(instance.id, updatedInstance.baseUrl, updatedInstance.apiKey);
      if (!status.isActive) {
        const shouldProceed = await showToast({
          style: Toast.Style.Failure,
          title: "Connection Test Failed",
          message: `${status.error}\nDo you want to save the changes anyway?`,
          primaryAction: {
            title: "Save Anyway",
            onAction: async () => {
              const index = instances.findIndex(i => i.id === instance.id);
              if (index !== -1) {
                instances[index] = updatedInstance;
                await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
                await showToast({
                  style: Toast.Style.Success,
                  title: "Instance updated",
                  message: `Updated ${updatedInstance.name} (with warnings)`
                });
                pop();
              }
            },
          },
          secondaryAction: {
            title: "Cancel",
            onAction: () => { }
          },
        });
        return;
      }

      // Update instance
      const index = instances.findIndex(i => i.id === instance.id);
      if (index !== -1) {
        instances[index] = updatedInstance;
        await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(instances));

        await showToast({
          style: Toast.Style.Success,
          title: "Instance updated",
          message: `Updated ${updatedInstance.name}`
        });

        pop();
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to update instance",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Instance Name"
        defaultValue={instance.name}
        required
      />
      <Form.TextField
        id="baseUrl"
        title="Base URL"
        defaultValue={instance.baseUrl}
        required
      />
      <Form.PasswordField
        id="apiKey"
        title="API Key"
        defaultValue={instance.apiKey}
        required
      />
      <ColorPickerField
        defaultColor={color}
        onChange={setColor}
      />
    </Form>
  );
}

export default function Command() {
  const [instances, setInstances] = useState<StoredInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, { isActive: boolean; error?: string }>>({});
  const { push } = useNavigation();

  useEffect(() => {
    async function loadInstances() {
      try {
        const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
        if (stored) {
          const loadedInstances = JSON.parse(stored);
          setInstances(loadedInstances);
          
          // Load initial statuses
          const statuses: Record<string, { isActive: boolean; error?: string }> = {};
          for (const instance of loadedInstances) {
            const status = await getInstanceStatus(instance.id);
            if (status) {
              statuses[instance.id] = { isActive: status.isActive, error: status.error };
            }
          }
          setInstanceStatuses(statuses);
        }
      } catch (error) {
        console.error("Error loading instances:", error);
      }
      setIsLoading(false);
    }

    loadInstances();

    // Start auto-refresh of statuses
    const cleanup = startStatusAutoRefresh(instances);
    return cleanup;
  }, []);

  async function handleDelete(instance: StoredInstance) {
    try {
      const newInstances = instances.filter(i => i.id !== instance.id);
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(newInstances));
      setInstances(newInstances);

      await showToast({
        style: Toast.Style.Success,
        title: "Instance removed",
        message: `Removed ${instance.name}`
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to remove instance",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  async function handleRefreshStatus(instance: StoredInstance) {
    const status = await updateInstanceStatus(instance.id, instance.baseUrl, instance.apiKey);
    setInstanceStatuses(prev => ({
      ...prev,
      [instance.id]: { isActive: status.isActive, error: status.error }
    }));

    await showToast({
      style: status.isActive ? Toast.Style.Success : Toast.Style.Failure,
      title: status.isActive ? "Instance is Active" : "Instance Error",
      message: status.error || "Connection successful"
    });
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search instances..."
      actions={
        <ActionPanel>
          <Action
            title="Add Instance"
            icon={Icon.Plus}
            onAction={() => push(<AddInstanceForm />)}
          />
        </ActionPanel>
      }
    >
      {instances.map((instance) => (
        <List.Item
          key={instance.id}
          title={instance.name}
          subtitle={instance.baseUrl}
          icon={{ source: Icon.Circle, tintColor: instance.color as Color }}
          accessories={[
            {
              text: getStatusIcon(instanceStatuses[instance.id] || null),
              tooltip: instanceStatuses[instance.id]?.error || "Status unknown"
            }
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Edit Instance"
                icon={Icon.Pencil}
                onAction={() => push(<EditInstanceForm instance={instance} />)}
              />
              <Action
                title="Refresh Status"
                icon={Icon.ArrowClockwise}
                onAction={() => handleRefreshStatus(instance)}
              />
              <Action
                title="Delete Instance"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={() => handleDelete(instance)}
              />
              <Action
                title="Add New Instance"
                icon={Icon.Plus}
                onAction={() => push(<AddInstanceForm />)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
