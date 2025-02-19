import { ActionPanel, Action, Icon, List, Cache, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { WorkflowItem, Preferences, WorkflowResponse } from "./types";
import { CACHE_KEY, getApiEndpoints } from "./config";
import { sortAlphabetically, formatWorkflowData, filterItems } from "./utils";

// Main Component
export default function Command() {
  // State
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const cache = new Cache();
  const preferences = getPreferenceValues<Preferences>();
  const API_ENDPOINTS = getApiEndpoints(preferences.baseUrl);

  // Get unique tags from workflow items
  const availableTags = [...new Set(items.flatMap(item => item.keywords))].sort();

  // API Functions
  const fetchWorkflows = async () => {
    let allWorkflows: WorkflowResponse['data'] = [];
    let cursor: string | undefined;
    const limit = 250;

    do {
      const url = cursor
        ? `${API_ENDPOINTS.workflows}?limit=${limit}&cursor=${cursor}`
        : `${API_ENDPOINTS.workflows}?limit=${limit}`;
      
      const response = await fetch(url, {
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

      const data = JSON.parse(await response.text()) as { data: WorkflowResponse['data']; nextCursor?: string };
      allWorkflows = [...allWorkflows, ...(data.data || [])];
      cursor = data.nextCursor;

    } while (cursor);

    return { data: allWorkflows } as WorkflowResponse;
  };

  // Data Management Functions
  const updateWorkflowData = async (workflows: WorkflowItem[]) => {
    await cache.set(CACHE_KEY, JSON.stringify(workflows));
    setItems(workflows);
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
        
        if (forceFresh) {
          await showToast({
            style: Toast.Style.Success,
            title: "Workflows Refreshed",
            message: `Found ${formattedData.length} workflows`
          });
        }
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
  const handleTagChange = (newTag: string | null) => {
    setSelectedTag(newTag);
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
      filtering={true}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Tag"
          value={selectedTag || ""}
          onChange={handleTagChange}
        >
          <List.Dropdown.Item title="All Tags" value="" />
          {availableTags.map((tag) => (
            <List.Dropdown.Item
              key={tag}
              title={tag}
              value={tag}
              icon={Icon.Tag}
            />
          ))}
        </List.Dropdown>
      }
    >
      {items
        .filter(item => !selectedTag || item.keywords.includes(selectedTag))
        .map((item) => (
          <List.Item
            key={item.id}
            icon={item.icon}
            title={item.title}
            keywords={item.keywords}
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
