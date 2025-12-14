// Extracts the problem title from the current LeetCode URL.
function extractLeetCodeProblemTitle(url) {
  const match = url.match(/leetcode\.com\/problems\/([a-zA-Z0-9-]+)\/?/);
  if (match && match[1]) {
    const slug = match[1];
    return slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }
  return null;
}

function getEditorCode() {
  const editor = document.querySelector('.monaco-editor');
  if (!editor) {
    console.log("❌ Monaco editor not found");
    return null;
  }

  const codeLines = editor.querySelectorAll('.view-line');
  if (!codeLines || codeLines.length === 0) {
    console.log("❌ No code lines found");
    return null;
  }

  const code = Array.from(codeLines).map(line => line.textContent).join('\n').trim();

  const defaultPatterns = [
    /^class\s+Solution\s*{\s*public:\s*}\s*;?\s*$/,  // Empty C++ class
    /^class\s+Solution\s*{\s*}\s*$/,  // Empty Java/JS class
    /^def\s+\w+\([^)]*\):\s*pass\s*$/,  // Python pass
    /^function\s+\w+\([^)]*\)\s*{\s*}\s*$/  // Empty JS function
  ];

  const isDefaultTemplate = defaultPatterns.some(pattern => pattern.test(code));

  if (isDefaultTemplate) {
    console.log("Code is just default template");
    return null;
  }

  return code;
}

// This is the crucial message listener. It waits for a request from popup.js.
// console.log("CodeHint: Content script loaded and listening");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log("CodeHint: Message received", request);

  if (request.type === "GET_USER_CODE") {
    const userCode = getEditorCode();
    if (userCode && userCode.trim()) {
      sendResponse({ code: userCode });
    } else {
      sendResponse({ error: "Please write some code first. The editor is empty or contains only template code." });
    }
  }
  return true;
});

// Detects the problem from the URL and save it to storage.
function detectAndStoreProblem() {
  const title = extractLeetCodeProblemTitle(location.href);
  if (title) {
    try {
      chrome.storage.local.set({ currentProblem: title, platform: "leetcode" });
    } catch (error) {
      console.log("Extension context invalidated - please refresh page");
    }
  }
}

// --- Script Execution ---
detectAndStoreProblem();

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    detectAndStoreProblem();
  }
}).observe(document, { subtree: true, childList: true });