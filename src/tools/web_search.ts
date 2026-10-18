import { Tool } from "./index.js";
export const webSearch: Tool = {
    definition: {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for current information",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The search query" }
                },
                required: ["query"]
            }
        }
    },
    async execute(input: Record<string, any>) {
        const { query } = input as { query: string };
        console.log("web_search executing with query:", query);
        
        const searxngURI = process.env.SEARXNG_URI;
        console.log("SearXNG URI:", searxngURI);
        
        if (!searxngURI) return { error: "SearXNG not configured; don't attempt to run this tool again and please tell the user about this!" };
        
        const url = `${searxngURI}/search?q=${encodeURIComponent(query)}&format=json`;
        console.log("Fetching:", url);
        
        try {
            const req = await fetch(url, { method: 'GET', headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            } });
            console.log("Response status:", req.status);
            const json: any = await req.json();
            console.log("Result count:", json.results?.length);
            const resultContent = json.results.slice(0, 10).map((a: any) => ({ url: a.url, title: a.title, content: a.content, category: a.category }));
            return { results: resultContent };
        } catch (err) {
            console.error("web_search fetch failed:", err);
            return { error: String(err) };
        }
    }
}