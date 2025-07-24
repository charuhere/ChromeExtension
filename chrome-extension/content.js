// content.js (Final Version)

/**
 * Extracts the problem title from the current LeetCode URL.
 */
function extractLeetCodeProblemTitle(url) {
  const match = url.match(/leetcode\.com\/problems\/([a-zA-Z0-9-]+)\/?/);
  if (match && match[1]) {
    const slug = match[1];
    return slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }
  return null;
}

/**
 * Extracts the user's code from the Monaco code editor on the page.
 */
function getEditorCode() {
  const editor = document.querySelector('.monaco-editor');
  if (!editor) return null;

  let codeLines = editor.querySelectorAll('.view-lines > .view-line');
  if (codeLines.length === 0) {
    // Fallback selector if the primary one fails
    codeLines = editor.querySelectorAll('.view-line');
  }
  return Array.from(codeLines).map(line => line.textContent).join('\n');
}

/**
 * This is the crucial message listener. It waits for a request from popup.js.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_USER_CODE") {
    const userCode = getEditorCode();
    if (userCode && userCode.trim()) {
      // If code is found, send it back to the popup
      sendResponse({ code: userCode });
    } else {
      // If no code is found, send an error message back
      sendResponse({ error: "Could not find code in the editor." });
    }
  }
  // Return true to keep the message channel open for the asynchronous response.
  return true;
});


/**
 * A function to detect the problem from the URL and save it to storage.
 */
function detectAndStoreProblem() {
  const title = extractLeetCodeProblemTitle(location.href);
  if (title) {
    chrome.storage.local.set({ currentProblem: title, platform: "leetcode" });
  }
}

// --- Script Execution ---

// Run detection when the script is first injected.
detectAndStoreProblem();

// LeetCode is a Single Page Application, so we must also detect when the user
// navigates to a new problem without a full page reload.
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    detectAndStoreProblem();
  }
}).observe(document, { subtree: true, childList: true });