document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const chatScreen = document.getElementById('chat-screen');
    const modelSelect = document.getElementById('model-select');
    const promptSelect = document.getElementById('prompt-select');
    const startChatBtn = document.getElementById('start-chat-btn');
    const characterName = document.getElementById('character-name');
    const chatWindow = document.getElementById('chat-window');
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const modelSelectChat = document.getElementById('model-select-chat');
    const promptSelectChat = document.getElementById('prompt-select-chat');
    const messageInput = document.getElementById('message-input');
    const chatForm = document.getElementById('chat-form');
    const interruptBtn = document.getElementById('interrupt-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const restartBtn = document.getElementById('restart-btn');
    const attachImageBtn = document.getElementById('attach-image-btn');
    const imageUpload = document.getElementById('image-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');

    let messages = [];
    let abortController = null;
    let selectedModel = '';
    let selectedPrompt = '';
    let attachedImage = null; // To store the base64 encoded image

    // --- INITIALIZATION ---
    async function initialize() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Failed to fetch config');
            const config = await response.json();

            function populateSelects(models, prompts) {
                modelSelect.innerHTML = '<option value="">Select a model</option>';
                modelSelectChat.innerHTML = '<option value="">Select a model</option>';
                models.forEach(model => {
                    const option1 = document.createElement('option');
                    option1.value = model.name;
                    option1.textContent = model.name;
                    modelSelect.appendChild(option1);

                    const option2 = option1.cloneNode(true);
                    modelSelectChat.appendChild(option2);
                });

                promptSelect.innerHTML = '<option value="">Select a prompt</option>';
                promptSelectChat.innerHTML = '<option value="">Select a prompt</option>';
                prompts.forEach(prompt => {
                    const option1 = document.createElement('option');
                    option1.value = prompt;
                    option1.textContent = prompt.replace('.prompt', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    promptSelect.appendChild(option1);

                    const option2 = option1.cloneNode(true);
                    promptSelectChat.appendChild(option2);
                });
            }
            populateSelects(config.models, config.prompts);

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

        // Sync the dropdowns in the settings menu
        modelSelectChat.value = selectedModel;
        promptSelectChat.value = selectedPrompt;

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
    function addMessageToUI(sender, text, imageUrl = null) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', sender);

        const senderName = sender === 'user' ? 'You' : characterName.textContent;
        let messageHTML = `<span class="sender">${senderName}: </span>`;

        if (imageUrl) {
            messageHTML += `<div class="message-image"><img src="${imageUrl}" alt="attached image"></div>`;
        }

        // Use a separate element for the text to ensure proper escaping
        const textNode = document.createElement('span');
        textNode.innerText = text;

        messageWrapper.innerHTML = messageHTML;
        messageWrapper.appendChild(textNode);

        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function resetChat() {
        messages = [];
        chatWindow.innerHTML = '';
        messageInput.value = '';
        attachedImage = null;
        imagePreviewContainer.classList.add('hidden');
        imageUpload.value = ''; // Reset file input
    }

    async function handleChatSubmit(e) {
        e.preventDefault();
        const userInput = messageInput.value.trim();
        if (!userInput && !attachedImage) return;

        addMessageToUI('user', userInput, attachedImage);

        const userMessage = { role: 'user', content: userInput };
        if (attachedImage) {
            userMessage.images = [attachedImage];
        }
        messages.push(userMessage);

        // Reset UI
        messageInput.value = '';
        messageInput.style.height = 'auto';
        attachedImage = null;
        imagePreviewContainer.classList.add('hidden');
        imageUpload.value = '';

        await fetchLLMResponse();
    }

    async function fetchLLMResponse() {
        abortController = new AbortController();
        interruptBtn.classList.remove('hidden');

        // Create the UI element for the assistant's message
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.classList.add('message', 'assistant');
        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = `${characterName.textContent}: `;
        const contentSpan = document.createElement('span');
        contentSpan.innerText = '🤔...'; // Loading indicator

        assistantMessageDiv.appendChild(senderSpan);
        assistantMessageDiv.appendChild(contentSpan);
        chatWindow.appendChild(assistantMessageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;


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
                // Try to get a specific error message from the server
                const errorData = await response.json().catch(() => ({ error: 'Server returned an error, but the response was not valid JSON.' }));
                throw new Error(errorData.error || 'Unknown error from server');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let isFirstChunk = true; // To clear the loading indicator

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (isFirstChunk) {
                    contentSpan.innerText = ""; // Clear "🤔..."
                    isFirstChunk = false;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the potentially incomplete last line

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message && parsed.message.content) {
                            fullResponse += parsed.message.content;
                            // Use innerText to properly render newlines from the model
                            contentSpan.innerText = fullResponse;
                            chatWindow.scrollTop = chatWindow.scrollHeight; // Keep scrolled to the bottom
                        }
                    } catch (e) 'monaco', 'courier new', monospace
                        console.error("Failed to parse JSON line:", line, e);
                    }
                }
            }

            // After the loop, process any remaining data in the buffer
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    if (parsed.message && parsed.message.content) {
                        fullResponse += parsed.message.content;
                        contentSpan.innerText = fullResponse;
                    }
                } catch (e) {
                    console.error("Failed to parse final JSON buffer:", buffer, e);
                }
            }


            // Add the complete response to the message history for future context
            if (fullResponse) {
                messages.push({ role: 'assistant', content: fullResponse });
            }

        } catch (error) {
            // Handle fetch errors (like network issues) or server errors
            if (error.name === 'AbortError') {
                contentSpan.innerText += "\n\n[Response interrupted]";
            } else {
                // If the loading indicator was still up, replace it with the error.
                // Otherwise, show the error.
                contentSpan.innerText = `[Error: ${error.message}]`;
                console.error('Chat Error:', error);
            }
        } finally {
            // Clean up
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
    newChatBtn.addEventListener('click', () => {
        resetChat();
        settingsMenu.classList.add('hidden');
    });
    restartBtn.addEventListener('click', showSetupScreen);
    settingsToggleBtn.addEventListener('click', () => {
        settingsMenu.classList.toggle('hidden');
    });

    // --- Image Upload Listeners ---
    attachImageBtn.addEventListener('click', () => imageUpload.click());

    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                // The result is a base64 string. We only need the part after the comma.
                attachedImage = e.target.result.split(',')[1];
                imagePreview.src = e.target.result;
                imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        attachedImage = null;
        imagePreviewContainer.classList.add('hidden');
        imageUpload.value = ''; // Reset the file input
    });

    modelSelectChat.addEventListener('change', (e) => {
        selectedModel = e.target.value;
        const promptName = selectedPrompt.replace('.prompt', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        characterName.textContent = `${promptName} (${selectedModel.split(':')[0]})`;
        resetChat();
    });

    promptSelectChat.addEventListener('change', (e) => {
        selectedPrompt = e.target.value;
        const promptName = selectedPrompt.replace('.prompt', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        characterName.textContent = `${promptName} (${selectedModel.split(':')[0]})`;
        resetChat();
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${messageInput.scrollHeight}px`;
    });

    // --- KICKOFF ---
    initialize();
});