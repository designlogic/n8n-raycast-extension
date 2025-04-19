import { N8nInstance, WorkflowItem, WorkflowResponse } from "./types";

export const sortAlphabetically = (items: WorkflowItem[]): WorkflowItem[] => {
  return [...items].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
};

export const formatWorkflowData = (
  workflow: WorkflowResponse["data"][0], 
  instance: N8nInstance
): WorkflowItem => ({
  id: workflow.id,
  instanceId: instance.id,
  instanceName: instance.name,
  instanceColor: instance.color,
  icon: { source: "list-icon.svg" },
  title: workflow.name,
  subtitle: `${instance.name} ${workflow.active ? "• Active" : "• Inactive"}`,
  accessory: workflow.tags?.length > 0 ? workflow.tags.map(tag => tag.name).join(", ") : "No Tags",
  keywords: [
    instance.name,
    ...(workflow.tags?.length > 0 ? workflow.tags.map(tag => tag.name) : [])
  ],
});

export const filterItems = (
  items: WorkflowItem[], 
  searchText: string,
  selectedTag: string | null,
  selectedInstance: string | null
) => {
  if (!searchText && !selectedTag && !selectedInstance) {
    return sortAlphabetically(items);
  }
  
  const lowerSearchText = searchText.toLowerCase();
  const filtered = items.filter((item) => {
    const matchesSearch = !searchText || 
      item.title.toLowerCase().includes(lowerSearchText) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(lowerSearchText));
      
    const matchesTag = !selectedTag || 
      item.keywords.includes(selectedTag);

    const matchesInstance = !selectedInstance ||
      item.instanceId === selectedInstance;

    return matchesSearch && matchesTag && matchesInstance;
  });

  return sortAlphabetically(filtered);
};

export const generateInstanceId = (baseUrl: string): string => {
  return baseUrl.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
};

export const getCacheKeyForInstance = (instanceId: string): string => {
  return `designLogicSolutions.n8n.workflows.${instanceId}.v1`;
};
