import { WorkflowItem, WorkflowResponse, N8nInstance } from "./types";

export const sortAlphabetically = (items: WorkflowItem[]): WorkflowItem[] => {
  return [...items].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
};

export const formatWorkflowData = (
  workflow: WorkflowResponse["data"][0], 
  instance: N8nInstance
): WorkflowItem => {
  const validTags = workflow.tags?.map(tag => tag.name.trim()).filter(Boolean) || [];
  return {
    id: workflow.id,
    instanceId: instance.id,
    instanceName: instance.name,
    instanceColor: instance.color,
    icon: { source: "list-icon.svg" },
    title: workflow.name,
    subtitle: `${instance.name} ${workflow.active ? "• Active" : "• Inactive"}`,
    accessory: validTags.length > 0 ? validTags.join(", ") : "No Tags",
    keywords: [
      instance.name,
      ...validTags
    ],
  };
};

export const filterItems = (
  items: WorkflowItem[], 
  searchText: string,
  selectedTag: string | null,
  selectedInstance: string | null
) => {
  if (!searchText && !selectedTag && !selectedInstance) {
    return sortAlphabetically(items);
  }
  
  const lowerSearchText = searchText.trim().toLowerCase();
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
  const trimmedUrl = baseUrl.trim();
  if (!trimmedUrl) return "";
  
  return trimmedUrl
    .toLowerCase()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with single underscore
    .replace(/(^_+|_+$)/g, ''); // Remove leading/trailing underscores
};

export const getCacheKeyForInstance = (instanceId: string): string => {
  return `designLogicSolutions.n8n.workflows.${instanceId}.v1`;
};
