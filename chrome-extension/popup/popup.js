let currentHintIndex = 0;
let hintList = [];

chrome.storage.local.get(["currentProblem", "platform"], ({ currentProblem, platform }) => {
  if (currentProblem && platform) {
    document.getElementById("title").innerText = `Problem: ${currentProblem}`;

    // 🔧 TEMPORARY STATIC HINTS (for testing before backend)
    hintList = getDummyHints(currentProblem, platform);
    document.getElementById("hint").innerText = hintList[0] || "No hints available.";
  } else {
    document.getElementById("title").innerText = "Problem not detected.";
  }
});

document.getElementById("nextHint").addEventListener("click", () => {
  if (currentHintIndex < hintList.length - 1) {
    currentHintIndex++;
    document.getElementById("hint").innerText = hintList[currentHintIndex];
  } else {
    document.getElementById("hint").innerText = "No more hints available!";
  }
});

// TEMPORARY hint loader
function getDummyHints(problem, platform) {
  const dummy = {
    leetcode: {
      "Two Sum": [
        "Think about using a hashmap.",
        "Try storing value → index mappings.",
        "Can you do it in one pass?"
      ],
      "Reverse Linked List": [
        "Use iteration to reverse links.",
        "Can a stack help you?",
        "Try a recursive approach as well."
      ]
    },
    hackerrank: {
      "Solve Me First": [
        "It's just a function that adds two numbers.",
        "You only need to return a + b.",
        "Don't overthink!"
      ]
    }
  };

  return dummy[platform]?.[problem] || ["No hints found for this problem."];
}

