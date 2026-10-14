// Helix App Code
import { marked } from "marked";

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
        headers: { 'Content-Type': 'application/json' },
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
                            msgDiv.innerHTML = await marked.parse(accumulatedText);
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

document.addEventListener('DOMContentLoaded', () => {
    let loadingOverlay = document.querySelector('.loading-overlay');
    let mainDoc = document.querySelector('main.app');

    if (!loadingOverlay || !mainDoc) return;

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
});