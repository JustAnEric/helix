// Helix App Code
import { Marked } from "marked";
import { highlight, languages, plugins } from "prismjs";
import axios from "axios";
import 'prismjs/plugins/autoloader/prism-autoloader';
import 'prism-themes/themes/prism-vsc-dark-plus.css';

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

function appendMessage(text: string, sender: string) {
    const chatMessages: HTMLDivElement | null | undefined = document.querySelector('.chat-messages');
    if (!chatMessages) return
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    wrapper.appendChild(msgDiv);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
}

function scrollToBottom() {
    const chatMessages: HTMLDivElement | null | undefined = document.querySelector('.chat-messages');
    if (!chatMessages) return;
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const chatInput: HTMLTextAreaElement | null | undefined = document.querySelector('.input-box textarea');
    const chatMessages: HTMLDivElement | null | undefined = document.querySelector('.chat-messages');
    const activeModel: HTMLDivElement | null | undefined = document.querySelector('#modelMenu .model-option.active');
    const text = chatInput?.value.trim();
    if (!text || !chatInput || !chatMessages || !activeModel) return;

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
    scrollToBottom();

    const streamResponse = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('helio.token')}` },
        body: JSON.stringify({ message: text, model: activeModel.dataset.model })
    });

    if (!streamResponse.ok) throw new Error('Network response error');
    
    const reader = streamResponse.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) throw new Error('Network response error');
    
    let buffer = '';
    let accumulatedText = '';

    msgDiv.innerHTML = '';
    
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
                    return;
                }

                try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.type === "chunk:text") {
                        const c = parsed.text || '';
                        accumulatedText += c;
                        if (typeof marked !== 'undefined') {
                            const m = await marked.parse(accumulatedText);
                            msgDiv.innerHTML = m;
                        } else {
                            msgDiv.textContent = accumulatedText;
                        }
                        scrollToBottom();
                    } else if (parsed.type === "chunk:think_start") {
                        msgDiv.innerHTML = `<div class="thinking-indicator">Thinking...</div>`;
                    } else if (parsed.type === "chunk:think_end") {
                        msgDiv.querySelectorAll('.thinking-indicator').forEach(a => a.remove());
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

document.addEventListener('DOMContentLoaded', async () => {
    let loadingOverlay = document.querySelector('.loading-overlay');
    let mainDoc = document.querySelector('main.app');

    if (!loadingOverlay || !mainDoc) return;

    showStartPage();

    if (!(await isLoggedIn())) {
        await createToken();
    }

    loadingOverlay.setAttribute("hidden", "true");
    mainDoc.removeAttribute("hidden");

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
});