let currentHintIndex = 0;
let hintList = [];

const totalSection = document.querySelector(".total");
const titleElement = document.getElementById("title");
const hintElement = document.getElementById("hint");
const nextHintBtn = document.getElementById("nextHint");
const similarList = document.getElementById("similarList");

// First, check if we're on a LeetCode problem page
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const currentTab = tabs[0];
  const isLeetCodeProblemPage = currentTab.url.includes("leetcode.com/problems/") && !currentTab.url.includes("problemset");
  
  if (!isLeetCodeProblemPage) {
    // If not on a problem page, show "Problem not detected" with link
    totalSection.style.display = "none";
    titleElement.innerHTML = `
      Problem not detected.<br>
      <a href="#" id="goToLeetCode" style="color: #1976d2; text-decoration: underline; cursor: pointer; font-size: 14px;">
        Go to LeetCode Problems
      </a>
    `;
    
    // Add click handler for the link
    document.getElementById("goToLeetCode").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "https://leetcode.com/problemset/all/" });
      window.close(); // Close the popup after redirecting
    });
    
    return;
  }
  
  // If on a problem page, check storage
  chrome.storage.local.get(["currentProblem", "platform"], async ({ currentProblem, platform }) => {
    if (currentProblem && platform) {
    totalSection.style.display = "block";
    titleElement.innerText = `Problem: ${currentProblem}`;

    try {
      // Fetch hints
      const hintResponse = await fetch("http://localhost:3000/generate-hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ problem: currentProblem, platform })
      });

      const hintData = await hintResponse.json();

      if (hintData.hints && hintData.hints.length > 0) {
        hintList = hintData.hints;
        currentHintIndex = 0;
        hintElement.innerText = hintList[0];
      } else {
        hintElement.innerText = "No hints received.";
      }

      // Fetch similar problems
      const similarResponse = await fetch("http://localhost:3000/similar-problems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ problem: currentProblem, platform })
      });

      const similarData = await similarResponse.json();

      if (similarData.similarProblems && similarData.similarProblems.length > 0) {
        similarList.innerHTML = ""; // Clear previous
        similarData.similarProblems.forEach(problem => {
          const li = document.createElement("li");
          li.textContent = problem;
          similarList.appendChild(li);
        });
      } else {
        similarList.innerHTML = "<li>No similar problems found.</li>";
      }

    } catch (err) {
      console.error("Error:", err);
      hintElement.innerText = "Something went wrong while fetching data.";
    }
    } else {
      totalSection.style.display = "none";
      titleElement.innerText = "Problem not detected.";
    }
  });
});

nextHintBtn.addEventListener("click", () => {
  if (currentHintIndex < hintList.length - 1) {
    currentHintIndex++;
    hintElement.innerText = hintList[currentHintIndex];
  } else {
    hintElement.innerText = "No more hints available!";
  }
});

