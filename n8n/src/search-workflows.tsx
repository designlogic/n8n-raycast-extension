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
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const CACHE_KEY = "workflows-cache";
  const cache = new Cache();

  async function fetchData() {
    setIsLoading(true);
    console.log("🔄 Fetching fresh data from API...");
    try {
      const response = await fetch("https://workflow.sanctifai.com/webhook/n8n/workflow");
      const data = await response.json();
      if (data && data.data) {
        const formattedData = data.data.map((item: any) => ({
          id: item.id,
          icon: { source: "list-icon.svg" },
          title: item.name,
          subtitle: item.active ? "Active" : "Inactive",
          accessory: item.tags.length > 0 ? item.tags : "No Tags",
        }));
        
        // Store in cache
        await cache.set(CACHE_KEY, JSON.stringify(formattedData));
        console.log("💾 Cache updated with fresh data");
        setItems(formattedData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Load data from cache on initial mount
  useEffect(() => {
    async function loadFromCache() {
      const cachedData = await cache.get(CACHE_KEY);
      if (cachedData) {
        console.log("📖 Loading data from cache");
        setItems(JSON.parse(cachedData));
        setIsLoading(false);
      } else {
        console.log("❌ No cache found, fetching fresh data");
        await fetchData();
      }
    }
    loadFromCache();
  }, []);

  return (
    <List
      searchBarPlaceholder="Search workflows..."
      isLoading={isLoading}
      filtering={true}
      onSearchTextChange={setSearchText}
    >
      {items.map((item) => (
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
                onAction={fetchData}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
