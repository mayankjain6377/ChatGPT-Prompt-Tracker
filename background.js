chrome.runtime.onInstalled.addListener(() => {
    console.log('ChatGPT Prompt Tracker extension installed.');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'savePrompt') {
        savePrompt(request.prompt);
        sendResponse({ status: 'success' });
    }
});

// Save prompt to chrome.storage
function savePrompt(prompt) {
    chrome.storage.local.get({ prompts: [] }, (result) => {
        const prompts = result.prompts;
        prompts.push({
            text: prompt,
            timestamp: Date.now()
        });
        chrome.storage.local.set({ prompts });
    });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getPrompts") {
    chrome.storage.local.get(["prompts"], (result) => {
      sendResponse({ prompts: result.prompts || [] });
    });
    return true; // Required to indicate async sendResponse
  }
});

// Optional: Expose a method to get all prompts
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === 'getPrompts') {
//         chrome.storage.local.get({ prompts: [] }, (result) => {
//             sendResponse({ prompts: result.prompts });
//         });
//         return true; // Indicates async response
//     }
// });