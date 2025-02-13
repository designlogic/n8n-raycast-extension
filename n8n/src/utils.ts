import { WorkflowItem, WorkflowResponse } from "./types";

export const sortAlphabetically = (items: WorkflowItem[]): WorkflowItem[] => {
  return [...items].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
};

export const formatWorkflowData = (workflow: WorkflowResponse["data"][0]): WorkflowItem => ({
  id: workflow.id,
  icon: { source: "list-icon.svg" },
  title: workflow.name,
  subtitle: workflow.active ? "Active" : "Inactive",
  accessory: workflow.tags?.length > 0 ? workflow.tags.map(tag => tag.name).join(", ") : "No Tags",
  keywords: workflow.tags?.length > 0 ? workflow.tags.map(tag => tag.name) : [],
});

export const filterItems = (items: WorkflowItem[], searchText: string) => {
  if (!searchText) return sortAlphabetically(items);
  
  const lowerSearchText = searchText.toLowerCase();
  const filtered = items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(lowerSearchText);
    const tagMatch = item.keywords.some(tag => 
      tag.toLowerCase().includes(lowerSearchText)
    );
    return titleMatch || tagMatch;
  });

  return sortAlphabetically(filtered);
}; 