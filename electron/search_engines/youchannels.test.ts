import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock the utils module before importing youchannels
vi.mock('./utils', () => ({
    withTimeout: vi.fn((promise) => promise),
    FETCH_HEADERS: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html",
    },
    getUrlsContent: vi.fn((results) => Promise.resolve(results)),
}));

import { localYouchannelsSearch, buildYouChannelsUrl } from './youchannels';

describe('You.com Search Provider', () => {
    const mockApiKey = 'test-api-key';
    const mockQuery = 'test query';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('YDC_API_KEY', mockApiKey);
    });

    describe('buildYouChannelsUrl', () => {
        it('should encode the query parameter', () => {
            const url = buildYouChannelsUrl('AI assistants');
            expect(url).toContain('query=AI%20assistants');
        });

        it('should use the correct endpoint', () => {
            const url = buildYouChannelsUrl(mockQuery);
            expect(url).toBe('https://ydc-index.io/v1/search?query=test%20query');
        });
    });

    describe('localYouchannelsSearch', () => {
        it('should return empty array when YDC_API_KEY is not set', async () => {
            vi.stubEnv('YDC_API_KEY', '');
            const results = await localYouchannelsSearch(mockQuery);
            expect(results).toEqual([]);
        });

        it('should parse web results correctly', async () => {
            const mockResponse = {
                results: {
                    web: [
                        {
                            url: 'https://example.com',
                            title: 'Example Title',
                            description: 'Example description text',
                            snippets: ['Snippet 1', 'Snippet 2'],
                        },
                        {
                            url: 'https://example2.com',
                            title: 'Second Result',
                            description: 'Another description',
                            snippets: [],
                        },
                    ],
                },
            };

            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });
            global.fetch = mockFetch;

            const results = await localYouchannelsSearch(mockQuery);

            expect(mockFetch).toHaveBeenCalledOnce();
            const calledUrl = mockFetch.mock.calls[0][0];
            const calledHeaders = mockFetch.mock.calls[0][1].headers;
            expect(calledUrl).toContain('ydc-index.io/v1/search');
            expect(calledHeaders['X-API-Key']).toBe(mockApiKey);
            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({
                title: 'Example Title',
                link: 'https://example.com',
                content: 'Example description text',
            });
            expect(results[1]).toEqual({
                title: 'Second Result',
                link: 'https://example2.com',
                content: 'Another description',
            });
        });

        it('should fall back to snippets[0] when description is missing', async () => {
            const mockResponse = {
                results: {
                    web: [
                        {
                            url: 'https://example.com',
                            title: 'Title Only',
                            snippets: ['Fallback snippet'],
                        },
                    ],
                },
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const results = await localYouchannelsSearch(mockQuery);
            expect(results[0].content).toBe('Fallback snippet');
        });

        it('should return empty array on non-ok response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            });

            const results = await localYouchannelsSearch(mockQuery);
            expect(results).toEqual([]);
        });

        it('should return empty array when results.web is missing', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ results: {} }),
            });

            const results = await localYouchannelsSearch(mockQuery);
            expect(results).toEqual([]);
        });

        it('should return empty array on fetch error', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const results = await localYouchannelsSearch(mockQuery);
            expect(results).toEqual([]);
        });
    });
});
