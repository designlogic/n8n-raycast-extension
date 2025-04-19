import { List, Form } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api";
import { Preferences, N8nInstance } from "../types";
import { generateInstanceId } from "../utils";

interface InstanceSelectorProps {
  onInstanceSelect: (instance: N8nInstance) => void;
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
  const preferences = getPreferenceValues<Preferences>();
  const instances = preferences.instances.map(instance => ({
    ...instance,
    id: generateInstanceId(instance.baseUrl)
  }));

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
          title={instance.name}
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
  const preferences = getPreferenceValues<Preferences>();
  const instances = preferences.instances.map(instance => ({
    ...instance,
    id: generateInstanceId(instance.baseUrl)
  }));

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
          title={instance.name}
          value={instance.id}
        />
      ))}
    </List.Dropdown>
  );
}
