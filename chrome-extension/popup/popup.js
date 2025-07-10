let currentHintIndex = 0;
let hintList = [];

const totalSection = document.querySelector(".total");


chrome.storage.local.get(["currentProblem", "platform"], async ({ currentProblem, platform }) => {
  if (currentProblem && platform) {
    totalSection.style.display = "block";
    document.getElementById("title").innerText = `Problem: ${currentProblem}`;

    try {
      const response = await fetch("http://localhost:3000/generate-hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ problem: currentProblem, platform })
      });

      const data = await response.json();

      if (data.hints && data.hints.length > 0) {
        // ✅ Save all the hints from backend
        hintList = data.hints;
        currentHintIndex = 0;
        document.getElementById("hint").innerText = hintList[0];
      } else {
        document.getElementById("hint").innerText = "No hints received.";
      }

    } catch (err) {
      console.error("Error fetching hint:", err);
      document.getElementById("hint").innerText = "Error fetching hint from server.";
    }

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


