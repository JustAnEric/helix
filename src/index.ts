import 'dotenv/config';
import express, { Request, Response } from "express";
import path from "node:path";
import crypto from "crypto";
import { MODEL_MAPPINGS, runModel } from "./models.js";
import jwt from "jsonwebtoken";
import { v7 as uuidv7 } from "uuid";
import util from "util";
import { ObjectId } from 'mongodb';
import { connectDB, conversations } from './db.js';
import { runAgent } from './agent.js';


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

app.get("/conversations/:id", (request: Request, response: Response) => {
    response.render('index');
});

app.get("/api/conversations", async (request: Request, response: Response) => {
    const token = request.headers.authorization;
    const cfConnectingIp = request.headers['cf-connecting-ip'];

    if (!cfConnectingIp) {
        return response.status(400).json({
            success: false,
            error: 'No CF',
            cd: '(?)'
        });
    }

    let jwtV: any;

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
            jwtV = await verifyJwtAsync(jwtStr, process.env.JWT_SECRET || 'fallback', {
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

    const owner = jwtV.type === 'guest'
        ? { corrId: jwtV.correlation }
        : { userId: new ObjectId(jwtV.userId) };

    const list = await conversations
        .find(owner)
        .sort({ updatedAt: -1 })
        .project({ title: 1, status: 1, updatedAt: 1 })
        .toArray();

    response.json(list);
});

app.get("/api/conversations/:id", async (request: Request, response: Response) => {
    const { id } = request.params;

    if (!id) return response.status(400).json({ error: 'unknown? how did this happen :D' });

    const token = request.headers.authorization;
    const cfConnectingIp = request.headers['cf-connecting-ip'];

    if (!cfConnectingIp) {
        return response.status(400).json({
            success: false,
            error: 'No CF',
            cd: '(?)'
        });
    }

    let jwtV: any;

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
            jwtV = await verifyJwtAsync(jwtStr, process.env.JWT_SECRET || 'fallback', {
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

    const owner = jwtV.type === 'guest'
        ? { corrId: jwtV.correlation }
        : { userId: new ObjectId(jwtV.userId) };

    const convo = await conversations.findOne({
        _id: new ObjectId(id.toString()),
        ...owner
    });

    if (!convo) return response.status(404).json({ error: "Not found" });
    response.json(convo);
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

    let jwtV: any;

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
            jwtV = await verifyJwtAsync(jwtStr, process.env.JWT_SECRET || 'fallback', {
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

    const owner = jwtV.type === 'guest'
        ? { deviceHash: jwtV.hash, corrId: jwtV.correlation }
        : { userId: new ObjectId(jwtV.userId) };
    let convo = conversationId ? await conversations.findOne({ _id: new ObjectId(conversationId), ...owner }) : null;

    if (!convo) {
        const result = await conversations.insertOne({
            ...owner,
            title: message.slice(0, 50),
            status: "running",
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        convo = await conversations.findOne({ _id: result.insertedId });
    } else {
        await conversations.updateOne(
        { _id: convo._id },
        { $set: { status: "running", updatedAt: new Date() } }
        );
    }

    await conversations.updateOne(
        { _id: convo!._id },
        { $push: { messages: { role: "user", content: message, toolCalls: [], thinking: null, createdAt: new Date() } } }
    );

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');

    response.write(`data: ${JSON.stringify({ type: "meta", conversationId: convo!._id, conversationTitle: convo!.title })}\n\n`);

    await runAgent(convo?._id!, owner, response, model);

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
        user_id: correlation,
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

app.listen(80, '0.0.0.0', async() => {
    await connectDB();
});