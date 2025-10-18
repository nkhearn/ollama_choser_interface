import ollama
import os
import glob
import json
from flask import Flask, render_template, jsonify, request, Response

# --- CONFIGURATION ---
OLLAMA_HOST = 'http://localhost:11434'
PROMPT_FILE_PATTERN = "*.prompt"

app = Flask(__name__)

# --- HELPER FUNCTIONS (Adapted from char.py) ---

def get_available_prompts():
    """Returns a list of available prompt files."""
    prompt_files = glob.glob(PROMPT_FILE_PATTERN)
    return [os.path.basename(f) for f in prompt_files]

def load_prompt_content(filename: str) -> str | None:
    """Loads the content of a specific prompt file."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception:
        return None

def get_available_models():
    """
    Returns a list of available Ollama models by accessing the 'model' key
    in each model's dictionary, as returned by the ollama client.
    """
    try:
        client = ollama.Client(host=OLLAMA_HOST)
        # client.list() returns a dictionary with a 'models' key.
        response = client.list()
        models_list = response.get('models', [])

        # Each item in models_list is a dictionary. The model name is in the 'model' key.
        # The frontend expects a list of dictionaries, each with a 'name' key.
        return [{'name': model['model']} for model in models_list]
    except Exception as e:
        print(f"[ERROR] Could not connect to Ollama or parse models: {e}")
        return []

# --- API ROUTES ---

@app.route('/')
def index():
    """Renders the main HTML page."""
    return render_template('index.html')

@app.route('/api/config')
def api_config():
    """Provides the initial configuration to the frontend."""
    prompts = get_available_prompts()
    models = get_available_models()
    return jsonify({
        'prompts': prompts,
        'models': models
    })

@app.route('/api/chat', methods=['POST'])
def api_chat():
    """Handles the chat logic with streaming."""
    data = request.json
    model = data.get('model')
    prompt_file = data.get('prompt')
    messages = data.get('messages', [])

    if not model or not prompt_file:
        return jsonify({'error': 'Model and prompt are required.'}), 400

    system_prompt = load_prompt_content(prompt_file)
    if not system_prompt:
        return jsonify({'error': f'Could not load prompt file: {prompt_file}'}), 404

    # Prepend the system prompt to the message history
    chat_messages = [{'role': 'system', 'content': system_prompt}] + messages

    try:
        client = ollama.Client(host=OLLAMA_HOST)

        # The user's message is the last one in the list
        # Check if the last message has images and adapt the payload
        last_message = chat_messages[-1]
        if 'images' in last_message and last_message['images']:
            # Assuming one image for simplicity, as per the frontend logic
            last_message['images'] = [last_message['images'][0]]

        def generate():
            stream = client.chat(
                model=model,
                messages=chat_messages,
                stream=True,
            )
            for chunk in stream:
                # The chunk is a Pydantic model (ChatResponse), so we use
                # .model_dump_json() to get a JSON string representation.
                yield chunk.model_dump_json() + '\n'

        return Response(generate(), mimetype='application/json')

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)