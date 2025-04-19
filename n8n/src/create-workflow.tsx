import { showToast, Toast, openCommandPreferences, open, Cache, LocalStorage } from "@raycast/api";
import fetch from "node-fetch";
import { N8nInstance } from "./types";
import { getApiEndpoints, CACHE_KEY } from "./config";
import { generateInstanceId } from "./utils";

interface CreateWorkflowArguments {
  name?: string;
  instance?: string;
}

const INSTANCES_STORAGE_KEY = "n8n_instances";

interface StoredInstance extends N8nInstance {
  id: string;
}

export default async function Command(props: { arguments: CreateWorkflowArguments }) {
  const cache = new Cache();

  if (!props.arguments.name) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Name is required",
    });
    return;
  }

  // Load instances
  const storedInstances = await LocalStorage.getItem<string>(INSTANCES_STORAGE_KEY);
  const instances: StoredInstance[] = storedInstances ? JSON.parse(storedInstances) : [];

  if (instances.length === 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No n8n instances configured",
      message: "Use the 'Manage n8n Instances' command to add your first instance",
    });
    return;
  }

  // Select instance
  let selectedInstance: StoredInstance;
  if (props.arguments.instance) {
    // Try to find instance by name or ID
    selectedInstance = instances.find(
      i => i.name.toLowerCase() === props.arguments.instance?.toLowerCase() || 
           i.id === generateInstanceId(props.arguments.instance || "")
    ) || instances[0];
  } else {
    // Use first instance if only one exists, otherwise show error
    if (instances.length === 1) {
      selectedInstance = instances[0];
    } else {
      await showToast({
        style: Toast.Style.Failure,
        title: "Instance required",
        message: `Please specify an instance: ${instances.map(i => i.name).join(", ")}`,
      });
      return;
    }
  }

  const API_ENDPOINTS = getApiEndpoints(selectedInstance);

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `Creating workflow in ${selectedInstance.name}...`,
  });

  try {
    const requestBody = {
      name: props.arguments.name,
      nodes: [],
      connections: {
        main: []
      },
      settings: {
        saveExecutionProgress: true,
        saveManualExecutions: true,
        saveDataErrorExecution: "all",
        saveDataSuccessExecution: "all",
        executionTimeout: 3600
      },
      staticData: {}
    };

    const response = await fetch(API_ENDPOINTS.workflows, {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": selectedInstance.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? `Invalid API key for instance ${selectedInstance.name}. Please check your API key in instance settings.`
          : `Failed to create workflow: ${response.statusText}`
      );
    }

    const data = JSON.parse(responseText) as { id: string };

    // Clear the cache so the new workflow shows up in search
    await cache.remove(CACHE_KEY);

    toast.style = Toast.Style.Success;
    toast.title = "Workflow created";
    toast.message = `Opening ${props.arguments.name} in ${selectedInstance.name}`;

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const url = API_ENDPOINTS.workflowUrl(data.id);
    await open(url);

  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to create workflow";
    toast.message = error instanceof Error ? error.message : "Unknown error occurred";

    if (error instanceof Error && error.message.includes("API key")) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await openCommandPreferences();
    }
  }
}
