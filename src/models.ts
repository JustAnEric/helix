export const MODEL_MAPPINGS = [
    {
        client_name: "Primary, conversational",
        model_name: "gemma4:e2b",
        tools_enabled: true
    },
    {
        client_name: "Medical, informative",
        model_name: "medgemma:4b",
        tools_enabled: false
    },
    {
        client_name: "Secondary, smart",
        model_name: "gemma4:12b",
        tools_enabled: true
    },
    {
        client_name: "Efficient, reasoned",
        model_name: "nemotron-3-nano:4b",
        tools_enabled: false
    },
    {
        client_name: "Mobile, fast",
        model_name: "sam860/LFM2:700m",
        tools_enabled: false
    }
];