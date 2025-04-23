import { WorkflowItem, Preferences, WorkflowResponse, N8nInstance } from "./types";
import Fuse from 'fuse.js';

/**
 * Performs fuzzy search on workflow items using Fuse.js
 * @param items Items to search through
 * @param searchText Text to search for
 * @returns Array of matching items with scores
 */
export const performFuzzySearch = (
  items: WorkflowItem[],
  searchText: string
): WorkflowItem[] => {
  try {
    // Early return if search text is empty
    if (!searchText.trim()) {
      return items;
    }

    // Calculate threshold based on search text length
    // Shorter queries should be more strict to avoid too many false positives
    const threshold = Math.min(
      0.6, // Maximum threshold
      0.3 + (searchText.length * 0.05) // Increases with length, starts stricter
    );

    // Create a new Fuse instance each time (avoid caching issues)
    const fuse = new Fuse(items, {
      keys: [
        { name: 'title', weight: 2 },      // Prioritize workflow name matches
        { name: 'instanceName', weight: 1 }, // Increase instance name weight
        { name: 'keywords', weight: 0.8 },  // Increase tag weight
        { name: 'subtitle', weight: 0.5 }   // Add subtitle for more context
      ],
      includeScore: true,
      threshold,              // Dynamic threshold
      distance: 100,         // Allow matches further apart
      ignoreLocation: true,  // Ignore where in the string the pattern appears
      useExtendedSearch: true, // Enable extended search
      minMatchCharLength: Math.min(2, searchText.length) // Adjust for very short queries
    });

    // Perform search
    const results = fuse.search(searchText);
    
    // Adjust relevance filter based on search length
    const maxScore = searchText.length <= 2 ? 0.4 : 0.8;
    const relevantResults = results.filter(result => !result.score || result.score < maxScore);
    
    // Return just the items, not the Fuse result objects
    return relevantResults.map(result => result.item);
  } catch (error) {
    console.error(`Error in fuzzy search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Fallback to basic filtering if fuzzy search fails
    const searchTermLower = searchText.toLowerCase().trim();
    return items.filter(item => 
      item.title.toLowerCase().includes(searchTermLower) || 
      item.keywords.some(keyword => keyword.toLowerCase().includes(searchTermLower))
    );
  }
};

/**
 * Filter items based on search text, tags, and instance
 * Uses fuzzy search with fallback to basic partial matching
 */
export const filterItems = (
  items: WorkflowItem[], 
  searchText: string,
  selectedTag: string | null,
  selectedInstance: string | null
) => {
  if (!searchText && !selectedTag && !selectedInstance) {
    return sortAlphabetically(items);
  }
  
  // Apply instance and tag filtering first
  let filteredItems = items;
  
  // Filter by instance if selected
  if (selectedInstance) {
    filteredItems = filteredItems.filter(item => item.instanceId === selectedInstance);
  }
  
  // Filter by tag if selected
  if (selectedTag) {
    filteredItems = filteredItems.filter(item => item.keywords.includes(selectedTag));
  }
  // Apply fuzzy search if there's search text
  if (searchText.trim()) {
    try {
      // Perform fuzzy search (now with built-in fallback)
      filteredItems = performFuzzySearch(filteredItems, searchText.trim());
    } catch (error) {
      console.error("Unexpected error in fuzzy search:", error);
      // This fallback should rarely be needed since performFuzzySearch has its own error handling
      const lowerSearchText = searchText.trim().toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.title.toLowerCase().includes(lowerSearchText) || 
        item.keywords.some(keyword => keyword.toLowerCase().includes(lowerSearchText))
      );
    }
  }
  
  // Create a Map to store unique workflows based on their uniqueKey (deduplicate)
  const uniqueWorkflows = new Map();
  filteredItems.forEach(item => {
    uniqueWorkflows.set(item.uniqueKey, item);
  });
  
  // Convert Map values back to array
  const filtered = Array.from(uniqueWorkflows.values());

  return sortAlphabetically(filtered);
};

/**
 * Sorts workflow items alphabetically by title
 */
export const sortAlphabetically = (items: WorkflowItem[]): WorkflowItem[] => {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
};

/**
 * Generate a consistent ID for an n8n instance based on its base URL
 */
export const generateInstanceId = (baseUrl: string): string => {
  const trimmedUrl = baseUrl.trim();
  if (!trimmedUrl) return "";
  
  return trimmedUrl
    .toLowerCase()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with single underscore
    .replace(/(^_+|_+$)/g, ''); // Remove leading/trailing underscores
};

/**
 * Gets a unique cache key for a specific n8n instance
 */
export const getCacheKeyForInstance = (instanceId: string): string => {
  return `designLogicSolutions.n8n.workflows.${instanceId}.v1`;
};

/**
 * Formats raw workflow data from the API into a standardized WorkflowItem structure
 */
export const formatWorkflowData = (workflow: WorkflowResponse["data"][0], instance: N8nInstance & { id: string }): WorkflowItem => {
  const tags = workflow.tags ? workflow.tags.map(tag => tag.name) : [];
  const accessory = tags.length ? tags.join(", ") : "No Tags";
  
  return {
    id: workflow.id,
    title: workflow.name,
    subtitle: `${instance.name} ${workflow.active ? "• Active" : "• Inactive"}`,
    accessory,
    keywords: tags,
    active: workflow.active,
    instanceId: instance.id,
    instanceName: instance.name,
    instanceColor: instance.color || "#0077b6",
    uniqueKey: `${instance.id}:${workflow.id}`
  };
};
