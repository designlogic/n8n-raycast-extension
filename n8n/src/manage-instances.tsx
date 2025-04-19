import {
  List,
  ActionPanel,
  Action,
  Icon,
  Form,
  showToast,
  Toast,
  useNavigation,
  getPreferenceValues,
  LocalStorage
} from "@raycast/api";
import { useState, useEffect } from "react";
import { N8nInstance } from "./types";
import { generateInstanceId } from "./utils";

const STORAGE_KEY = "n8n_instances";

interface StoredInstance extends N8nInstance {
  id: string;
}

function AddInstanceForm() {
  const { pop } = useNavigation();

  async function handleSubmit(values: { name: string; baseUrl: string; apiKey: string; color: string }) {
    try {
      const instance: StoredInstance = {
        id: generateInstanceId(values.baseUrl),
        name: values.name,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey.trim(),
        color: values.color || "#FF6B6B"
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
    }
  }

  return (
    <Form
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
      <Form.TextField
        id="color"
        title="Color (optional)"
        placeholder="#FF0000"
      />
    </Form>
  );
}

function EditInstanceForm({ instance }: { instance: StoredInstance }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { name: string; baseUrl: string; apiKey: string; color: string }) {
    try {
      const updatedInstance: StoredInstance = {
        ...instance,
        name: values.name,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey.trim(),
        color: values.color || instance.color
      };

      // Get existing instances
      const existingInstances = await LocalStorage.getItem<string>(STORAGE_KEY);
      const instances: StoredInstance[] = existingInstances ? JSON.parse(existingInstances) : [];
      
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
    }
  }

  return (
    <Form
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
      <Form.TextField
        id="color"
        title="Color (optional)"
        defaultValue={instance.color}
      />
    </Form>
  );
}

export default function Command() {
  const [instances, setInstances] = useState<StoredInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  useEffect(() => {
    async function loadInstances() {
      try {
        const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
        if (stored) {
          setInstances(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Error loading instances:", error);
      }
      setIsLoading(false);
    }

    loadInstances();
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
          icon={{ source: Icon.Circle, tintColor: instance.color }}
          actions={
            <ActionPanel>
              <Action
                title="Edit Instance"
                icon={Icon.Pencil}
                onAction={() => push(<EditInstanceForm instance={instance} />)}
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
