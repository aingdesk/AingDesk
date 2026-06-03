import { SearchResult } from "./utils";

const DEFAULT_BOCHA_SEARCH_API_URL = "https://api.bochaai.com/v1/web-search?utm_source=ollama";
const DEFAULT_BOCHA_SEARCH_RESULT_COUNT = 10;

const getBochaSearchResultCount = () => {
    const value = Number.parseInt(process.env.BOCHA_SEARCH_RESULT_COUNT || "", 10);
    if (Number.isNaN(value)) {
        return DEFAULT_BOCHA_SEARCH_RESULT_COUNT;
    }
    return Math.min(Math.max(value, 1), 20);
};

const getTextValue = (...values: any[]) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
};

export const mapBochaResponseToSearchResults = (response: any): SearchResult[] => {
    const values = response?.data?.webPages?.value || response?.webPages?.value || [];
    if (!Array.isArray(values)) {
        return [];
    }

    return values.map((item: any) => {
        const title = getTextValue(item?.name, item?.title);
        const link = getTextValue(item?.url, item?.displayUrl);
        const content = getTextValue(item?.summary, item?.snippet, item?.description);
        return { title, link, content };
    }).filter((result: SearchResult) => result.title && result.link);
};

// Bocha Web Search API provider.
export const localBochaSearch = async (query: string): Promise<SearchResult[]> => {
    const apiKey = process.env.BOCHA_SEARCH_API_KEY;
    if (!apiKey) {
        console.error("Bocha search request failed: BOCHA_SEARCH_API_KEY is not set");
        return [];
    }

    const url = process.env.BOCHA_SEARCH_API_URL || DEFAULT_BOCHA_SEARCH_API_URL;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                freshness: "noLimit",
                summary: true,
                count: getBochaSearchResultCount(),
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            console.error(`Bocha search request failed: HTTP ${response.status}`);
            return [];
        }

        const jsonRes = await response.json();
        return mapBochaResponseToSearchResults(jsonRes);
    } catch (error) {
        console.error("Bocha search request failed:", error);
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
};
