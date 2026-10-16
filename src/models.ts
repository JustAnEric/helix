import { Ollama } from "ollama";

const OLLAMA = new Ollama({ host: '192.168.3.211:11434' });

export const MODEL_MAPPINGS = [
    {
        client_name: "Helix Fast",
        client_description: "Primary, conversational",
        model_name: "gemma4:e2b",
        tools_enabled: true,
        id: 'helix-fast-1',
        thinking_enabled: true
    },
    {
        client_name: "Helix Medical",
        client_description: "Medical, informative",
        model_name: "medgemma:4b",
        tools_enabled: false,
        id: 'helix-medical-1',
        thinking_enabled: false
    },
    {
        client_name: "Helix Intellect",
        client_description: "Secondary, smart",
        model_name: "gemma4:12b",
        tools_enabled: true,
        id: 'helix-intellect-1',
        thinking_enabled: true
    },
    {
        client_name: "Helix Ground",
        client_description: "Efficient, reasoned",
        model_name: "nemotron-3-nano:4b",
        tools_enabled: false,
        id: 'helix-ground-1',
        thinking_enabled: false
    },
    {
        client_name: "Helix Turbo",
        client_description: "Mobile, fast",
        model_name: "sam860/LFM2:700m",
        tools_enabled: false,
        id: 'helix-turbo-1',
        thinking_enabled: false
    },
    {
        client_name: "Helix Coding",
        client_description: "Best in house at programming",
        model_name: "ornith-1.5:9b",
        tools_enabled: false,
        id: 'helix-coding-1',
        thinking_enabled: true
    },
    {
        client_name: "Helix Max",
        client_description: "Best in house at conversation",
        model_name: "qwen3:14b",
        tools_enabled: false,
        id: 'helix-max-1',
        thinking_enabled: true
    }
];

export async function* runModel(message: string, model: string) {
    let aM = MODEL_MAPPINGS.find(a => a.id == model);
    if (!aM) return;
    const llama = await OLLAMA.chat({
        model: aM.model_name,
        stream: true,
        messages: [
            {"role": "system", "content": "You are Helix, a helpful AI assistant. You should acknowledge yourself as Helix when the user asks, you are a large language model developed by JustAnEric."},
            {"role": "user", "content": message}
        ],
        options: {
            num_ctx: 32768,
            temperature: 0.7
        },
        think: aM.thinking_enabled
    });
    let thinkingActivated = false;
    for await (const chunk of llama) {
        if (chunk.message.content) {
            yield "data: " + JSON.stringify({ type: "chunk:text", text: chunk.message.content }) + "\n\n";
        }
        if (chunk.message.thinking && !thinkingActivated) {
            // is in thinking mode
            thinkingActivated = true;
            yield "data: " + JSON.stringify({ type: "chunk:think_start" }) + "\n\n";
        } else if (chunk.message.content && thinkingActivated) {
            thinkingActivated = false;
            yield "data: " + JSON.stringify({ type: "chunk:think_end" }) + "\n\n";
        }
        if (chunk.done) yield "data: [DONE]\n\n";
    }
    return;
}