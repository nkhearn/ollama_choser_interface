# Char.py Web

Char.py Web is a simple and fun web-based chat interface that allows you to interact with various AI characters powered by Ollama and large language models. Select a character, and start a conversation!

This project provides a user-friendly frontend for the core functionalities of `char.py`, allowing you to easily manage and chat with different AI personalities through your web browser.

## Features

*   **Easy-to-use Web Interface:** A clean and intuitive chat interface for a seamless user experience.
*   **Character Selection:** Choose from a list of available character prompts to define the AI's personality.
*   **Model Selection:** Select any of the available Ollama models to power the chat.
*   **Streaming Responses:** Get real-time responses from the AI as they are being generated.
*   **Extensible:** Easily add your own characters by creating simple `.prompt` files.
*   **Responsive Design:** The interface is designed to work on both desktop and mobile devices.

## Getting Started

Follow these instructions to get a local copy of Char.py Web up and running on your machine.

### Prerequisites

*   **Python 3:** Make sure you have Python 3 installed.
*   **Ollama:** You need a running instance of [Ollama](https://ollama.ai/). Follow their instructions to download and set it up. Make sure to pull at least one model (e.g., `ollama pull llama3`).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/char-py-web.git
    cd char-py-web
    ```

2.  **Install the required Python packages:**
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  **Ensure Ollama is running:**
    Make sure your local Ollama instance is active.

2.  **Run the Flask application:**
    ```bash
    python app.py
    ```

3.  **Open in your browser:**
    Navigate to `http://127.0.0.1:5000` in your web browser to start using the application.

## Project Structure

*   `app.py`: The main Flask application file that handles the backend logic, API routes, and communication with Ollama.
*   `requirements.txt`: A list of the Python dependencies required for the project.
*   `static/`: Contains the static assets for the web interface, including CSS (`style.css`) and JavaScript (`script.js`).
*   `templates/`: Holds the HTML templates for the application, primarily `index.html`.
*   `*.prompt`: Text files containing the system prompts for the AI characters.

### Adding New Characters

Creating a new character is simple:

1.  Create a new text file with a `.prompt` extension in the root directory of the project (e.g., `my_character.prompt`).
2.  Write the system prompt for your character in this file. This will define the character's personality, background, and how it should respond.
3.  Relaunch the application. Your new character will automatically appear in the "Choose a Character Prompt" dropdown on the setup screen.