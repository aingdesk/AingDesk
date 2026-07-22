import { withTimeout, SearchResult, FETCH_HEADERS } from "./utils";

// You.com Search API integration
// Docs: https://you.com/docs/api-reference/search/v1-search

const YOU_COM_API_URL = "https://api.you.com/v1/search";

/**
 * Get You.com API key from the models config (following existing pattern).
 * Falls back to YDC_API_KEY env var for development/testing.
 */
const getApiKey = (): string | undefined => {
    try {
        const configPath = pub.get_data_path();
        const fs = require("fs");
        const path = require("path");
        const youcomConfigPath = path.join(configPath, "models", "youcom", "config.json");
        if (fs.existsSync(youcomConfigPath)) {
            const config = JSON.parse(fs.readFileSync(youcomConfigPath, "utf-8"));
            return config.apiKey;
        }
    } catch (e) {
        // fallback to env var
    }
    return process.env.YDC_API_KEY;
};

const getUserAgent = (): string => {
    // Follow the integration-tracking skill convention:
    // youdotcom-integration/<owner>-<repo>
    // Append to existing UA rather than replacing
    const extra = "youdotcom-integration/cooperation-org-aingdesk";
    const existing = FETCH_HEADERS["User-Agent"];
    return `${existing} ${extra}`;
};

// You.com search function
export const localYouComSearch = async (query: string): Promise<SearchResult[]> => {
    try {
        const apiKey = getApiKey();
        const headers: Record<string, string> = {
            ...FETCH_HEADERS,
            "User-Agent": getUserAgent(),
        };
        if (apiKey) {
            headers["X-API-Key"] = apiKey;
        }

        const url = `${YOU_COM_API_URL}?query=${encodeURIComponent(query)}&count=10`;
        const response = await withTimeout(
            fetch(url, { signal: new AbortController().signal, headers }),
            15000
        );

        if (!response.ok) {
            console.error(`You.com API error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        // Parse You.com response format:
        // { results: { web: [{ title, url, description, snippets }] } }
        const results = data.results?.web || [];

        return results.map((item: any) => {
            // Build content from description + snippets
            const description = item.description || "";
            const snippets = Array.isArray(item.snippets) ? item.snippets.join(" ") : "";
            const content = [description, snippets].filter(Boolean).join(" — ");

            return {
                title: item.title || "",
                link: item.url || "",
                content: content,
            };
        });
    } catch (error) {
        console.error("You.com search failed:", error);
        return [];
    }
};
