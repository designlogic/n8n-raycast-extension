import { N8nInstance } from "./types";

export const CACHE_KEY = "designLogicSolutions.n8n.workflows.v2";
export const INSTANCE_CACHE_KEY = "designLogicSolutions.n8n.instances.v1";
export const TAGS_CACHE_KEY = "designLogicSolutions.n8n.tags.v1";

const sanitizeBaseUrl = (url: string): string => {
  return url.replace(/\/+$/, '');
};

export const getApiEndpoints = (instance: N8nInstance) => {
  const sanitizedUrl = sanitizeBaseUrl(instance.baseUrl);
  return {
    workflows: `${sanitizedUrl}/api/v1/workflows`,
    workflowUrl: (id: string) => `${sanitizedUrl}/workflow/${id}`,
    tags: `${sanitizedUrl}/api/v1/tags`,
  } as const;
};

export const DEFAULT_INSTANCE_COLORS = [
  "#FF6B6B",  // Red
  "#4ECDC4",  // Teal
  "#45B7D1",  // Blue
  "#96CEB4",  // Green
  "#FFBE0B",  // Yellow
  "#FF006E",  // Pink
  "#8338EC",  // Purple
  "#3A86FF",  // Royal Blue
];

export const getDefaultInstanceColor = (index: number): string => {
  const length = DEFAULT_INSTANCE_COLORS.length;
  // Handle negative indices by wrapping around from the end
  const normalizedIndex = ((index % length) + length) % length;
  return DEFAULT_INSTANCE_COLORS[normalizedIndex];
};
