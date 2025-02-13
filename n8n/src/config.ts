export const CACHE_KEY = "designLogicSolutions.n8n.workflows.v1";

const sanitizeBaseUrl = (url: string): string => {
  return url.replace(/\/+$/, '');
};

export const getApiEndpoints = (baseUrl: string) => {
  const sanitizedUrl = sanitizeBaseUrl(baseUrl);
  return {
    workflows: `${sanitizedUrl}/api/v1/workflows`,
    workflowUrl: (id: string) => `${sanitizedUrl}/workflow/${id}`,
  } as const;
}; 