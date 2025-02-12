import { ActionPanel, Action, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";

export default function Command() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("https://workflow.sanctifai.com/webhook/n8n/workflow");
        const data = await response.json();
        if (data && data.data) {
          const formattedData = data.data.map((item: any) => ({
            id: item.id,
            icon : { source: "list-icon.svg"},
            title: item.name,
            subtitle: item.active ? "Active" : "Inactive",
            accessory: item.tags.length > 0 ? item.tags.map((tag: any) => tag.name).join(", ") : "No Tags",
          }));
          setItems(formattedData);
        } else {
          console.error("Unexpected response structure:", data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    fetchData();
  }, []);

  return (
    <List>
      {items.map((item) => (
        <List.Item
          key={item.id}
          icon={item.icon}
          title={item.title}
          subtitle={item.subtitle}
          accessories={[{ icon: Icon.Hashtag, text: item.accessory }]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser url={`https://workflow.sanctifai.com/workflow/${item.id}`} />
              <Action.CopyToClipboard content={item.title} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );

}