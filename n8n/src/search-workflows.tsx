import { ActionPanel, Action, Icon, List, Cache, showToast, Toast, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { WorkflowItem, Preferences, WorkflowResponse, N8nInstance } from "./types";
import { CACHE_KEY, getApiEndpoints } from "./config";
import { sortAlphabetically, formatWorkflowData, filterItems, generateInstanceId } from "./utils";
import { LocalStorage } from "@raycast/api";
import { getInstanceStatus, getStatusIcon, updateAllInstanceStatuses, startStatusAutoRefresh } from "./utils/instanceStatus";

// Custom function to get status icon - wrapper around the imported getStatusIcon
function getInstanceStatusIcon(status: InstanceStatus | undefined | null, instanceId: string): string {
  if (!status) return "❓"; // Unknown status
  if (status.isLoading) return "⏳"; // Loading
  return status.isActive ? "🟢" : "🔴"; // Active or Inactive
}

const STORAGE_KEY = "n8n_instances";

interface StoredInstance extends N8nInstance {
  id: string;
}

interface InstanceStatus {
  isActive: boolean;
  error?: string;
  isLoading?: boolean;
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
    // Set the initial hasTrigger value to undefined for all workflows
    // We'll populate this as we check each workflow
    const workflowsWithTriggerStatus = workflows.map(workflow => ({
      ...workflow,
      hasTrigger: undefined
    }));
    
    await cache.set(CACHE_KEY, JSON.stringify(workflowsWithTriggerStatus));
    setItems(workflowsWithTriggerStatus);
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
  // Toggle workflow active status
  // Helper function to check if a workflow has trigger nodes
  const checkForTriggerNodes = (workflowNodes: any[]): boolean => {
    return workflowNodes?.some(
      (node: any) => node.type?.startsWith('n8n-nodes-base.trigger') || 
                     node.type?.includes('webhook') ||
                     node.type?.includes('trigger')
    ) || false;
  };

  // Update workflow trigger status in local state
  const updateWorkflowTriggerStatus = (workflowId: string, instanceId: string, hasTrigger: boolean): void => {
    setItems(prevItems => 
      prevItems.map(item => {
        if (item.id === workflowId && item.instanceId === instanceId) {
          return {
            ...item,
            hasTrigger
          };
        }
        return item;
      })
    );
  };

  // Toggle workflow active status
  const toggleWorkflowStatus = async (workflow: WorkflowItem) => {
    try {
      const instance = instances.find(i => i.id === workflow.instanceId);
      if (!instance) {
        throw new Error(`Instance ${workflow.instanceId} not found`);
      }

      await showToast({
        style: Toast.Style.Animated,
        title: `${workflow.active ? "Deactivating" : "Activating"} workflow`,
      });
      
      const API_ENDPOINTS = getApiEndpoints(instance);
      
      // Check if we're trying to activate and need to verify trigger nodes
      if (!workflow.active) {
        // First, fetch the workflow to check if it can be activated
        const workflowDetailsResponse = await fetch(`${API_ENDPOINTS.workflows}/${workflow.id}`, {
          method: 'GET',
          headers: {
            "X-N8N-API-KEY": instance.apiKey,
            "Accept": "application/json"
          }
        });
        
        if (!workflowDetailsResponse.ok) {
          throw new Error(`Failed to get workflow details: ${workflowDetailsResponse.statusText}`);
        }
        
        const workflowDetails = await workflowDetailsResponse.json();
        
        // Check if workflow has a trigger node (required for activation)
        const hasTriggerNode = checkForTriggerNodes(workflowDetails?.nodes || []);
        
        // Update the workflow's trigger status in our local state
        updateWorkflowTriggerStatus(workflow.id, workflow.instanceId, hasTriggerNode);
        
        if (!hasTriggerNode) {
          throw new Error('This workflow cannot be activated because it does not have a trigger node. Add a trigger node like "Webhook" or "Cron" to make it activatable.');
        }
      }
      // Use the correct endpoint based on whether we want to activate or deactivate
      const activationEndpoint = workflow.active ? 'deactivate' : 'activate';
      const response = await fetch(`${API_ENDPOINTS.workflows}/${workflow.id}/${activationEndpoint}`, {
        method: 'POST',
        headers: {
          "X-N8N-API-KEY": instance.apiKey,
          "Accept": "application/json"
        }
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorText = await response.text();
        let errorMessage = response.statusText;
        
        try {
          // Try to parse the error response as JSON
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          // If not valid JSON, use text as is
          errorMessage = errorText || errorMessage;
        }
        
        if (response.status === 400) {
          // For 400 Bad Request, provide a more user-friendly message
          if (errorMessage.includes('trigger') || !hasTriggerNode) {
            throw new Error('This workflow cannot be activated because it does not have a trigger node or its trigger node is not properly configured.');
          }
        }
        
        throw new Error(`Failed to ${workflow.active ? "deactivate" : "activate"} workflow: ${errorMessage}`);
      }

      // Update local state
      const updatedItems = items.map(item => {
        if (item.id === workflow.id && item.instanceId === workflow.instanceId) {
          return {
            ...item,
            active: !item.active,
            subtitle: `${item.instanceName} ${!item.active ? "• Active" : "• Inactive"}`,
          };
        }
        return item;
      });

      setItems(updatedItems);
      await cache.set(CACHE_KEY, JSON.stringify(updatedItems));

      await showToast({
        style: Toast.Style.Success,
        title: `Workflow ${!workflow.active ? "activated" : "deactivated"}`,
        message: workflow.title
      });

    } catch (error) {
      console.error("Error toggling workflow status:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Check for specific error cases to provide better guidance
      if (errorMessage.includes('trigger node')) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Cannot Activate Workflow",
          message: "This workflow needs a trigger node. Open the workflow in n8n and add a Webhook or Cron node."
        });
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to ${workflow.active ? "deactivate" : "activate"} workflow`,
          message: errorMessage
        });
      }
    }
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
  
  // Update instance statuses when instances change
  useEffect(() => {
    async function updateStatuses() {
      if (instances.length === 0) return;
      
      console.log("Updating instance statuses...");
      
      // Set loading state for each instance
      const loadingStatuses: Record<string, InstanceStatus> = {};
      for (const instance of instances) {
        loadingStatuses[instance.id] = {
          ...(instanceStatuses[instance.id] || { isActive: false }),
          isLoading: true
        };
        console.log(`Setting loading state for ${instance.name} (${instance.id})`);
      }
      setInstanceStatuses(loadingStatuses);
      
      try {
        // First, try to get cached statuses for immediate display
        for (const instance of instances) {
          try {
            const cachedStatus = await getInstanceStatus(instance.id);
            if (cachedStatus) {
              console.log(`Loaded cached status for ${instance.name}: ${cachedStatus.isActive ? 'active' : 'inactive'}`);
              setInstanceStatuses(prev => ({
                ...prev,
                [instance.id]: {
                  isActive: cachedStatus.isActive,
                  error: cachedStatus.error,
                  isLoading: true // Still loading fresh status
                }
              }));
            }
          } catch (err) {
            console.log(`No cached status for ${instance.name}`);
          }
        }
        
        // Now update all instance statuses in the background
        console.log("Checking current status of all instances...");
        try {
          await updateAllInstanceStatuses(instances);
          console.log("All instance statuses updated successfully");
          
          // Force immediate refresh of the list to show updated status icons
          setItems(prevItems => [...prevItems]);
        } catch (updateError) {
          console.error("Error updating instance statuses:", updateError);
        }
        
        // Load the updated statuses into state
        const newStatuses: Record<string, InstanceStatus> = {};
        for (const instance of instances) {
          try {
            const status = await getInstanceStatus(instance.id);
            console.log(`Status for ${instance.name}: `, status);
            
            if (status) {
              newStatuses[instance.id] = {
                isActive: status.isActive,
                error: status.error,
                isLoading: false
              };
            } else {
              console.log(`No status found for ${instance.name}, marking as inactive`);
              newStatuses[instance.id] = {
                isActive: false,
                error: "Status check failed",
                isLoading: false
              };
            }
          } catch (instanceError) {
            console.error(`Error getting status for ${instance.name}:`, instanceError);
            newStatuses[instance.id] = {
              isActive: false,
              error: instanceError instanceof Error ? instanceError.message : "Unknown error",
              isLoading: false
            };
          }
        }
        
        console.log("Setting final instance statuses:", newStatuses);
        setInstanceStatuses(newStatuses);
      } catch (error) {
        console.error("Error in status update process:", error);
        // Update statuses to show error state
        const errorStatuses: Record<string, InstanceStatus> = {};
        for (const instance of instances) {
          errorStatuses[instance.id] = {
            isActive: false,
            error: "Status check failed",
            isLoading: false
          };
        }
        setInstanceStatuses(errorStatuses);
      }
    }
    
    // Check status immediately when instances are loaded or changed
    updateStatuses();
    
    // Start auto-refresh of statuses
    console.log("Starting status auto-refresh");
    const cleanup = startStatusAutoRefresh(instances);
    
    // Cleanup function
    return () => {
      console.log("Cleaning up status refresh interval");
      cleanup();
    };
  }, [instances]);

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
              title={`${instance.name} ${getInstanceStatusIcon(instance.status, instance.id)}`}
              value={instance.id}
              icon={{ source: Icon.Circle, tintColor: instance.color as Color }}
              tooltip={instance.status?.error ? instance.status.error : (instance.status?.isActive ? "Instance is online" : "Instance is offline or unreachable")}
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
              { 
                icon: item.active ? Icon.Circle : (item.hasTrigger === false ? Icon.ExclamationMark : Icon.MinusCircle), 
                text: item.active ? "Active" : (item.hasTrigger === false ? "No Trigger" : "Inactive"), 
                tooltip: item.hasTrigger === false 
                  ? "This workflow cannot be activated because it does not have a trigger node" 
                  : `Workflow is ${item.active ? "active" : "inactive"}`
              },
              { text: `${item.instanceName} ${getInstanceStatusIcon(instanceStatuses[item.instanceId], item.instanceId)}` }
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
                {item.hasTrigger === false && !item.active ? (
                  <Action
                    title="Cannot Activate (No Trigger Node)"
                    icon={Icon.ExclamationMark}
                    onAction={() => {
                      showToast({
                        style: Toast.Style.Failure,
                        title: "Cannot Activate Workflow",
                        message: "This workflow requires a trigger node like Webhook or Cron to be activated."
                      });
                    }}
                  />
                ) : (
                  <Action
                    title={item.active ? "Deactivate Workflow" : "Activate Workflow"}
                    icon={item.active ? Icon.MinusCircle : Icon.Circle}
                    onAction={() => toggleWorkflowStatus(item)}
                    shortcut={{ modifiers: ["cmd"], key: "t" }}
                  />
                )}
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
