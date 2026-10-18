// Helix App Code
import axios from "axios";
import 'prism-themes/themes/prism-vsc-dark-plus.css';
import { Marked } from 'marked';
import { highlight, languages, plugins } from "prismjs";
import 'prismjs/plugins/autoloader/prism-autoloader';

plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism-components/';

const marked = new Marked({
    renderer: {
        code({ text, lang }) {
            const validLang = (lang && languages[lang]) ? lang : 'plaintext';
            
            const highlighted = highlight(
                text,
                languages[validLang] || languages.plaintext,
                validLang
            );

            return `<pre class="language-${validLang}"><code class="language-${validLang}">${highlighted}</code></pre>`;
        }
    }
});

const checkIcon = (width: number, height: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="${width}" height="${height}">
    <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M10 19a9 9 0 1 0 0-18 9 9 0 0 0 0 18m3.722-11.315a.75.75 0 1 0-1.144-.97l-4.125 4.863-1.141-1.611a.75.75 0 1 0-1.224.867l1.7 2.4a.75.75 0 0 0 1.184.051z"/>
</svg>
`;

const warningIcon = (width: number, height: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="${width}" height="${height}">
    <path fill="currentColor" fill-rule="evenodd" d="M7.712 3.542c1.02-1.723 3.556-1.723 4.576 0l6.1 10.303c1.043 1.76-.28 3.905-2.287 3.905H3.9c-2.008 0-3.331-2.144-2.288-3.905zM10 12.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0-6a.75.75 0 0 0-.75.75V11a.75.75 0 0 0 1.5 0V7.5a.75.75 0 0 0-.75-.75" clip-rule="evenodd"/>
</svg>
`;

let current_conversationId: string | undefined;

async function isLoggedIn() {
    const token = localStorage.getItem('helio.token');

    if (!token) return false;

    let tokenCheck;
    try {
        tokenCheck = await axios.get(`/api/tokens`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'json'
        });
    } catch(err: any) {
        return false;
    }

    const jsonob = tokenCheck.data;

    if (jsonob.success) {
        return true;
    } else {
        return false;
    }
}

function getCanvasFingerprint_gputest() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125,1,62,20);
        ctx.fillStyle = "#069";
        ctx.fillText("TokenAbusePrevention!💪", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("TokenAbusePrevention!💪", 4, 17);
        
        return canvas.toDataURL();
    } catch (e) {
        return '';
    }
}

async function createToken() {
    const tokenRequest = await axios.post(`/api/tokens`, {
        clientTime: {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offs: new Date().getTimezoneOffset(),
            now: Date.now(),
            pnow: performance.now()
        },
        computer: { // hardware profiling to prevent token abuse
            core: navigator.hardwareConcurrency,
            mem: 'deviceMemory' in navigator ? navigator.deviceMemory : undefined,
            gpuSig: getCanvasFingerprint_gputest(),
            screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
        },
        lang: navigator.language,
        br: 'userAgentData' in navigator ? (navigator.userAgentData as any).brands : [],
        mob: 'userAgentData' in navigator ? (navigator.userAgentData as any).mobile : false
    }, { responseType: 'json' });

    const jsonob = tokenRequest.data;

    if (jsonob.dev_hash) {
        localStorage.setItem('helio.dhash', jsonob.dev_hash);
    } else {
        localStorage.removeItem('helio.dhash');
    }

    if (jsonob.token) {
        localStorage.setItem('helio.token', jsonob.token);
    } else {
        localStorage.removeItem('helio.token');
    }
}

async function getConversations(page: number, limit: number) {
    const conversations = await axios.get(`/api/conversations`, {
        responseType: 'json',
        headers: { Authorization: `Bearer ${localStorage.getItem('helio.token')}`, Page: page, Limit: limit }
    });

    const jsonob = conversations.data;

    if (Array.isArray(jsonob)) {
        return jsonob;
    } else {
        return [];
    }
}

async function getConversation(id: string) {
    const conversation = await axios.get(`/api/conversations/${id}`, {
        responseType: 'json',
        headers: { Authorization: `Bearer ${localStorage.getItem('helio.token')}` }
    });

    const jsonob = conversation.data;

    return jsonob;
}

