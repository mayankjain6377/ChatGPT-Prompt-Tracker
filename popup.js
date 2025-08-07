// Fetch prompts from the current tab
chrome.runtime.sendMessage({ type: "getPrompts" }, (response) => {
  const container = document.getElementById("prompts-container");
  container.innerHTML = "";

  if (!response || !response.prompts || response.prompts.length === 0) {
    container.textContent = "No prompts found.";
    return;
  }

  response.prompts.forEach((prompt, index) => {
    const div = document.createElement("div");
    div.className = "prompt";
    div.textContent = `${index + 1}. ${prompt.text}`;
    div.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "scrollToPrompt",
          index: prompt.index,
        });
      });
    });
    container.appendChild(div);
  });
});
