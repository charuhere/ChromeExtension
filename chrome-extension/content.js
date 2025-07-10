(() => {

  function extractLeetCodeProblemTitle(url) {
    if (url.includes("leetcode.com/problems/") && !url.includes("problemset")) {
      const parts = url.split("/");
      const slug = parts[parts.indexOf("problems") + 1];

      if (slug) {
        return slug
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }
    

    return null;
  }

  // Function to detect and store current problem info in Chrome's local storage
  function detectAndStoreProblem() {
    const title = extractLeetCodeProblemTitle(location.href);
  
    if (title) {
      chrome.storage.local.set({
        currentProblem: title,
        platform: "leetcode"
      });
      console.log("[CodeHint] Problem stored:", title);
    } else {
      chrome.storage.local.remove(["currentProblem", "platform"]);
      console.log("[CodeHint] Not a problem page. Storage cleared.");
      document.getElementById("title").innerText = "Problem not detected.";
    }
  }

  // Initial run when the script is loaded
  detectAndStoreProblem();

  // Set up a MutationObserver to monitor for changes in the DOM (LeetCode is SPA)
  const observer = new MutationObserver(() => {
    detectAndStoreProblem();
  });

  // Start observing the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("[CodeHint] MutationObserver initialized.");
})();


