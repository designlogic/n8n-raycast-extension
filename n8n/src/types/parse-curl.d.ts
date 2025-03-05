declare module 'parse-curl' {
  interface ParsedCurl {
    url?: string;
    method?: string;
    header?: Record<string, string>;
    body?: string;
  }

  function parseCurl(curlCommand: string): ParsedCurl;
  export default parseCurl;
} 