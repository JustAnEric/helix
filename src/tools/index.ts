import { webSearch } from "./web_search.js";

export interface Tool {
    definition: {
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, any>;
        }
    };
    execute: (input: Record<string, any>) => Promise<any>
};

const TOOLS: Record<string, Tool> = {
    web_search: webSearch
};

export const toolDefn = Object.values(TOOLS).map(t => t.definition);
export async function executeTool(name: string, input: Record<string, any>) {
    const tool = TOOLS[name];
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.execute(input);
}