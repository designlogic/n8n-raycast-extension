export interface N8nInstance {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  color?: string;
}

export interface Preferences {
  instances: N8nInstance[];
}

export interface WorkflowItem {
  id: string;
  instanceId: string;
  instanceName: string;
  instanceColor?: string;
  icon: { source: string };
  title: string;
  subtitle: string;
  accessory: string;
  keywords: string[];
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
