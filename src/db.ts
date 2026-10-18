import { MongoClient, Collection, ObjectId, Db } from "mongodb";

export interface User {
    _id?: ObjectId;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    _id?: ObjectId;
    userId: ObjectId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
    output: Record<string, unknown> | null;
    status: "pending" | "running" | "success" | "error";
    error: string | null;
    startedAt: Date;
    finishedAt: Date | null;
}

export interface Message {
    role: "user" | "assistant";
    content: string | null;
    thinking: string | null;
    toolCalls: ToolCall[];
    createdAt: Date;
}

export interface Conversation {
    _id?: ObjectId;
    userId?: ObjectId;
    deviceHash?: ObjectId;
    corrId?: ObjectId;
    title: string;
    status: "idle" | "running" | "done" | "error";
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}

export let users: Collection<User>;
export let sessions: Collection<Session>;
export let conversations: Collection<Conversation>;

export let db: Db;

export async function connectDB() {
    const client = new MongoClient(process.env.MONGO_URI!);
    await client.connect();

    db = client.db("helix_ai");

    users = db.collection<User>("users");
    sessions = db.collection<Session>("sessions");
    conversations = db.collection<Conversation>("conversations");

    await users.createIndex({ email: 1 }, { unique: true });
    await sessions.createIndex({ token: 1 }, { unique: true });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await conversations.createIndex({ userId: 1, updatedAt: -1 });
    await conversations.createIndex({ status: 1 });

    console.log("connected to mdb");
}