import express, { Request, Response } from "express";
import path from "node:path";
import { MODEL_MAPPINGS, runModel } from "./models.js";

const app = express();

const __dirname = import.meta.dirname;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'website', 'static'), { dotfiles: "ignore" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (request: Request, response: Response) => {
    response.render('index');
});

app.get("/api/models", (request: Request, response: Response) => {
    response.json({
        success: true,
        models: MODEL_MAPPINGS.map((model: any) => {return{ name: model.client_name, description: model.client_description, id: model.id }})
    });
});

app.post("/api/model", async (request: Request, response: Response) => {
    const { model, message, conversationId } = request.body;

    if (!MODEL_MAPPINGS.some(a => a.id == model)) {
        return response.status(401).json({
            success: false,
            error: `No such model: ${model}`
        });
    }

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');

    const modelRun = runModel(message, model);

    for await (const line of modelRun) {
        response.write(line);
    }

    request.on('close', () => {
        response.end();
        console.log("Client disconnected from response AI stream");
    });
});

app.listen(80, '0.0.0.0');