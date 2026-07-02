import { withTimeout, SearchResult, FETCH_HEADERS, getUrlsContent } from "./utils";

// You.com Search API endpoint
const SEARCH_API_URL = "https://ydc-index.io/v1/search";

// Build request URL for You.com Search
export const buildYouChannelsUrl = (query: string): string => {
    return `${SEARCH_API_URL}?query=${encodeURIComponent(query)}`;
};

// Local You.com Search function
export const localYouchannelsSearch = async (query: string): Promise<SearchResult[]> => {
    try {
        const apiKey = process.env.YDC_API_KEY;
        if (!apiKey) {
            console.error("YDC_API_KEY environment variable is not set");
            return [];
        }

        const url = buildYouChannelsUrl(query);
        const response = await withTimeout(
            fetch(url, {
                signal: new AbortController().signal,
                headers: {
                    ...FETCH_HEADERS,
                    "X-API-Key": apiKey,
                },
            }),
            10000
        );

        if (!response.ok) {
            console.error(`You.com Search API error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        // Parse You.com search response into SearchResult[]
        // Response format: { results: { web: [{ url, title, description, snippets, ... }] } }
        const webResults = data.results?.web || [];
        const searchResults: SearchResult[] = webResults.map((result: any) => ({
            title: result.title || "",
            link: result.url || "",
            content: result.description || result.snippets?.[0] || "",
        }));

        return getUrlsContent(searchResults);
    } catch (error) {
        console.error("You.com Search request failed:", error);
        return [];
    }
};
