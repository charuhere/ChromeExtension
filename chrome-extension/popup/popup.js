let currentHintIndex = 0;
let hintList = [];

chrome.storage.local.get(["currentProblem", "platform"], async ({ currentProblem, platform }) => {
  if (currentProblem && platform) {
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

      if (data.hint) {
        hintList = [data.hint]; // start with one hint from backend
        currentHintIndex = 0;
        document.getElementById("hint").innerText = hintList[0];
      } else {
        document.getElementById("hint").innerText = "No hint received.";
      }

    } catch (err) {
      console.error("Error fetching hint:", err);
      document.getElementById("hint").innerText = "Error fetching hint from server.";
    }

  } else {
    document.getElementById("title").innerText = "Problem not detected.";
  }
});

// For now, 'Next Hint' just repeats the current one or shows no more
document.getElementById("nextHint").addEventListener("click", () => {
  if (currentHintIndex < hintList.length - 1) {
    currentHintIndex++;
    document.getElementById("hint").innerText = hintList[currentHintIndex];
  } else {
    document.getElementById("hint").innerText = "No more hints available!";
  }
});