interface Tc {
    id: string,
    name: string,
    input: any,
    output: any,
    status: "pending" | "running" | "success" | "error",
    error: string | null,
    startedAt: Date,
    finishedAt: Date | null
}

interface AppendMessageOptions {
    toolCalls?: Array<Tc>
}

function appendMessage(text: string, sender: string, options: AppendMessageOptions = {}) {
    const chatMessages: HTMLDivElement | null | undefined = document.querySelector('.chat-messages');
    if (!chatMessages) return
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    if (text) msgDiv.innerHTML = marked.parse(text) as string;
    wrapper.appendChild(msgDiv);
    chatMessages.appendChild(wrapper);
    scrollToBottom(chatMessages);

    console.log(options);

    if (options.toolCalls) {
        // the AI called tools
        for (const tool of options.toolCalls) {
            console.log(tool);
            msgDiv.innerHTML += `
            <div class="tool-exec-details" data-id="${tool.id}">
                <div class="tool-exec-summary">${tool.status == "success" ? checkIcon(15, 15) : tool.status == "error" ? warningIcon(15, 15) : ''} <span>${tool.name}</span></div>
                <div class="tool-exec-content">${`<pre><code>${JSON.stringify(tool.output, undefined, 4)}</code></pre>` || tool.error}</div>
            </div>
            `;
        }
    }
}

function scrollToBottom(chatMessages: HTMLDivElement) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const chatInput: HTMLTextAreaElement | null | undefined = document.querySelector('.input-box textarea');
    const chatMessages: HTMLDivElement | null | undefined = document.querySelector('.chat-messages');
    const activeModel: HTMLDivElement | null | undefined = document.querySelector('#modelMenu .model-option.active');
    const statisticsAboveInput: HTMLDivElement | null | undefined = document.querySelector('.input-area .statistics');
    const chatHeader: HTMLDivElement | null | undefined = document.querySelector('.chat-header');
    const chatTitle: HTMLDivElement | null | undefined = chatHeader?.querySelector('.chat-title');
    const chatsList = document.querySelector('aside.sidebar .menu-buttons.chats');
    const text = chatInput?.value.trim();
    if (!text || !chatInput || !chatMessages || !activeModel || !statisticsAboveInput || !chatHeader || !chatTitle || !chatsList) return;

    await showChatPage();

    appendMessage(text, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    msgDiv.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    wrapper.appendChild(msgDiv);
    chatMessages.appendChild(wrapper);
    scrollToBottom(chatMessages);

    const streamResponse = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('helio.token')}` },
        body: JSON.stringify({ message: text, model: activeModel.dataset.model, conversationId: current_conversationId })
    });

    if (!streamResponse.ok) throw new Error('Network response error');
    
    const reader = streamResponse.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) throw new Error('Network response error');
    
    let buffer = '';
    let accumulatedText = '';
    let tps = 0.0;
    let elapsedSeconds = 0.0;

    msgDiv.innerHTML = '';

    let worker = setInterval(() => {
        statisticsAboveInput.textContent = `${tps.toFixed(2)} tps / ${elapsedSeconds.toFixed(2)} s`;
    }, 100);
    
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();

                if (dataStr === '[DONE]') {
                    console.log('Stream completed.');
                    clearInterval(worker);
                    statisticsAboveInput.textContent = `${tps.toFixed(2)} tps / ${elapsedSeconds.toFixed(2)} s`;
                    break;
                }

                try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.type === "chunk:text") {
                        const c = parsed.text || '';
                        accumulatedText += c;
                        tps = parsed.tps;
                        elapsedSeconds = parsed.elapsedSeconds;
                        msgDiv.innerHTML = marked.parse(accumulatedText) as string;
                        scrollToBottom(chatMessages);
                    } else if (parsed.type === "chunk:think_start") {
                        msgDiv.innerHTML = `<div class="thinking-indicator">Thinking...</div>`;
                    } else if (parsed.type === "chunk:think_end") {
                        msgDiv.querySelectorAll('.thinking-indicator').forEach(a => a.remove());
                    } else if (parsed.type === "meta") {
                        // contains convo
                        history.pushState(
                            {}, 
                            `${window.location.protocol}//${window.location.host}${window.location.pathname}`, 
                            `${window.location.protocol}//${window.location.host}/conversations/${parsed.conversationId}`
                        );
                        current_conversationId = parsed.conversationId;
                        chatTitle.textContent = parsed.conversationTitle;
                        const chatItems = chatsList.querySelectorAll('li');
                        let found = Array.from(chatItems.values()).some(a => (a as HTMLLIElement).dataset?.id == parsed.conversationId);
                        if (!found) {
                            const li = document.createElement('li');
                            li.classList.add('menu-button');
                            li.textContent = parsed.conversationTitle;
                            li.dataset.id = parsed.conversationId;
                            chatsList.insertBefore(li, chatsList.childNodes[0]);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing chunk:', e);
                }
            }
        }
    }
}

