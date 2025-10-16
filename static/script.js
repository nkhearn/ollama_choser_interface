document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const chatScreen = document.getElementById('chat-screen');
    const modelSelect = document.getElementById('model-select');
    const promptSelect = document.getElementById('prompt-select');
    const startChatBtn = document.getElementById('start-chat-btn');
    const characterName = document.getElementById('character-name');
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const chatForm = document.getElementById('chat-form');
    const interruptBtn = document.getElementById('interrupt-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const restartBtn = document.getElementById('restart-btn');

    let messages = [];
    let abortController = null;
    let selectedModel = '';
    let selectedPrompt = '';

    // --- INITIALIZATION ---
    async function initialize() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Failed to fetch config');
            const config = await response.json();

            // Populate models
            modelSelect.innerHTML = '<option value="">Select a model</option>';
            config.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });

            // Populate prompts
            promptSelect.innerHTML = '<option value="">Select a prompt</option>';
            config.prompts.forEach(prompt => {
                const option = document.createElement('option');
                option.value = prompt;
                option.textContent = prompt.replace('.prompt', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                promptSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Initialization Error:', error);
            alert('Could not load initial data. Please ensure the backend is running and Ollama is accessible.');
        }
    }

    function checkSelections() {
        selectedModel = modelSelect.value;
        selectedPrompt = promptSelect.value;
        startChatBtn.disabled = !selectedModel || !selectedPrompt;
    }

    // --- UI TRANSITIONS ---
    function showChatScreen() {
        const promptName = selectedPrompt.replace('.prompt', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        characterName.textContent = `${promptName} (${selectedModel.split(':')[0]})`;
        setupScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();
    }

    function showSetupScreen() {
        chatScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
        resetChat();
    }

    // --- CHAT LOGIC ---
    function addMessageToUI(sender, text) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', sender);
        messageWrapper.innerHTML = `<div class="sender">${sender === 'user' ? 'You' : characterName.textContent}</div><div class="content">${text}</div>`;

        // Since the flex-direction is column-reverse, we add to the top
        chatWindow.insertBefore(messageWrapper, chatWindow.firstChild);
    }

    function resetChat() {
        messages = [];
        chatWindow.innerHTML = '';
        messageInput.value = '';
    }

    async function handleChatSubmit(e) {
        e.preventDefault();
        const userInput = messageInput.value.trim();
        if (!userInput) return;

        addMessageToUI('user', userInput);
        messages.push({ role: 'user', content: userInput });
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reset height

        await fetchLLMResponse();
    }

    async function fetchLLMResponse() {
        abortController = new AbortController();
        interruptBtn.classList.remove('hidden');

        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.classList.add('message', 'assistant');
        assistantMessageDiv.innerHTML = `<div class="sender">${characterName.textContent}</div><div class="content"></div>`;
        chatWindow.insertBefore(assistantMessageDiv, chatWindow.firstChild);

        const contentDiv = assistantMessageDiv.querySelector('.content');
        let fullResponse = "";

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: selectedPrompt,
                    messages: messages
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Unknown error from server');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    const parsed = JSON.parse(line);
                    const content = parsed.message.content;
                    fullResponse += content;
                    contentDiv.textContent = fullResponse; // Update in real-time
                }
                chatWindow.scrollTop = 0; // Keep scrolled to bottom (top in reverse)
            }

            messages.push({ role: 'assistant', content: fullResponse });

        } catch (error) {
            if (error.name === 'AbortError') {
                contentDiv.textContent += "\n\n[Response interrupted]";
            } else {
                contentDiv.textContent = `[Error: ${error.message}]`;
                console.error('Chat Error:', error);
            }
        } finally {
            abortController = null;
            interruptBtn.classList.add('hidden');
        }
    }

    function handleInterrupt() {
        if (abortController) {
            abortController.abort();
        }
    }

    // --- EVENT LISTENERS ---
    modelSelect.addEventListener('change', checkSelections);
    promptSelect.addEventListener('change', checkSelections);
    startChatBtn.addEventListener('click', showChatScreen);
    chatForm.addEventListener('submit', handleChatSubmit);
    interruptBtn.addEventListener('click', handleInterrupt);
    newChatBtn.addEventListener('click', resetChat);
    restartBtn.addEventListener('click', showSetupScreen);

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${messageInput.scrollHeight}px`;
    });

    // --- KICKOFF ---
    initialize();
});