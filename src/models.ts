import { Ollama } from "ollama";
import { remark } from "remark";
import removeComments from 'remark-remove-comments';
import { readFileSync } from "node:fs";
import { ObjectId } from "mongodb";
import { conversations } from "./db.js";

const SYSTEM_PROMPT = remark()
    .use(removeComments)
    .process(readFileSync('PROMPT.md','utf-8'), (err, file) => {
        if (err) throw err;
        console.log(String(file));
    });

const OLLAMA = new Ollama({ host: '192.168.3.211:11434' });

export const MODEL_MAPPINGS = [
    {
        client_name: "Helix Fast",
        client_description: "Primary, conversational",
        model_name: "gemma4:e2b",
        tools_enabled: true,
        id: 'helix-fast-1',
        thinking_enabled: true,
        ctx: 32768
    },
    {
        client_name: "Helix Medical",
        client_description: "Medical, informative",
        model_name: "medgemma:4b",
        tools_enabled: false,
        id: 'helix-medical-1',
        thinking_enabled: false,
        ctx: 32768
    },
    {
        client_name: "Helix Intellect",
        client_description: "Secondary, smart",
        model_name: "gemma4:12b",
        tools_enabled: true,
        id: 'helix-intellect-1',
        thinking_enabled: true,
        ctx: 32768
    },
    {
        client_name: "Helix Ground",
        client_description: "Efficient, reasoned",
        model_name: "nemotron-3-nano:4b",
        tools_enabled: false,
        id: 'helix-ground-1',
        thinking_enabled: false,
        ctx: 32768
    },
    {
        client_name: "Helix Turbo",
        client_description: "Mobile, fast",
        model_name: "sam860/LFM2.5:1.2b",
        tools_enabled: true,
        id: 'helix-turbo-1',
        thinking_enabled: false,
        ctx: 65536
    },
    {
        client_name: "Helix Coding",
        client_description: "Best in house at programming",
        model_name: "ornith-1.5:9b",
        tools_enabled: false,
        id: 'helix-coding-1',
        thinking_enabled: true,
        ctx: 32768
    },
    {
        client_name: "Helix Max",
        client_description: "Best in house at conversation",
        model_name: "qwen3:14b",
        tools_enabled: true,
        id: 'helix-max-1',
        thinking_enabled: true,
        ctx: 32768
    }
];

type OllamaMessage =
    | { role: "user" | "assistant"; content: string }
    | { role: "assistant"; content: string; tool_calls: { id: string; type: string; function: { name: string; arguments: Record<string, unknown> } }[] }
    | { role: "tool"; content: string };

export async function buildHistory(conversationId: ObjectId): Promise<OllamaMessage[]> {
    const convo = await conversations.findOne({ _id: conversationId });
    if (!convo) return [];
    return convo.messages.flatMap((msg): OllamaMessage[] => {
        if (msg.toolCalls?.length) {
            return [
                {
                    role: 'assistant' as const,
                    content: '',
                    tool_calls: msg.toolCalls.map(t => ({
                        id: t.id,
                        type: 'function',
                        function: {
                            name: t.name,
                            arguments: t.input
                        }
                    }))
                },
                ...msg.toolCalls.map(t => ({
                    role: 'tool' as const,
                    content: JSON.stringify(t.output ?? t.error)
                }))
            ]
        }
        return [{
            role: msg.role as "user"|"assistant",
            content: msg.content ?? ""
        }];
    });
}

export async function* runModel(message: OllamaMessage[], model: string, tools: any[] = []) {
    let aM = MODEL_MAPPINGS.find(a => a.id == model);
    if (!aM) return;
    const llama = await OLLAMA.chat({
        model: aM.model_name,
        stream: true,
        messages: [
            {"role": "system", "content": SYSTEM_PROMPT || "You are Helix, a helpful personal assistant."},
            ...message
        ],
        options: {
            num_ctx: aM.ctx,
            temperature: 0.7
        },
        think: aM.thinking_enabled,
        tools: aM.tools_enabled ? tools : []
    });
    let thinkingActivated = false;
    let receivedChunks = 0;
    const startTime = performance.now();

    for await (const chunk of llama) {
        if (chunk.message.tool_calls?.length) {
            yield "data: " + JSON.stringify({
                type: "chunk:tool_calls",
                tool_calls: chunk.message.tool_calls
            }) + "\n\n";
            return;
        }
        if (chunk.message.thinking && !thinkingActivated) {
            // is in thinking mode
            thinkingActivated = true;
            receivedChunks++;
            const elapsedSeconds = (performance.now() - startTime) / 1000;
            const currentTPS = receivedChunks / elapsedSeconds;
            yield "data: " + JSON.stringify({ type: "chunk:think_start" }) + "\n\n";
            yield "data: " + JSON.stringify({ type: "chunk:think_text", text: chunk.message.thinking, tps: currentTPS, elapsedSeconds }) + "\n\n";
        } else if (chunk.message.thinking && thinkingActivated) {
            receivedChunks++;
            const elapsedSeconds = (performance.now() - startTime) / 1000;
            const currentTPS = receivedChunks / elapsedSeconds;
            yield "data: " + JSON.stringify({ type: "chunk:think_text", text: chunk.message.thinking, tps: currentTPS, elapsedSeconds }) + "\n\n";
        } else if (chunk.message.content && thinkingActivated) {
            thinkingActivated = false;
            yield "data: " + JSON.stringify({ type: "chunk:think_end" }) + "\n\n";
        }
        if (chunk.message.content) {
            receivedChunks++;
            const elapsedSeconds = (performance.now() - startTime) / 1000;
            const currentTPS = receivedChunks / elapsedSeconds;
            let payload = { type: "chunk:text", text: chunk.message.content, tps: currentTPS, elapsedSeconds };
            yield "data: " + JSON.stringify(payload) + "\n\n";
        }
        if (chunk.done) {
            const totalTokens = chunk.eval_count; 
            const durationInSeconds = chunk.eval_duration / 1_000_000_000; 
            const officialTPS = totalTokens / durationInSeconds;
            yield "data: " + JSON.stringify({ type: "end:statistics", out_tokens: totalTokens, tps: officialTPS, dur: durationInSeconds }) + "\n\n";
            yield "data: [DONE]\n\n";
        }
    }
    return;
}