import { showToast, Toast, getPreferenceValues, openCommandPreferences, open, Cache } from "@raycast/api";
import fetch from "node-fetch";
import { Preferences, N8nInstance } from "./types";
import { getApiEndpoints, CACHE_KEY } from "./config";
import { generateInstanceId } from "./utils";

interface CreateWorkflowArguments {
  name?: string;
  instance?: string;
}

export default async function Command(props: { arguments: CreateWorkflowArguments }) {
  const preferences = getPreferenceValues<Preferences>();
  const cache = new Cache();

  if (!props.arguments.name) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Name is required",
    });
    return;
  }

  // Ensure instances have IDs
  const instances: N8nInstance[] = preferences.instances.map(instance => ({
    ...instance,
    id: generateInstanceId(instance.baseUrl)
  }));

  // If no instance specified and there's only one instance, use it
  // Otherwise, show instance selection toast
  let selectedInstance: N8nInstance;
  if (instances.length === 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No n8n instances configured",
      message: "Please configure at least one n8n instance in preferences",
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await openCommandPreferences();
    return;
  } else if (instances.length === 1) {
    selectedInstance = instances[0];
  } else if (props.arguments.instance) {
    selectedInstance = instances.find(i => 
      i.name.toLowerCase() === props.arguments.instance?.toLowerCase() ||
      i.id === props.arguments.instance
    ) || instances[0];
  } else {
    // Show instance selection toast
    await showToast({
      style: Toast.Style.Failure,
      title: "Instance required",
      message: `Please specify an instance: ${instances.map(i => i.name).join(", ")}`,
    });
    return;
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
          ? `Invalid API key for instance ${selectedInstance.name}. Please check your n8n API key in extension preferences.`
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
