import { ActionPanel, Action, Icon, List, Cache, showToast, Toast, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { WorkflowItem, Preferences, WorkflowResponse, N8nInstance } from "./types";
import { CACHE_KEY, getApiEndpoints } from "./config";
import { sortAlphabetically, formatWorkflowData, filterItems, generateInstanceId } from "./utils";
import { LocalStorage } from "@raycast/api";
import { getInstanceStatus, getStatusIcon } from "./utils/instanceStatus";

const STORAGE_KEY = "n8n_instances";

interface StoredInstance extends N8nInstance {
  id: string;
}

interface InstanceStatus {
  isActive: boolean;
  error?: string;
}

export default function Command() {
  // State
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [instances, setInstances] = useState<StoredInstance[]>([]);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, InstanceStatus>>({});

  const cache = new Cache();

  // Get unique tags from workflow items
  const availableTags = [...new Set(items.flatMap(item => item.keywords))].sort();
  
  // Get unique instances ensuring no duplicates
  const uniqueInstances = Array.from(
    new Map(
      items.map(item => [
        item.instanceId,
        {
          id: item.instanceId,
          name: item.instanceName,
          color: item.instanceColor,
          status: instanceStatuses[item.instanceId]
        }
      ])
    ).values()
  );

  // API Functions
  const fetchWorkflowsForInstance = async (instance: StoredInstance) => {
    let allWorkflows: WorkflowResponse['data'] = [];
    let cursor: string | undefined;
    const limit = 250;
    const API_ENDPOINTS = getApiEndpoints(instance);

    do {
      const url = cursor
        ? `${API_ENDPOINTS.workflows}?limit=${limit}&cursor=${cursor}`
        : `${API_ENDPOINTS.workflows}?limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          "X-N8N-API-KEY": instance.apiKey,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401 
            ? `Invalid API key for instance ${instance.name}` 
            : `Failed to fetch workflows from ${instance.name}: ${response.statusText}`
        );
      }

      const data = await response.json() as { data: WorkflowResponse['data']; nextCursor?: string };
      allWorkflows = [...allWorkflows, ...(data.data || [])];
      cursor = data.nextCursor;

    } while (cursor);

    return allWorkflows;
  };

  // Data Management Functions
  const updateWorkflowData = async (workflows: WorkflowItem[]) => {
    await cache.set(CACHE_KEY, JSON.stringify(workflows));
    setItems(workflows);
  };

  const fetchData = async (forceFresh = false) => {
    setIsLoading(!items.length);
    console.log("🔄 Fetching fresh data from all instances...");
    
    try {
      const allWorkflows: WorkflowItem[] = [];
      const errors: string[] = [];
      const newStatuses: Record<string, InstanceStatus> = {};

      for (const instance of instances) {
        try {
          const status = await getInstanceStatus(instance.id);
          newStatuses[instance.id] = {
            isActive: status?.isActive || false,
            error: status?.error
          };

          if (status?.isActive) {
            const workflows = await fetchWorkflowsForInstance(instance);
            const formattedWorkflows = workflows.map(workflow => formatWorkflowData(workflow, instance));
            allWorkflows.push(...formattedWorkflows);
          }
        } catch (error) {
          errors.push(`${instance.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
          newStatuses[instance.id] = { isActive: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      }

      setInstanceStatuses(newStatuses);

      if (allWorkflows.length > 0) {
        const sortedWorkflows = sortAlphabetically(allWorkflows);
        await updateWorkflowData(sortedWorkflows);
        
        if (forceFresh) {
          await showToast({
            style: Toast.Style.Success,
            title: "Workflows Refreshed",
            message: `Found ${sortedWorkflows.length} workflows across ${instances.length} instances`
          });
        }
      }

      if (errors.length > 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Some instances failed to load",
          message: errors.join("\n")
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Event Handlers
  const handleTagChange = (newTag: string | null) => {
    setSelectedTag(newTag);
  };

  const handleInstanceChange = (newInstance: string | null) => {
    setSelectedInstance(newInstance);
  };

  // Load Instances
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
    }
    loadInstances();
  }, []);

  // Initial Load
  useEffect(() => {
    async function loadInitialData() {
      if (instances.length === 0) {
        setIsLoading(false);
        return;
      }

      const cachedData = await cache.get(CACHE_KEY);
      
      if (cachedData) {
        console.log("📖 Loading data from cache");
        const parsedData = JSON.parse(cachedData);
        const sortedData = sortAlphabetically(parsedData);
        setItems(sortedData);
        setIsLoading(false);
      } else {
        console.log("❌ No cache found, fetching fresh data");
        await fetchData(true);
      }
    }
    loadInitialData();
  }, [instances]);

  if (instances.length === 0) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="No n8n instances configured"
          description="Use the 'Manage n8n Instances' command to add your first instance"
          actions={
            <ActionPanel>
              <Action.Open
                title="Configure Instances"
                target="raycast://extensions/designlogicsolutions/n8n/manage-instances"
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      searchBarPlaceholder="Search workflows by name, tags, or instance..."
      isLoading={isLoading}
      filtering={true}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Instance"
          value={selectedInstance || ""}
          onChange={handleInstanceChange}
        >
          <List.Dropdown.Item title="All Instances" value="" />
          {uniqueInstances.map((instance) => (
            <List.Dropdown.Item
              key={instance.id}
              title={`${instance.name} ${getStatusIcon(instance.status)}`}
              value={instance.id}
              icon={{ source: Icon.Circle, tintColor: instance.color as Color }}
            />
          ))}
        </List.Dropdown>
      }
    >
      <List.Section title="Tags" subtitle={selectedTag || "All"}>
        {!selectedTag && (
          <List.Item
            title="All Tags"
            icon={Icon.Tag}
            actions={
              <ActionPanel>
                <Action
                  title="Refresh All Workflows"
                  icon={Icon.RotateClockwise}
                  onAction={() => fetchData(true)}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        )}
        {availableTags.map((tag) => (
          <List.Item
            key={tag}
            title={tag}
            icon={Icon.Tag}
            actions={
              <ActionPanel>
                <Action
                  title={selectedTag === tag ? "Clear Tag Filter" : "Filter by Tag"}
                  onAction={() => handleTagChange(selectedTag === tag ? null : tag)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Workflows" subtitle={items.length.toString()}>
        {filterItems(items, "", selectedTag, selectedInstance).map((item) => (
          <List.Item
            key={`${item.instanceId}-${item.id}`}
            icon={{ source: Icon.Circle, tintColor: item.instanceColor as Color }}
            title={item.title}
            subtitle={item.subtitle}
            accessories={[
              { icon: Icon.Hashtag, text: item.accessory },
              { text: `${item.instanceName} ${getStatusIcon(instanceStatuses[item.instanceId])}` }
            ]}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser 
                  url={getApiEndpoints({ 
                    id: item.instanceId,
                    name: item.instanceName,
                    baseUrl: instances.find(i => i.id === item.instanceId)?.baseUrl || "",
                    apiKey: "" 
                  }).workflowUrl(item.id)} 
                />
                <Action.CopyToClipboard
                  title="Copy Workflow URL"
                  content={getApiEndpoints({
                    id: item.instanceId,
                    name: item.instanceName,
                    baseUrl: instances.find(i => i.id === item.instanceId)?.baseUrl || "",
                    apiKey: ""
                  }).workflowUrl(item.id)}
                />
                <Action
                  title="Refresh Workflows"
                  icon={Icon.RotateClockwise}
                  onAction={() => fetchData(true)}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
