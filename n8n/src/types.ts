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
  baseUrl: string;
}

export interface WorkflowResponse {
  data?: {
    id: string;
    name: string;
    active: boolean;
    tags: { name: string }[];
  }[];
}

export interface Tag {
  id: string;
  name: string;
}

export interface TagsResponse {
  data: Tag[];
} 