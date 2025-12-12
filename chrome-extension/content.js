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
  if (!editor) {
    console.log("❌ Monaco editor not found");
    return null;
  }
  
  const codeLines = editor.querySelectorAll('.view-line');
  if (!codeLines || codeLines.length === 0) {
    console.log("❌ No code lines found");
    return null;
  }
  
  // Convert NodeList to Array before using map
  const code = Array.from(codeLines).map(line => line.textContent).join('\n').trim();
  console.log("✅ Extracted code, length:", code.length);
  
  // Check if code is empty or just whitespace
  if (!code || code.length === 0) {
    console.log("❌ Code is empty");
    return null;
  }
  
  // Check if it's just the default template (common patterns)
  const defaultPatterns = [
    /^class\s+Solution\s*{\s*public:\s*}\s*;?\s*$/,  // Empty C++ class
    /^class\s+Solution\s*{\s*}\s*$/,  // Empty Java/JS class
    /^def\s+\w+\([^)]*\):\s*pass\s*$/,  // Python pass
    /^function\s+\w+\([^)]*\)\s*{\s*}\s*$/  // Empty JS function
  ];
  
  const isDefaultTemplate = defaultPatterns.some(pattern => pattern.test(code));
  
  if (isDefaultTemplate) {
    console.log("❌ Code is just default template");
    return null;
  }
  
  return code;
}

/**
 * This is the crucial message listener. It waits for a request from popup.js.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message received:", request);
  
  if (request.type === "GET_USER_CODE") {
    const userCode = getEditorCode();
    if (userCode && userCode.trim()) {
      console.log("✅ Sending code back to popup");
      sendResponse({ code: userCode });
    } else {
      console.log("❌ No code found in editor");
      sendResponse({ error: "Please write some code first. The editor is empty or contains only template code." });
    }
  }
  return true;
});

/**
 * A function to detect the problem from the URL and save it to storage.
 */
function detectAndStoreProblem() {
  const title = extractLeetCodeProblemTitle(location.href);
  if (title) {
    try {
      chrome.storage.local.set({ currentProblem: title, platform: "leetcode" });
      console.log("✅ Problem detected:", title);
    } catch (error) {
      // Extension context invalidated - page needs refresh
      console.log("⚠️ Extension context invalidated - please refresh page");
    }
  }
}

/**
 * Create floating button that reminds user to click extension icon
 */
function createFloatingButton() {
  if (document.getElementById('ch-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'ch-btn';
  btn.innerHTML = '💡';
  btn.title = 'Click to open CodeHint Assistant';
  btn.style.cssText = `position:fixed;bottom:30px;right:30px;width:56px;height:56px;background:#2a2a2a;border:2px solid #60a5fa;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999999;transition:transform 0.3s`;
  
  btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
  btn.onmouseleave = () => btn.style.transform = 'scale(1)';
  btn.onclick = () => {
    // Show tooltip telling user to click extension icon
    showTooltip();
  };
  
  document.body.appendChild(btn);
}

function showTooltip() {
  const existing = document.getElementById('ch-tooltip');
  if (existing) return;

  const tooltip = document.createElement('div');
  tooltip.id = 'ch-tooltip';
  tooltip.innerHTML = '👆 Click the extension icon in your browser toolbar';
  tooltip.style.cssText = `position:fixed;bottom:95px;right:30px;background:#1a1a1a;color:#60a5fa;padding:12px 16px;border:2px solid #60a5fa;border-radius:8px;font-size:13px;z-index:999999;animation:fadeIn 0.3s`;
  
  const style = document.createElement('style');
  style.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(style);
  
  document.body.appendChild(tooltip);
  
  setTimeout(() => tooltip.remove(), 3000);
}

// --- Script Execution ---
detectAndStoreProblem();
setTimeout(createFloatingButton, 1000);

let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    detectAndStoreProblem();
    createFloatingButton();
  }
}).observe(document, { subtree: true, childList: true });