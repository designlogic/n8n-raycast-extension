import { WorkflowItem, WorkflowResponse, N8nInstance } from "./types";

export const sortAlphabetically = (items: WorkflowItem[]): WorkflowItem[] => {
  return [...items].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
};

/**
 * Formats workflow data from API response into a WorkflowItem
 * Creates a uniqueKey using instance.id-workflow.id to ensure workflows are uniquely identified
 * across multiple n8n instances
 */
export const formatWorkflowData = (
  workflow: WorkflowResponse["data"][0], 
  instance: N8nInstance
): WorkflowItem => {
  const validTags = workflow.tags?.map(tag => tag.name.trim()).filter(Boolean) || [];
  return {
    id: workflow.id,
    instanceId: instance.id,
    uniqueKey: `${instance.id}-${workflow.id}`, // Add a composite unique key
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
    active: workflow.active,
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
  
  // Create a Map to store unique workflows based on their uniqueKey
  const uniqueWorkflows = new Map();
  
  // First pass: filter and deduplicate by uniqueKey
  items.forEach((item) => {
    const matchesSearch = !searchText || 
      item.title.toLowerCase().includes(lowerSearchText) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(lowerSearchText));
      
    const matchesTag = !selectedTag || 
      item.keywords.includes(selectedTag);

    const matchesInstance = !selectedInstance ||
      item.instanceId === selectedInstance;

    if (matchesSearch && matchesTag && matchesInstance) {
      // Use uniqueKey as map key to ensure no duplicates
      uniqueWorkflows.set(item.uniqueKey, item);
    }
  });
  
  // Convert Map values back to array
  const filtered = Array.from(uniqueWorkflows.values());

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
