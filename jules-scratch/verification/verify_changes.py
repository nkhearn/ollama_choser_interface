
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:5000")

    # Wait for the model select to have at least one option
    page.wait_for_selector("#model-select > option:nth-child(2)")

    # Select a model and prompt
    page.select_option("#model-select", index=1)
    page.select_option("#prompt-select", index=1)

    # Start the chat
    page.click("#start-chat-btn")

    # Wait for the chat screen to be visible
    page.wait_for_selector("#chat-screen")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
