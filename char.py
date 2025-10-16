import ollama
import os
import sys
import glob

# --- CONFIGURATION ---
# IMPORTANT: Ensure your Ollama server is running locally on http://localhost:11434
OLLAMA_HOST = 'http://localhost:11434'
PROMPT_FILE_PATTERN = "*.prompt" # Files ending with .prompt in the current directory

def load_prompt_content(filepath: str) -> str | None:
    """Loads the system prompt text from a specific file path."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"[ERROR] The prompt file was not found at: {filepath}")
        return None
    except Exception as e:
        print(f"[ERROR] An unexpected error occurred while reading the file: {e}")
        return None

def select_system_prompt() -> tuple[str | None, str | None]:
    """Discovers and prompts the user to select a system prompt file."""
    print("="*50)
    print("--- System Prompt Selection ---")
    
    # Find all files matching the pattern
    prompt_files = glob.glob(PROMPT_FILE_PATTERN)
    
    if not prompt_files:
        print(f"[ERROR] No system prompt files found matching the pattern '{PROMPT_FILE_PATTERN}' in the current directory.")
        print("Please create one (e.g., 'dnd_system_prompt.prompt').")
        return None, None

    print("Available Character Prompts:")
    
    prompt_map = {}
    for i, filename in enumerate(prompt_files):
        # Use filename as the display name
        print(f"[{i + 1}] {filename}")
        prompt_map[i + 1] = filename

    while True:
        choice = input("Enter the number of the prompt file to use: ").strip()
        try:
            choice_num = int(choice)
            if choice_num in prompt_map:
                chosen_filepath = prompt_map[choice_num]
                prompt_content = load_prompt_content(chosen_filepath)
                if prompt_content:
                    print(f"[INFO] Successfully loaded prompt from '{chosen_filepath}'.")
                    return prompt_content, chosen_filepath
                else:
                    print(f"Could not read content from selected file: {chosen_filepath}")
            else:
                print("Invalid choice. Please enter a number from the list.")
        except ValueError:
            print("Invalid input. Please enter a number.")

def format_size(bytes_val: int) -> str:
    """Converts bytes to a human-readable format (MB/GB)."""
    if bytes_val is None:
        return "Unknown Size"
    # Note: size property might be a float/real number, but we assume it's in bytes.
    if bytes_val >= 1024**3:
        return f"{bytes_val / 1024**3:.2f} GB"
    elif bytes_val >= 1024**2:
        return f"{bytes_val / 1024**2:.2f} MB"
    return f"{bytes_val} Bytes"

def select_model(client: ollama.Client) -> str | None:
    """
    Lists available models using client.list() and accesses properties 
    as attributes (model.model, model.size) based on the library's object structure.
    """
    print("="*50)
    print("--- Ollama Model Selection ---")
    
    try:
        # Get list of local models
        # This returns an object (ListResponse), not a dictionary
        response = client.list()
        
        # Access the models list via the 'models' attribute of the response object
        models = getattr(response, 'models', [])
        
        if not models:
            print("[ERROR] No models found on your local Ollama instance.")
            print("Please pull a model first, e.g., 'ollama pull llama3'.")
            return None

        print("Available models:")
        
        model_map = {}
        model_list_index = 1
        
        for model_info in models:
            # Use getattr() to safely access attributes 'model' and 'size'
            full_name = getattr(model_info, 'model', None)
            
            # Accessing size, which is a key object in the library's structure
            raw_size = getattr(model_info, 'size', None)
            # The size value might be nested or simply an attribute on the model object.
            # Assuming 'raw_size' is the actual byte count from the library response.
            
            if full_name and raw_size is not None:
                display_name = full_name.split(':')[0]
                formatted_size = format_size(raw_size)
                
                print(f"[{model_list_index}] {display_name} ({formatted_size})")
                model_map[model_list_index] = full_name
                model_list_index += 1
            else:
                print(f"[WARNING] Skipping malformed or incomplete model entry.")
                # print(f"Raw info: {model_info}") # Uncomment for deeper debugging if needed

        if not model_map:
            print("[ERROR] No valid models were found after checking the Ollama response.")
            return None

        while True:
            choice = input("Enter the number of the model to use: ").strip()
            try:
                choice_num = int(choice)
                if choice_num in model_map:
                    chosen_model = model_map[choice_num]
                    print(f"\n[INFO] Selected model: {chosen_model}")
                    return chosen_model
                else:
                    print("Invalid choice. Please enter a number from the list.")
            except ValueError:
                print("Invalid input. Please enter a number.")
                
    except Exception as e:
        print(f"\n[FATAL] Failed to retrieve model list from Ollama: {e}")
        print(f"Ensure the Ollama service is running at {OLLAMA_HOST}.")
        return None

def main():
    """Main function to run the interactive chat session."""
    
    # 1. Select System Prompt
    system_prompt, prompt_filepath = select_system_prompt()
    if not system_prompt:
        return

    # 2. Initialize Ollama Client
    try:
        client = ollama.Client(host=OLLAMA_HOST)
    except Exception as e:
        print(f"\n[FATAL] Could not connect to Ollama at {OLLAMA_HOST}. Is the service running?")
        print(f"Error details: {e}")
        return

    # 3. Select Model Interactively
    chosen_model = select_model(client)
    if not chosen_model:
        return
        
    # 4. Initialize Chat and Start Roleplay
    
    # Initialize chat history with the system instruction
    messages = [
        {'role': 'system', 'content': system_prompt},
    ]

    # Get the base character name from the prompt filename for the display name
    # Example: 'ranger.prompt' -> 'Ranger'
    character_name = os.path.basename(prompt_filepath).split('.')[0].title()
    model_short_name = chosen_model.split(':')[0]

    print("\n" + "="*50)
    print(f"D&D Roleplay Chat Started with Model: {chosen_model}")
    print(f"Character Persona Loaded from: {prompt_filepath}")
    print("Type 'quit' or 'exit' to end the session.")
    print("="*50 + "\n")

    # Start the initial scenario (The first message is often the GM setting the scene)
    print("GM: The sun dips below the horizon, casting long, purple shadows across the rugged mountainside. You stand at the edge of the Whispering Woods, finding fresh, clumsy goblin tracks leading into the gloom.")
    
    try:
        while True:
            user_input = input("\nYou (Adventurer): ").strip()
            
            if user_input.lower() in ['quit', 'exit']:
                print("\nEnding the roleplay. Farewell, Adventurer!")
                break
            
            if not user_input:
                continue

            # Add user message to history
            messages.append({'role': 'user', 'content': user_input})

            # Stream the Ollama response
            print(f"\n{character_name} ({model_short_name}): ", end="", flush=True)
            
            full_response = ""
            try:
                # Use client.chat with streaming (this still requires the ollama library)
                stream = client.chat(
                    model=chosen_model,
                    messages=messages,
                    stream=True,
                )
                
                for chunk in stream:
                    content = chunk['message']['content']
                    print(content, end="", flush=True)
                    full_response += content

                print() # Newline after streaming is complete

                # Add the full model response to history
                if full_response:
                    messages.append({'role': 'assistant', 'content': full_response})
                
            except ollama.ResponseError as e:
                print(f"\n[OLLAMA ERROR] Could not get response: {e}")
                # Remove the last user message to allow retry on next loop
                messages.pop()
            
    except KeyboardInterrupt:
        print("\n\nEnding the roleplay via Ctrl+C. Farewell, Adventurer!")

if __name__ == "__main__":
    main()