import { List, Form, Icon, Color } from "@raycast/api";
import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { N8nInstance } from "../types";
import { generateInstanceId } from "../utils";
import { useState, useEffect } from "react";
import { getStatusIcon, getInstanceStatus } from "../utils/instanceStatus";

const STORAGE_KEY = "n8n_instances";

interface StoredInstance extends N8nInstance {
  id: string;
}

interface InstanceSelectorProps {
  onInstanceSelect: (instance: StoredInstance) => void;
  selectedInstanceId?: string;
  dropdownTitle?: string;
  dropdownPlaceholder?: string;
}

export function InstanceSelector({ 
  onInstanceSelect, 
  selectedInstanceId,
  dropdownTitle = "n8n Instance",
  dropdownPlaceholder = "Select n8n instance"
}: InstanceSelectorProps) {
  const [instances, setInstances] = useState<StoredInstance[]>([]);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, { isActive: boolean; error?: string }>>({});

  useEffect(() => {
    async function loadInstances() {
      try {
        const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
        if (stored) {
          const loadedInstances = JSON.parse(stored);
          setInstances(loadedInstances);

          // Load instance statuses
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
    }
    loadInstances();
  }, []);

  if (instances.length === 0) {
    return (
      <Form.Description
        title="No Instances Configured"
        text="Use the 'Manage n8n Instances' command to add your first instance"
      />
    );
  }

  return (
    <Form.Dropdown
      id="instance"
      title={dropdownTitle}
      placeholder={dropdownPlaceholder}
      value={selectedInstanceId || (instances.length === 1 ? instances[0].id : undefined)}
      onChange={(newInstanceId) => {
        const selectedInstance = instances.find(i => i.id === newInstanceId);
        if (selectedInstance) {
          onInstanceSelect(selectedInstance);
        }
      }}
    >
      {instances.map(instance => (
        <Form.Dropdown.Item
          key={instance.id}
          value={instance.id}
          title={`${instance.name} ${getStatusIcon(instanceStatuses[instance.id])}`}
          icon={{ source: Icon.Circle, tintColor: instance.color as Color }}
        />
      ))}
    </Form.Dropdown>
  );
}

export function InstanceListDropdown({ 
  onInstanceSelect, 
  selectedInstanceId,
  tooltip = "Filter by Instance"
}: {
  onInstanceSelect: (instanceId: string | null) => void;
  selectedInstanceId?: string;
  tooltip?: string;
}) {
  const [instances, setInstances] = useState<StoredInstance[]>([]);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, { isActive: boolean; error?: string }>>({});

  useEffect(() => {
    async function loadInstances() {
      try {
        const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
        if (stored) {
          const loadedInstances = JSON.parse(stored);
          setInstances(loadedInstances);

          // Load instance statuses
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
    }
    loadInstances();
  }, []);

  return (
    <List.Dropdown
      tooltip={tooltip}
      value={selectedInstanceId || ""}
      onChange={onInstanceSelect}
    >
      <List.Dropdown.Item title="All Instances" value="" />
      {instances.map((instance) => (
        <List.Dropdown.Item
          key={instance.id}
          title={`${instance.name} ${getStatusIcon(instanceStatuses[instance.id])}`}
          value={instance.id}
          icon={{ source: Icon.Circle, tintColor: instance.color as Color }}
        />
      ))}
    </List.Dropdown>
  );
}
