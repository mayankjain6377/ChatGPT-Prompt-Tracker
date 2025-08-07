// Function to collect all user prompts
// Store the last prompt count to avoid redundant saves
let lastPromptCount = 0;

// Function to collect and store all user prompts
function collectPrompts() {
  try {
    const promptDivs = document.querySelectorAll(
      ".user-message-bubble-color .whitespace-pre-wrap"
    );

    const prompts = [...promptDivs].map((div, index) => ({
      index,
      text: div.innerText.trim(),
    }));

    if (prompts.length !== lastPromptCount) {
      lastPromptCount = prompts.length;
      chrome.storage.local.set({ prompts });
    }
  } catch (error) {
    console.error("Failed to collect prompts:", error);
  }
}

// Observe dynamic page updates (new messages)
const observer = new MutationObserver(() => {
  collectPrompts();
});

// Start observing once the DOM is ready
window.addEventListener("load", () => {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  collectPrompts(); // Initial call
  setTimeout(addPopupButton, 2000); // Add popup button
});

// Scroll to a specific prompt on request from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "scrollToPrompt") {
    try {
      const promptDivs = document.querySelectorAll(
        ".user-message-bubble-color .whitespace-pre-wrap"
      );
      const target = promptDivs[message.index];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        sendResponse({ status: "scrolled" });
      } else {
        console.warn("Prompt not found at index:", message.index);
        sendResponse({ status: "not_found" });
      }
    } catch (error) {
      console.error("Error scrolling to prompt:", error);
    }
  }
  return true;
});

// Function to add a button that opens the extension popup manually
function addPopupButton() {
  if (document.getElementById("prompt-tracker-toggle")) return;

  const button = document.createElement("button");
  button.id = "prompt-tracker-toggle";
  button.innerText = "📋 Prompts";
  button.style.position = "fixed";
  button.style.top = "80px";
  button.style.right = "20px";
  button.style.zIndex = "9999";
  button.style.padding = "8px 14px";
  button.style.background = "#10a37f";
  button.style.color = "#fff";
  button.style.border = "none";
  button.style.borderRadius = "8px";
  button.style.cursor = "pointer";
  button.style.fontWeight = "bold";
  button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";

  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "openPopup" });
  });

  
}