async function showStartPage() {
    const mainApp: HTMLElement | null | undefined = document.querySelector('main.app');
    const content: HTMLDivElement | null | undefined = mainApp?.querySelector('.content');
    const chatHeader: HTMLDivElement | null | undefined = content?.querySelector('.chat-header');
    const chatMessages: HTMLDivElement | null | undefined = content?.querySelector('.chat-messages');
    const chatWelcome: HTMLDivElement | null | undefined = content?.querySelector('.chat-welcome');
    if (!content || !mainApp || !chatHeader || !chatMessages || !chatWelcome) return;
    mainApp.querySelectorAll('.sidebar .menu-buttons.top .menu-button')[0].classList.add('selected');
    (chatHeader.querySelector('.chat-title') as HTMLDivElement||({} as {hidden?:boolean})).hidden = true;
    Array.from(chatMessages.children).forEach(e => e.remove());
    chatMessages.hidden = true;
    chatWelcome.hidden = false;
    history.pushState(
        {},
        `${window.location.protocol}//${window.location.host}${window.location.pathname}`, 
        `${window.location.protocol}//${window.location.host}/`
    );
    current_conversationId = undefined;
}

async function showChatPage() {
    const mainApp: HTMLElement | null | undefined = document.querySelector('main.app');
    const content: HTMLDivElement | null | undefined = mainApp?.querySelector('.content');
    const chatHeader: HTMLDivElement | null | undefined = content?.querySelector('.chat-header');
    const chatMessages: HTMLDivElement | null | undefined = content?.querySelector('.chat-messages');
    const chatWelcome: HTMLDivElement | null | undefined = content?.querySelector('.chat-welcome');
    if (!content || !mainApp || !chatHeader || !chatMessages || !chatWelcome) return;
    mainApp.querySelectorAll('.sidebar .menu-buttons.top .menu-button.selected').forEach(e => e.classList.remove('selected'));
    chatMessages.hidden = false;
    chatWelcome.hidden = true;
    (chatHeader.querySelector('.chat-title') as HTMLDivElement||({} as {hidden?:boolean})).hidden = false;
}

