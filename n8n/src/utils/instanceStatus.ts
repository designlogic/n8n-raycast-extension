import { LocalStorage } from "@raycast/api";
import { testConnection } from "./connection";

const STATUS_CACHE_KEY = "n8n_instances_status";

interface InstanceStatus {
  instanceId: string;
  isActive: boolean;
  lastChecked: string;
  error?: string;
}

export async function getInstanceStatus(instanceId: string): Promise<InstanceStatus | null> {
  try {
    const statusData = await LocalStorage.getItem<string>(STATUS_CACHE_KEY);
    if (statusData) {
      const statuses = JSON.parse(statusData) as Record<string, InstanceStatus>;
      return statuses[instanceId] || null;
    }
  } catch (error) {
    console.error("Error reading instance status:", error);
  }
  return null;
}

export async function updateInstanceStatus(
  instanceId: string,
  baseUrl: string,
  apiKey: string
): Promise<InstanceStatus> {
  const testResult = await testConnection(baseUrl, apiKey);
  const status: InstanceStatus = {
    instanceId,
    isActive: testResult.success,
    lastChecked: new Date().toISOString(),
    error: testResult.success ? undefined : testResult.message
  };

  try {
    const statusData = await LocalStorage.getItem<string>(STATUS_CACHE_KEY);
    const statuses = statusData ? JSON.parse(statusData) : {};
    statuses[instanceId] = status;
    await LocalStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(statuses));
  } catch (error) {
    console.error("Error updating instance status:", error);
  }

  return status;
}

export async function updateAllInstanceStatuses(instances: { id: string; baseUrl: string; apiKey: string }[]): Promise<void> {
  const statuses: Record<string, InstanceStatus> = {};
  
  for (const instance of instances) {
    const status = await updateInstanceStatus(instance.id, instance.baseUrl, instance.apiKey);
    statuses[instance.id] = status;
  }

  await LocalStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(statuses));
}

export function getStatusIcon(status: InstanceStatus | null): string {
  if (!status) return "❓"; // Unknown status
  return status.isActive ? "🟢" : "🔴"; // Active or Error
}

// Auto-refresh status every 5 minutes
const STATUS_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

export function startStatusAutoRefresh(instances: { id: string; baseUrl: string; apiKey: string }[]): () => void {
  const intervalId = setInterval(() => {
    updateAllInstanceStatuses(instances).catch(console.error);
  }, STATUS_REFRESH_INTERVAL);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
