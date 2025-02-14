import { showToast, Toast, getPreferenceValues, openCommandPreferences, open } from "@raycast/api";
import { useEffect } from "react";
import fetch from "node-fetch";
import { Preferences } from "./types";
import { getApiEndpoints } from "./config";

interface CreateWorkflowArguments {
  name?: string;
  tags?: string;
}

export default function Command(props: { arguments: CreateWorkflowArguments }) {
  useEffect(() => {
    let isSubscribed = true;
    
    async function createWorkflow() {
      const preferences = getPreferenceValues<Preferences>();
      const API_ENDPOINTS = getApiEndpoints(preferences.baseUrl);

      if (!props.arguments.name) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Name is required",
        });
        return;
      }

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Creating workflow...",
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
            "X-N8N-API-KEY": preferences.apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Invalid API key. Please check your n8n API key in extension preferences."
              : `Failed to create workflow: ${response.statusText}`
          );
        }

        const data = JSON.parse(responseText) as { id: string };
        
        if (!isSubscribed) return;

        toast.style = Toast.Style.Success;
        toast.title = "Workflow created";
        toast.message = `Opening ${props.arguments.name} in browser`;

        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!isSubscribed) return;
        
        const url = API_ENDPOINTS.workflowUrl(data.id);
        await open(url);

      } catch (error) {
        if (!isSubscribed) return;
        toast.style = Toast.Style.Failure;
        toast.title = "Failed to create workflow";
        toast.message = error instanceof Error ? error.message : "Unknown error occurred";

        if (error instanceof Error && error.message.includes("API key")) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await openCommandPreferences();
        }
      }
    }

    createWorkflow();

    return () => {
      isSubscribed = false;
    };
  }, [props.arguments]);

  return null;
} 