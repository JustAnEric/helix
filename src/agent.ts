import { buildHistory, runModel } from "./models.js";
import { toolDefn, executeTool } from "./tools/index.js";
import { conversations } from "./db.js";
import { ObjectId } from "mongodb";

export async function runAgent(convId: ObjectId, owner: Record<string, unknown>, response: import("express").Response, model: string) {
    const MAX_ITER = 10;
    let iter = 0;
    while (iter++ < MAX_ITER) {
        const history = await buildHistory(convId);
        const modelRun = runModel(history, model, toolDefn);
        let fullResp = "";
        let fullThink = "";
        let isThinking = false;
        let toolCalls: any[] = [];
        for await (const line of modelRun) {
            response.write(line);
            if (line.includes("[DONE]")) continue;
            const jsonStr = line.replace(/^data: /,"").trim();
            if (!jsonStr) continue;
            try {
                const payload = JSON.parse(jsonStr);
                if(payload.type === "chunk:think_start") isThinking = true;
                if(payload.type === "chunk:think_end") isThinking = false;
                if(payload.type === "chunk:text") fullResp += payload.text;
                if(payload.type === "chunk:think_text") fullThink += payload.text;
                if(payload.type === "chunk:tool_calls") {
                    toolCalls = payload.tool_calls;
                }
            } catch {}
        }
        if (!toolCalls.length) {
            await conversations.updateOne(
                { _id: convId },
                {
                    $push: { 
                        messages: {
                            role: "assistant",
                            content: fullResp,
                            thinking: fullThink || null,
                            toolCalls: [],
                            createdAt: new Date()
                        } 
                    },
                    $set: {
                        status: "done",
                        updatedAt: new Date()
                    }
                }
            );
            return;
        }
        const execToolCalls = [];
        for (const t of toolCalls) {
            const name = t.function.name;
            const input = t.function.arguments;
            const startDate = new Date();
            response.write("data: " + JSON.stringify({ type: "chunk:tool_start", tool: name }) + "\n\n");
            try {
                const output = await executeTool(name, input);
                execToolCalls.push({ id: t.id, name, input, output, status: "success", error: null, startedAt: startDate, finishedAt: new Date() });
                response.write("data: " + JSON.stringify({ type: "chunk:tool_done", tool: name }) + "\n\n");
            } catch (err:any) {
                execToolCalls.push({ id: t.id, name, input, output: null, status: "error", error: err.message, startedAt: startDate, finishedAt: new Date() });
                response.write("data: " + JSON.stringify({ type: "chunk:tool_error", tool: name, error: err.message }) + "\n\n");
            }
        }
        await conversations.updateOne(
            { _id: convId },
            {
                $push: {
                    messages: {
                        role: "assistant",
                        content: null, thinking: null,
                        toolCalls: (execToolCalls as any),
                        createdAt: new Date()
                    }
                }
            }
        );
    }
    await conversations.updateOne(
        { _id: convId },
        {
            $set: {
                status: "error",
                updatedAt: new Date()
            }
        }
    );
    response.write("data: " + JSON.stringify({ type: "error", message: "Max iterations reached" }) + "\n\n");
}