(function detectProblem() {
  const url = window.location.href;

  // CASE 1: LeetCode
  if (url.includes("leetcode.com/problems/")) {
    const parts = url.split("/");
    const slug = parts[parts.indexOf("problems") + 1];

    if (slug) {
      const title = slug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      chrome.storage.local.set({
        currentProblem: title,
        platform: "leetcode"
      });
    }
  }

})();














