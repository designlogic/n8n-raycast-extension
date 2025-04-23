import fetch from "node-fetch";

export async function testConnection(baseUrl: string, apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    // Clean up the URL
    const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
    const testUrl = `${cleanUrl}/api/v1/workflows`;

    // Test the connection
    const response = await fetch(testUrl, {
      headers: {
        "X-N8N-API-KEY": apiKey,
        "Accept": "application/json"
      },
      timeout: 5000 // 5 second timeout
    });

    if (response.ok) {
      return { success: true, message: "Connection successful! API key is valid." };
    } else if (response.status === 401) {
      return { success: false, message: "API key is invalid." };
    } else {
      return { success: false, message: `Server returned status ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND')) {
        return { success: false, message: "Could not resolve host. Please check the URL." };
      } else if (error.message.includes('ECONNREFUSED')) {
        return { success: false, message: "Connection refused. Is the n8n instance running?" };
      } else if (error.message.includes('timeout')) {
        return { success: false, message: "Connection timed out. Is the server responding?" };
      }
      return { success: false, message: `Connection error: ${error.message}` };
    }
    return { success: false, message: "Unknown connection error occurred" };
  }
}
