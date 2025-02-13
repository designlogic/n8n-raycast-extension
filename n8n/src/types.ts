export interface WorkflowItem {
  id: string;
  icon: { source: string };
  title: string;
  subtitle: string;
  accessory: string;
  keywords: string[];
}

export interface Preferences {
  apiKey: string;
}

export interface WorkflowResponse {
  data?: {
    id: string;
    name: string;
    active: boolean;
    tags: { name: string }[];
  }[];
} 