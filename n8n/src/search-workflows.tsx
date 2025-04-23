import { ActionPanel, Action, Icon, List, Cache, showToast, Toast, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { WorkflowItem, Preferences, WorkflowResponse, N8nInstance } from "./types";
import { CACHE_KEY, getApiEndpoints } from "./config";
import { sortAlphabetically, formatWorkflowData, filterItems, generateInstanceId, performFuzzySearch } from "./utils";
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
  const [searchText, setSearchText] = useState<string>("");
  const [isApiSearching, setIsApiSearching] = useState(false);
  const [isFuzzySearching, setIsFuzzySearching] = useState(false);
  const [apiSearchResults, setApiSearchResults] = useState<WorkflowItem[]>([]);
  const [fuzzySearchResults, setFuzzySearchResults] = useState<WorkflowItem[]>([]);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, InstanceStatus>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [instances, setInstances] = useState<StoredInstance[]>([]);

  const cache = new Cache();

  // Helper function for section subtitle
  const getWorkflowSectionSubtitle = () => {
    if (isApiSearching) return "API Searching...";
    if (isFuzzySearching) return "Fuzzy Searching...";
    if (apiSearchResults.length > 0) return `API Results: ${apiSearchResults.length}`;
    if (fuzzySearchResults.length > 0) return `Fuzzy Results: ${fuzzySearchResults.length}`;
    return items.length.toString();
  };

  // Render workflow item function
  const renderWorkflowItem = (item: WorkflowItem) => (
    <List.Item
      key={item.uniqueKey}
      icon={{ source: Icon.Circle, tintColor: item.instanceColor as Color }}
      title={item.title}
      subtitle={item.subtitle}
      accessories={[
        { icon: Icon.Hashtag, text: item.accessory }
      ]}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            title="Open in Browser"
            url={getApiEndpoints({
              id: item.instanceId,
              name: item.instanceName,
              baseUrl: instances.find(i => i.id === item.instanceId)?.baseUrl || "",
              apiKey: ""
            }).workflowUrl(item.id)}
          />
          <Action
            title={item.active ? "Deactivate Workflow" : "Activate Workflow"}
            icon={item.active ? Icon.MinusCircle : Icon.Circle}
            onAction={() => toggleWorkflowStatus(item)}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
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
  );
  // Search workflows via API across all instances
  const searchWorkflowsViaAPI = async (searchTerm: string): Promise<WorkflowItem[]> => {
    if (!searchTerm || searchTerm.trim().length === 0) return [];
    
    setIsApiSearching(true);
    const searchResults: WorkflowItem[] = [];
    const errors: string[] = [];
    
    try {
      const searchTermLower = searchTerm.trim().toLowerCase();
      
      // Process instances in sequence
      for (const instance of instances) {
        try {
          // Skip instances that are offline
          const status = instanceStatuses[instance.id];
          if (!status?.isActive) {
            console.log(`Skipping instance ${instance.name} because it's offline`);
            continue;
          }
          
          // Try two search strategies:
          // 1. First attempt direct API search (faster but less flexible)
          // 2. If no results or error, fallback to fetching all workflows (more thorough)
          
          try {
            const API_ENDPOINTS = getApiEndpoints(instance);
            console.log(`Trying direct API search for ${instance.name}...`);
            
            // Use appropriate parameters based on search term format
            const searchUrl = `${API_ENDPOINTS.workflows}`;
            const params = new URLSearchParams();
            if (searchTerm.includes(' ')) {
              // For multi-word searches, use tags parameter
              params.append('tags', searchTerm);
            } else {
              // For single-word searches, search in name
              params.append('name', searchTerm);
            }
            const fullUrl = `${searchUrl}?${params.toString()}`;
            
            const response = await fetch(fullUrl, {
              method: 'GET',
              headers: (() => {
                const headers: Record<string, string> = {
                  "Accept": "application/json"
                };
                
                // Try both authentication methods (n8n supports both depending on version)
                if (instance.apiKey.startsWith('Bearer ') || instance.apiKey.startsWith('token ')) {
                  headers["Authorization"] = instance.apiKey;
                } else {
                  headers["X-N8N-API-KEY"] = instance.apiKey;
                }
                
                return headers;
              })()
            });
            
            if (!response.ok) {
              throw new Error(
                response.status === 401 
                  ? `Invalid API key for instance ${instance.name}` 
                  : `Failed to search workflows from ${instance.name}: ${response.statusText}`
              );
            }
            
            const data = await response.json() as { data: WorkflowResponse['data'] };
            
            if (data.data && data.data.length > 0) {
              const formattedResults = data.data.map(workflow => formatWorkflowData(workflow, instance));
              searchResults.push(...formattedResults);
              console.log(`Found ${formattedResults.length} workflows via direct API search in ${instance.name}`);
              // If we found results with direct API search, we can skip the batch processing
              continue;
            } else {
              console.log(`No results from direct API search in ${instance.name}, trying batch processing...`);
            }
          } catch (apiError) {
            console.log(`API search error for ${instance.name}, falling back to batch processing:`, apiError);
            // Continue to batch processing fallback
          }
          
          // Fallback: Fetch all workflows and filter client-side
          // This enables partial matching and finding recently created workflows
          console.log(`Fetching all workflows from ${instance.name} for partial matching...`);
          
          // Collect matching workflows while processing batches
          await processBatchedWorkflows(
            instance,
            (formattedWorkflows) => {
              // Apply client-side partial matching
              const matchingWorkflows = formattedWorkflows.filter(workflow => {
                const titleLower = workflow.title.toLowerCase();
                const tagsLower = workflow.keywords.map(k => k.toLowerCase());
                
                // Check for direct inclusion of the whole search term
                if (titleLower.includes(searchTermLower) || 
                    tagsLower.some(tag => tag.includes(searchTermLower))) {
                  return true;
                }
                
                // Handle numeric searches specifically (e.g. "52" should match "Workflow 52")
                const numericMatch = searchTermLower.match(/\d+/);
                if (numericMatch) {
                  const numericPart = numericMatch[0];
                  if (titleLower.includes(numericPart)) {
                    return true;
                  }
                }
                
                // Split search term into parts and check if ANY parts match (not all)
                // This makes the search more lenient
                const searchParts = searchTermLower.split(/\s+/);
                return searchParts.some(part => 
                  titleLower.includes(part) || 
                  tagsLower.some(tag => tag.includes(part))
                );
              });
              
              if (matchingWorkflows.length > 0) {
                searchResults.push(...matchingWorkflows);
              }
            },
            50 // batch size
          );
        } catch (error) {
          errors.push(`${instance.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
      
      if (errors.length > 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Some instances failed to search",
          message: errors.join("\n")
        });
      }
      
      if (searchResults.length > 0) {
        // Deduplicate and sort results
        const uniqueResults = Array.from(
          new Map(searchResults.map(item => [item.uniqueKey, item])).values()
        );
        const sortedResults = sortAlphabetically(uniqueResults);
        
        // Merge with existing cached workflows to improve future fuzzy searches
        try {
          // Get the current cached items
          const cachedData = await cache.get(CACHE_KEY);
          if (cachedData) {
            const cachedItems = JSON.parse(cachedData) as WorkflowItem[];
            
            // Create a map of existing items for quick lookup
            const existingItemsMap = new Map(
              cachedItems.map(item => [item.uniqueKey, item])
            );
            
            // Add new items from API search to the map
            sortedResults.forEach(newItem => {
              existingItemsMap.set(newItem.uniqueKey, newItem);
            });
            
            // Convert back to array and sort
            const combinedItems = sortAlphabetically(
              Array.from(existingItemsMap.values())
            );
            
            // Update the cache with the combined data
            await updateWorkflowData(combinedItems);
            
            // Also update the items state with the combined dataset
            setItems(combinedItems);
            
            console.log(`Combined ${sortedResults.length} new workflows with ${cachedItems.length} cached workflows, resulting in ${combinedItems.length} unique workflows`);
          } else {
            // If no cache exists, just use the new results
            await updateWorkflowData(sortedResults);
          }
        } catch (cacheError) {
          console.error("Error updating cache with new workflows:", cacheError);
          // Even if cache update fails, still return the API results
        }
        
        // Update the state with the search results
        setApiSearchResults(sortedResults);
        
        // Add a note about fuzzy matching in the success message
        await showToast({
          style: Toast.Style.Success,
          message: `Found ${uniqueResults.length} workflows containing "${searchTerm}"`
        });
        
        return sortedResults;
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: "No Results Found",
          message: `No workflows containing "${searchTerm}" found across instances`
        });
        return [];
      }
    } catch (error) {
      console.error("Error searching workflows via API:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Search Failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
      return [];
    } finally {
      setIsApiSearching(false);
    }
  };
  
  /**
   * Process workflows in batches to reduce memory usage and improve performance
   * @param instance The n8n instance to fetch workflows from
   * @param onBatchProcessed Callback function to handle each batch of processed workflows
   * @param batchSize Number of workflows to process in each batch
   * @returns Total number of workflows processed
   */
  const processBatchedWorkflows = async (
    instance: StoredInstance,
    onBatchProcessed: (workflows: WorkflowItem[]) => void,
    batchSize = 50
  ): Promise<number> => {
    let totalWorkflows = 0;
    let offset = 0;
    const API_ENDPOINTS = getApiEndpoints(instance);
    while (true) {
      try {
        // Construct URL with proper pagination parameters
        const params = new URLSearchParams({
          'active': 'all',
          'limit': batchSize.toString(),
          'offset': offset.toString()
        });
        
        const response = await fetch(`${API_ENDPOINTS.workflows}`, {
          method: 'GET',
          headers: (() => {
            const headers: Record<string, string> = {
              "Accept": "application/json"
            };
            
            // Try both authentication methods
            if (instance.apiKey.startsWith('Bearer ') || instance.apiKey.startsWith('token ')) {
              headers["Authorization"] = instance.apiKey;
            } else {
              headers["X-N8N-API-KEY"] = instance.apiKey;
            }
            
            return headers;
          })()
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || response.statusText;
          } catch {
            errorMessage = errorText || response.statusText;
          }
          
          throw new Error(
            response.status === 401 
              ? `Invalid API key for instance ${instance.name}` 
              : `Failed to fetch workflows from ${instance.name}: ${errorMessage}`
          );
        }
        
        const data = await response.json() as WorkflowResponse;
        const workflows = data.data || [];
        
        if (workflows.length === 0) {
          break; // No more workflows to process
        }
        
        // Format the workflows
        const formattedWorkflows = workflows.map(workflow => 
          formatWorkflowData(workflow, instance)
        );
        
        // Process this batch
        onBatchProcessed(formattedWorkflows);
        
        totalWorkflows += workflows.length;
        
        // Check if we've processed all workflows
        if (workflows.length < batchSize) {
          break;
        }
        
        // Move to next batch
        offset += batchSize;
        
        // Add a small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing batch for ${instance.name}:`, error);
        throw error;
      }
    }
    
    return totalWorkflows;
  };

  // Legacy method - now uses the batched approach
  // Legacy method - now uses the batched approach
  const fetchWorkflowsForInstance = async (instance: StoredInstance) => {
    const allWorkflows: WorkflowResponse['data'] = [];
    
    // Use the batched processing but still collect all workflows for backwards compatibility
    await processBatchedWorkflows(
      instance,
      (formattedWorkflows) => {
        // Extract the raw workflow data for backwards compatibility
        const rawWorkflows = formattedWorkflows.map(fw => ({
          id: fw.id,
          name: fw.title,
          active: fw.active,
          tags: fw.accessory !== "No Tags" 
            ? fw.accessory.split(", ").map(tag => ({ name: tag })) 
            : []
        }));
        
        // Add to allWorkflows
        allWorkflows.push(...rawWorkflows);
      }
    );
    
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
    
    // Deduplicate workflows by uniqueKey
    const uniqueWorkflows = Array.from(
      new Map(workflowsWithTriggerStatus.map(item => [item.uniqueKey, item])).values()
    );
    
    // Only cache essential data to reduce memory usage
    const essentialData = uniqueWorkflows.map(workflow => ({
      id: workflow.id,
      instanceId: workflow.instanceId,
      uniqueKey: workflow.uniqueKey,
      instanceName: workflow.instanceName,
      instanceColor: workflow.instanceColor,
      title: workflow.title,
      subtitle: workflow.subtitle,
      accessory: workflow.accessory,
      keywords: workflow.keywords,
      active: workflow.active,
      hasTrigger: workflow.hasTrigger
    }));
    
    await cache.set(CACHE_KEY, JSON.stringify(essentialData));
    setItems(uniqueWorkflows);
  };

  const fetchData = async (forceFresh = false) => {
    setIsLoading(!items.length);
    console.log("🔄 Fetching fresh data from all instances...");
    
    try {
      const collectedWorkflows: WorkflowItem[] = [];
      const errors: string[] = [];
      const newStatuses: Record<string, InstanceStatus> = {};
      let totalWorkflows = 0;

      // Process instances in sequence to reduce memory pressure
      for (const instance of instances) {
        try {
          const status = await getInstanceStatus(instance.id);
          newStatuses[instance.id] = {
            isActive: status?.isActive || false,
            error: status?.error
          };
          if (status?.isActive) {
            // Use the batched processing approach
            const workflowsProcessed = await processBatchedWorkflows(
              instance,
              (formattedWorkflows) => {
                // Add workflows to our collection
                collectedWorkflows.push(...formattedWorkflows);
                
                // If we've accumulated a good number, update the UI to show progress
                // If we've accumulated a good number, update the UI to show progress
                if (collectedWorkflows.length % 100 === 0) {
                  // Update state with current batch for better responsiveness
                  const uniqueWorkflows = Array.from(
                    new Map(collectedWorkflows.map(item => [item.uniqueKey, item])).values()
                  );
                  setItems(sortAlphabetically(uniqueWorkflows));
                  
                  // Release references to allow GC
                  const tempCollected = [...collectedWorkflows];
                  collectedWorkflows.length = 0;
                  collectedWorkflows.push(...uniqueWorkflows);
                }
              },
              50 // Set batch size to 50 workflows per request
            );
            totalWorkflows += workflowsProcessed;
            console.log(`Processed ${workflowsProcessed} workflows from ${instance.name}`);
          }
        } catch (error) {
          errors.push(`${instance.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
          newStatuses[instance.id] = { isActive: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      }

      // After processing all instances, update statuses and finalize the UI
      setInstanceStatuses(newStatuses);

      if (collectedWorkflows.length > 0) {
        // Deduplicate and sort
        const uniqueWorkflows = Array.from(
          new Map(collectedWorkflows.map(item => [item.uniqueKey, item])).values()
        );
        const sortedWorkflows = sortAlphabetically(uniqueWorkflows);
        
        // Update the workflow data in state and cache
        await updateWorkflowData(sortedWorkflows);
        
        if (forceFresh) {
          await showToast({
            style: Toast.Style.Success,
            title: "Workflows Refreshed",
            message: `Found ${uniqueWorkflows.length} unique workflows across ${instances.length} instances`
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
          headers: (() => {
            const headers: Record<string, string> = {
              "Accept": "application/json"
            };
            
            // Try both authentication methods
            if (instance.apiKey.startsWith('Bearer ') || instance.apiKey.startsWith('token ')) {
              headers["Authorization"] = instance.apiKey;
            } else {
              headers["X-N8N-API-KEY"] = instance.apiKey;
            }
            
            return headers;
          })()
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
        headers: (() => {
          const headers: Record<string, string> = {
            "Accept": "application/json"
          };
          
          // Try both authentication methods
          if (instance.apiKey.startsWith('Bearer ') || instance.apiKey.startsWith('token ')) {
            headers["Authorization"] = instance.apiKey;
          } else {
            headers["X-N8N-API-KEY"] = instance.apiKey;
          }
          
          return headers;
        })()
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
      
      // Optional: Free up memory after large operations
      setTimeout(() => {
        // This will give time for UI updates to complete before we suggest garbage collection
        // Note: We don't use explicit GC calls but rely on reference cleanup
        const updatedWorkflow = null;
        const updatedResponse = null;
      }, 100);

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
          title="No n8n Instances Found"
          description="Add an n8n instance in the extension settings to get started."
          icon={Icon.XMarkCircle}
          actions={
            <ActionPanel>
              <Action.Push
                title="Add n8n Instance"
                target={
                  <List.Item
                    title="Add n8n Instance"
                    icon={Icon.Plus}
                    actions={
                      <ActionPanel>
                        <Action
                          title="Open Manage Instances"
                          onAction={() => {
                            showToast({
                              style: Toast.Style.Success,
                              title: "Please use Manage Instances command",
                              message: "Use the 'Manage n8n Instances' command from Raycast"
                            });
                          }}
                        />
                      </ActionPanel>
                    }
                  />
                }
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }
  
  // Get unique instances
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

  return (
    <List
      searchBarPlaceholder="Search workflows by name, tags, or instance..."
      isLoading={isLoading || isApiSearching || isFuzzySearching}
      filtering={true}
      onSearchTextChange={(text) => {
        // Clear all search-related states in the correct order
        setSearchText(text);  // Set new search text first
        
        if (!text.trim()) {
          // If clearing search, reset everything
          setIsApiSearching(false);
          setIsFuzzySearching(false);
          setFuzzySearchResults([]);
          setApiSearchResults([]);
          return;
        }
        
        // For new search terms, just reset the search states
        setIsApiSearching(false);
        setIsFuzzySearching(false);
        
        // Don't clear results immediately to avoid UI flicker
        // They'll be replaced when new results come in
      }}
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
              tooltip={instance.status?.error || (instance.status?.isActive ? "Instance is online" : "Instance is offline")}
            />
          ))}
        </List.Dropdown>
      }
    >
      {/* Workflows Section */}
      <List.Section title="Workflows" subtitle={getWorkflowSectionSubtitle()}>
        {isApiSearching ? (
          <List.Item
            title="Searching across instances..."
            icon={Icon.MagnifyingGlass}
          />
        ) : isFuzzySearching ? (
          <List.Item
            title="Performing fuzzy search..."
            icon={Icon.MagnifyingGlass}
          />
        ) : (
          // Order of precedence: API results > fuzzy results > filtered items
          (apiSearchResults.length > 0 ? apiSearchResults :
           fuzzySearchResults.length > 0 ? fuzzySearchResults :
           filterItems(items, searchText, selectedTag, selectedInstance)
          ).map(renderWorkflowItem)
        )}
      </List.Section>

      {/* EmptyView - show only when no results found */}
      {searchText && !isApiSearching && !isFuzzySearching && 
       filterItems(items, searchText, selectedTag, selectedInstance).length === 0 && 
       apiSearchResults.length === 0 && 
       fuzzySearchResults.length === 0 && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No matching workflows found locally"
          description="Try fuzzy search first, then API search, or refresh all data."
          actions={
            <ActionPanel>
              <Action
                title="Try Fuzzy Search"
                icon={Icon.MagnifyingGlass}
                shortcut={{ modifiers: [], key: "return" }}
                onAction={async () => {
                  if (!searchText.trim()) {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Please enter a search term",
                      message: "Enter text to search for workflows"
                    });
                    return;
                  }
                  
                  try {
                    setFuzzySearchResults([]);
                    setIsFuzzySearching(true);
                    
                    await showToast({
                      style: Toast.Style.Animated,
                      title: "Performing fuzzy search",
                      message: "Searching with smart matching algorithms..."
                    });
                    
                    // Start search immediately to reduce latency
                    // Make the fuzzy search more lenient by lowering the threshold
                    const results = performFuzzySearch(items, searchText, { threshold: 0.4 });
                    
                    // Small delay for UI feedback only
                    setTimeout(async () => {
                      setFuzzySearchResults(results);
                      setIsFuzzySearching(false);
                      
                      if (results.length > 0) {
                        await showToast({
                          style: Toast.Style.Success,
                          title: "Fuzzy search results found",
                          message: `Found ${results.length} workflows matching "${searchText}"`
                        });
                      } else {
                        await showToast({
                          style: Toast.Style.Animated,
                          title: "No fuzzy matches found",
                          message: "Trying API search..."
                        });
                        
                        // Automatically try API search if no fuzzy results found
                        await searchWorkflowsViaAPI(searchText);
                      }
                    }, 100);
                  } catch (error) {
                    setIsFuzzySearching(false);
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Fuzzy search failed",
                      message: error instanceof Error ? error.message : "Unknown error occurred"
                    });
                  }
                }}
              />
              <Action
                title="Search via API"
                icon={Icon.Globe}
                shortcut={{ modifiers: ["opt"], key: "return" }}
                onAction={() => searchWorkflowsViaAPI(searchText)}
              />
              <Action
                title="Refresh All Data"
                icon={Icon.RotateClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() => fetchData(true)}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
