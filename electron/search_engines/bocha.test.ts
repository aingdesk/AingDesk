import { describe, expect, test } from "vitest";
import { mapBochaResponseToSearchResults } from "./bocha";
import { searchEngines } from "./search";

describe("bocha search engine", () => {
    test("maps Bocha web search results to AingDesk search results", () => {
        const response = {
            data: {
                webPages: {
                    value: [
                        {
                            name: "Bocha result",
                            url: "https://example.com/bocha",
                            summary: "Result summary",
                        },
                        {
                            title: "Fallback title",
                            displayUrl: "https://example.com/fallback",
                            snippet: "Fallback snippet",
                        },
                        {
                            name: "",
                            url: "https://example.com/empty-title",
                            summary: "Ignored because title is empty",
                        },
                    ],
                },
            },
        };

        expect(mapBochaResponseToSearchResults(response)).toEqual([
            {
                title: "Bocha result",
                link: "https://example.com/bocha",
                content: "Result summary",
            },
            {
                title: "Fallback title",
                link: "https://example.com/fallback",
                content: "Fallback snippet",
            },
        ]);
    });

    test("registers Bocha as a built-in search provider", () => {
        expect(searchEngines).toHaveProperty("bocha");
    });
});
