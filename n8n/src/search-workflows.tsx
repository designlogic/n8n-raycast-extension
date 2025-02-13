import { ActionPanel, Action, Icon, List, Cache } from "@raycast/api";
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

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const CACHE_KEY = "sanctifai.n8n.workflows.v1";
  const cache = new Cache();

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

  // Function to clear cache
  const clearCache = async () => {
    await cache.remove(CACHE_KEY);
    console.log("🧹 Cache cleared");
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
    setIsLoading(items.length === 0);
    console.log("🔄 Fetching fresh data from API...");
    
    try {
      const response = await fetch("https://workflow.sanctifai.com/webhook/n8n/workflow");
      const data = await response.json();
      if (data && data.data) {
        const formattedData = sortItems(data.data.map((item: any) => ({
          id: item.id,
          icon: { source: "list-icon.svg" },
          title: item.name,
          subtitle: item.active ? "Active" : "Inactive",
          accessory: item.tags.length > 0 ? item.tags.map((tag: any) => tag.name).join(", ") : "No Tags",
          keywords: item.tags.length > 0 ? item.tags.map((tag: any) => tag.name) : [],
        })));
        
        await cache.set(CACHE_KEY, JSON.stringify(formattedData));
        console.log("💾 Cache updated with fresh data");
        setItems(formattedData);
        setFilteredItems(formattedData); // Set filtered items to all items when fetching
      }
    } catch (error) {
      console.error("Error fetching data:", error);
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
              <Action
                title="Clear Cache"
                icon={Icon.Trash}
                onAction={clearCache}
                shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
