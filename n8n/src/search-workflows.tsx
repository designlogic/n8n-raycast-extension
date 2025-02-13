import { ActionPanel, Action, Icon, List, Cache, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { WorkflowItem, Preferences, WorkflowResponse } from "./types";
import { CACHE_KEY, API_ENDPOINTS, getApiEndpoints } from "./config";
import { sortAlphabetically, formatWorkflowData, filterItems } from "./utils";

// Main Component
export default function Command() {
  // State
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const cache = new Cache();
  const preferences = getPreferenceValues<Preferences>();
  const API_ENDPOINTS = getApiEndpoints(preferences.baseUrl);

  // API Functions
  const fetchWorkflows = async () => {
    console.log(`🌐 Fetching from URL: ${API_ENDPOINTS.workflows}`);
    
    const response = await fetch(API_ENDPOINTS.workflows, {
      headers: {
        "X-N8N-API-KEY": preferences.apiKey,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        response.status === 401 
          ? "Invalid API key. Please check your n8n API key in extension preferences." 
          : `Failed to fetch workflows: ${response.statusText}`
      );
    }

    return response.json() as Promise<WorkflowResponse>;
  };

  // Data Management Functions
  const updateWorkflowData = async (workflows: WorkflowItem[]) => {
    await cache.set(CACHE_KEY, JSON.stringify(workflows));
    setItems(workflows);
    setFilteredItems(workflows);
  };

  const fetchData = async (forceFresh = false) => {
    setIsLoading(!items.length);
    console.log("🔄 Fetching fresh data from API...");
    
    try {
      const data = await fetchWorkflows();
      const workflows = Array.isArray(data) ? data : data.data;
      
      if (workflows && Array.isArray(workflows)) {
        const formattedData = sortAlphabetically(workflows.map(formatWorkflowData));
        await updateWorkflowData(formattedData);
        console.log("💾 Cache updated with fresh data");
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Event Handlers
  const handleSearchTextChange = (newSearchText: string) => {
    setSearchText(newSearchText);
    setFilteredItems(filterItems(items, newSearchText));
  };

  const handleClearCache = async () => {
    await cache.remove(CACHE_KEY);
    console.log("🧹 Cache cleared");
    await fetchData(true);
  };

  // Initial Load
  useEffect(() => {
    async function loadInitialData() {
      const cachedData = await cache.get(CACHE_KEY);
      
      if (cachedData) {
        console.log("📖 Loading data from cache");
        const parsedData = JSON.parse(cachedData);
        const sortedData = sortAlphabetically(parsedData);
        setItems(sortedData);
        setFilteredItems(sortedData);
        setIsLoading(false);
      } else {
        console.log("❌ No cache found, fetching fresh data");
        await fetchData(true);
      }
    }
    loadInitialData();
  }, []);

  // Render
  return (
    <List
      searchBarPlaceholder="Search workflows by name or tags..."
      isLoading={isLoading}
      filtering={false}
      onSearchTextChange={handleSearchTextChange}
    >
      {filteredItems.map((item) => (
        <List.Item
          key={item.id}
          icon={item.icon}
          title={item.title}
          accessories={[{ icon: Icon.Hashtag, text: item.accessory }]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser url={API_ENDPOINTS.workflowUrl(item.id)} />
              <Action.CopyToClipboard 
                title="Copy Workflow URL" 
                content={API_ENDPOINTS.workflowUrl(item.id)} 
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
    </List>
  );
}
