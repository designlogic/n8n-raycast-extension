import { ActionPanel, Action, Icon, List, Cache, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";

// Define a type for our workflow items
interface WorkflowItem {
  id: string;
  icon: { source: string };
  title: string;
  subtitle: string;
  accessory: string;
  keywords: string[];
}

// Add interface for preferences
interface Preferences {
  apiKey: string;
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const CACHE_KEY = "sanctifai.n8n.workflows.v1";
  const cache = new Cache();

  const preferences = getPreferenceValues<Preferences>();

  // Add this new function to sort items alphabetically
  const sortItems = (items: WorkflowItem[]): WorkflowItem[] => {
    return [...items].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  };

  // Update the filter function to always sort results
  const filterItems = (items: WorkflowItem[], searchText: string) => {
    if (!searchText) {
      return sortItems(items); // Always sort, even when no search
    }
    
    const lowerSearchText = searchText.toLowerCase();
    
    const filtered = items.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(lowerSearchText);
      const tagMatch = item.keywords.some(tag => 
        tag.toLowerCase().includes(lowerSearchText)
      );
      
      return titleMatch || tagMatch;
    });

    return sortItems(filtered);
  };

  // Update search handler
  const handleSearchTextChange = (newSearchText: string) => {
    setSearchText(newSearchText);
    setFilteredItems(filterItems(items, newSearchText));
  };

  // Function to clear cache and reload
  const clearCache = async () => {
    await cache.remove(CACHE_KEY);
    console.log("🧹 Cache cleared");
    await fetchData(true); // Force fetch after clearing cache
  };

  // Load data on component mount
  useEffect(() => {
    async function loadInitialData() {
      const cachedData = await cache.get(CACHE_KEY);
      
      if (cachedData) {
        console.log("📖 Loading data from cache");
        const parsedData = JSON.parse(cachedData);
        const sortedData = sortItems(parsedData);
        setItems(sortedData);
        setFilteredItems(sortedData); // Set initial filtered items to all items
        setIsLoading(false);
      } else {
        console.log("❌ No cache found, fetching fresh data");
        await fetchData(true);
      }
    }
    loadInitialData();
  }, []);

  async function fetchData(forceFresh = false) {
    setIsLoading(true);
    console.log("🔄 Fetching fresh data from API...");
    
    try {
      const response = await fetch("https://workflow.sanctifai.com/api/v1/workflows", {
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

      const data = await response.json();
      
      // Check if data is in the expected format
      const workflows = Array.isArray(data) ? data : data.data;
      
      if (workflows && Array.isArray(workflows)) {
        const formattedData = sortItems(workflows.map((workflow: any) => ({
          id: workflow.id,
          icon: { source: "list-icon.svg" },
          title: workflow.name,
          subtitle: workflow.active ? "Active" : "Inactive",
          accessory: workflow.tags && workflow.tags.length > 0 
            ? workflow.tags.map((tag: any) => tag.name).join(", ") 
            : "No Tags",
          keywords: workflow.tags && workflow.tags.length > 0 
            ? workflow.tags.map((tag: any) => tag.name) 
            : [],
        })));
        
        await cache.set(CACHE_KEY, JSON.stringify(formattedData));
        console.log("💾 Cache updated with fresh data");
        setItems(formattedData);
        setFilteredItems(formattedData);
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

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
              <Action.OpenInBrowser url={`https://workflow.sanctifai.com/workflow/${item.id}`} />
              <Action.CopyToClipboard title="Copy Workflow URL" content={`https://workflow.sanctifai.com/workflow/${item.id}`} />
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