async function showChatPageWithConversation(id: string) {
    const mainApp: HTMLElement | null | undefined = document.querySelector('main.app');
    const content: HTMLDivElement | null | undefined = mainApp?.querySelector('.content');
    const chatHeader: HTMLDivElement | null | undefined = content?.querySelector('.chat-header');
    const chatMessages: HTMLDivElement | null | undefined = content?.querySelector('.chat-messages');
    const chatWelcome: HTMLDivElement | null | undefined = content?.querySelector('.chat-welcome');
    const chatTitle: HTMLDivElement | null | undefined = chatHeader?.querySelector('.chat-title');
    if (!content || !mainApp || !chatHeader || !chatMessages || !chatWelcome || !chatTitle) return;
    mainApp.querySelectorAll('.sidebar .menu-buttons.top .menu-button.selected').forEach(e => e.classList.remove('selected'));
    chatMessages.hidden = false;
    Array.from(chatMessages.children).forEach(a => a.remove());
    chatWelcome.hidden = true;
    (chatHeader.querySelector('.chat-title') as HTMLDivElement||({} as {hidden?:boolean})).hidden = false;

    const convo = await getConversation(id);
    current_conversationId = id;

    chatTitle.textContent = convo.title;

    for (const msg of convo.messages) {
        if (msg.role == "assistant" && msg.toolCalls.length > 0) {
            console.log(msg);
            appendMessage(msg.content, msg.role, { toolCalls: msg.toolCalls || [] });
        } else if (msg.role == "user" || msg.role == "assistant") {
            appendMessage(msg.content, msg.role);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    let loadingOverlay = document.querySelector('.loading-overlay');
    let mainDoc = document.querySelector('main.app');

    if (!loadingOverlay || !mainDoc) return;

    if (!(await isLoggedIn())) {
        await createToken();
    }

    const conversations = await getConversations(1, 20);
    const currentPath = location.pathname.split('/');

    if (currentPath[1] == "conversations" && currentPath[2]) {
        showChatPageWithConversation(currentPath[2]);
    } else {
        showStartPage();
    }

    // setup model dropdown

    const modelTrigger = document.getElementById('modelTrigger');
    const modelMenu = document.getElementById('modelMenu');
    const modelNameSpan = modelTrigger?.querySelector('.model-name');

    (async() => {
        if (!modelTrigger || !modelMenu || !modelNameSpan) {
            return;
        }

        const models = (await (await fetch(`/api/models`)).json()).models;

        for (const model of models) {
            const modelOption = document.createElement('div');
            modelOption.classList.add('model-option');
            modelOption.dataset.model = model.id
            if (modelMenu.children.length == 0) {
                modelOption.classList.add('active');
            }
            const modelOptionTitle = document.createElement('div');
            const modelOptionDesc = document.createElement('div');
            modelOptionTitle.classList.add('model-option-title');
            modelOptionTitle.textContent = model.name;
            modelOptionDesc.classList.add('model-option-desc');
            modelOptionDesc.textContent = model.description;
            modelOption.appendChild(modelOptionTitle);
            modelOption.appendChild(modelOptionDesc);
            modelMenu.appendChild(modelOption);
        }

        modelTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            modelMenu.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            modelMenu.classList.remove('open');
        });

        const options = modelMenu?.querySelectorAll('.model-option');

        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                modelNameSpan.textContent = models.find((a: any) => a.id == opt.getAttribute('data-model')).name;
                modelMenu.classList.remove('open');
            });
        });
    })();

    // setup prompt input

    const inputBox = document.querySelector('.input-box');
    const inputTextarea: HTMLTextAreaElement | null | undefined = inputBox?.querySelector('textarea');
    const sendButton: HTMLButtonElement | null | undefined = inputBox?.querySelector('button.send-btn');

    (async() => {
        if (!inputBox || !inputTextarea || !sendButton) {
            return
        }

        inputTextarea.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                if (!sendButton.disabled) {
                    sendButton.click();
                }
            }
        });

        inputTextarea.addEventListener('input', () => {
            inputTextarea.style.height = 'auto';
            inputTextarea.style.height = (inputTextarea.scrollHeight - 8) + 'px';
        });

        sendButton.addEventListener('click', sendMessage);
    })();

    mainDoc.querySelectorAll('.sidebar .menu-buttons.top .menu-button')[0].addEventListener('click', showStartPage);

    // setup conversations list
    const sidebar = mainDoc.querySelector('aside.sidebar');
    const chatsList = sidebar?.querySelector('.menu-buttons.chats');

    (async() => {
        if (!sidebar || !chatsList) {
            return;
        }

        // render all
        Array.from(chatsList.children).forEach(a => a.remove());
        for (const convo of conversations) {
            const li = document.createElement('li');
            li.classList.add('menu-button');
            li.textContent = convo.title;
            li.dataset.id = convo._id;
            chatsList.appendChild(li);
        }
    })();

    chatsList?.addEventListener('click', async(e) => {
        const target: HTMLLIElement | null = e.target as HTMLLIElement;
        if (target.tagName.toLowerCase() !== "li" || !target.dataset.id) {
            // forget it
            return;
        }
        history.pushState(
            {}, 
            `${window.location.protocol}//${window.location.host}${window.location.pathname}`, 
            `${window.location.protocol}//${window.location.host}/conversations/${target.dataset.id}`
        );
        await showChatPageWithConversation(target.dataset.id);
    });

    loadingOverlay.setAttribute("hidden", "true");
    mainDoc.removeAttribute("hidden");
});