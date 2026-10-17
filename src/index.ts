import 'dotenv/config';
import express, { Request, Response } from "express";
import path from "node:path";
import crypto from "crypto";
import { MODEL_MAPPINGS, runModel } from "./models.js";
import jwt from "jsonwebtoken";
import { v7 as uuidv7 } from "uuid";
import util from "util";

const app = express();

const __dirname = import.meta.dirname;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'website', 'static'), { dotfiles: "ignore" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const verifyJwtAsync = (token: string, secret: string, options = {}) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, options, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded);
        });
    });
};

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
    const token = request.headers.authorization;
    const cfConnectingIp = request.headers['cf-connecting-ip'];

    if (!cfConnectingIp) {
        return response.status(400).json({
            success: false,
            error: 'No CF',
            cd: '(?)'
        });
    }

    if (!token) {
        return response.status(401).json({
            success: false,
            error: 'No token',
            cd: '(!)'
        });
    } else {
        const jwtStr = token.split(/\s/, 2)[1];
        if (!jwtStr) return response.status(401).json({
            success: false,
            error: 'No token',
            cd: '(!!)'
        });

        try {
            const jwtV = await verifyJwtAsync(jwtStr, process.env.JWT_SECRET || 'fallback', {
                issuer: 'https://helix.auth.erikku.page', audience: 'https://helix.erikku.page'
            });

            if ((jwtV as any).ip !== cfConnectingIp) { // some client security
                return response.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    cd: '(-)'
                });
            }
        } catch (err: any) {
            console.error("JWT Verification Failed:", err.message);
            return response.status(401).json({
                success: false,
                error: 'Invalid token',
                cd: '(-)'
            });
        }
    }

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

app.post("/api/tokens", async (request: Request, response: Response) => {
    const cfConnectingIp = request.headers['cf-connecting-ip'];
    const body = request.body;
    const { gpuSig, core } = body.computer;

    if (!cfConnectingIp) {
        return response.status(400).json({
            success: false,
            error: 'No CF',
            cd: '(?)'
        });
    }
    
    const hashContent = `H${cfConnectingIp}|${gpuSig}|${core}`;
    const hash = crypto.createHash('sha256').update(hashContent).digest('hex');
    const correlation = uuidv7();

    console.log("Unique Device Hash:", hash);

    const token = jwt.sign(
        {
            hash,
            ip: cfConnectingIp,
            correlation,
            type: 'guest'
        }, 
        process.env.JWT_SECRET || 'fallback', 
        { expiresIn: '3d', issuer: 'https://helix.auth.erikku.page', audience: 'https://helix.erikku.page' }
    );

    return response.json({
        dev_hash: hash,
        token
    });
});

app.get("/api/tokens", async (request: Request, response: Response) => {
    const cfConnectingIp = request.headers['cf-connecting-ip'];
    const token = request.headers.authorization;
    
    if (!cfConnectingIp) {
        return response.status(400).json({
            success: false,
            error: 'No CF',
            cd: '(?)'
        });
    }

    if (!token) {
        return response.status(401).json({
            success: false,
            error: 'No token',
            cd: '(!)'
        });
    } else {
        const jwtStr = token.split(/\s/, 2)[1];
        if (!jwtStr) return response.status(401).json({
            success: false,
            error: 'No token',
            cd: '(!!)'
        });

        try {
            const jwtV = await verifyJwtAsync(jwtStr, process.env.JWT_SECRET || 'fallback', {
                issuer: 'https://helix.auth.erikku.page', audience: 'https://helix.erikku.page'
            });
            if ((jwtV as any).ip !== cfConnectingIp) { // some client security
                return response.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    cd: '(-)'
                });
            }
            return response.status(200).json({
                success: true
            });
        } catch (err: any) {
            console.error("JWT Verification Failed:", err.message);
            return response.status(401).json({
                success: false,
                error: 'Invalid token',
                cd: '(-)'
            });
        }
    }
});

app.listen(80, '0.0.0.0');