export const CACHE_KEY = "designLogicSolutions.n8n.workflows.v1";
export const API_BASE_URL = "https://workflow.sanctifai.com";

export const API_ENDPOINTS = {
  workflows: `${API_BASE_URL}/api/v1/workflows`,
  workflowUrl: (id: string) => `${API_BASE_URL}/workflow/${id}`,
} as const; 