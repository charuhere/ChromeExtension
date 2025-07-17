let currentHintIndex = 0;
let hintList = [];
let isStreaming = false;

const totalSection = document.querySelector(".total");
const titleElement = document.getElementById("title");
const hintElement = document.getElementById("hint");
const nextHintBtn = document.getElementById("nextHint");
const similarList = document.getElementById("similarList");

// Helper function to convert problem title to LeetCode URL
function convertToLeetCodeUrl(problemTitle) {
  if (!problemTitle) return null;
  
  // Remove common prefixes and clean the title
  let cleanTitle = problemTitle
    .replace(/^(Problem\s+\d+:\s*|•\s*|\*\s*|\d+\.\s*)/i, '') // Remove "Problem X:", bullets, numbers
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content like "(Easy)", "(Medium)", "(Hard)"
    .replace(/\s*-\s*(Easy|Medium|Hard)\s*/gi, '') // Remove difficulty indicators
    .trim();
  
  // Convert to URL slug format
  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  return `https://leetcode.com/problems/${slug}/`;
}

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
        // Start streaming hints and similar problems concurrently
        await Promise.all([
          streamHints(currentProblem, platform),
          streamSimilarProblems(currentProblem, platform)
        ]);

      } catch (err) {
        console.error("Error:", err);
        hintElement.innerText = "Something went wrong while fetching data.";
        similarList.innerHTML = "<li>Error loading similar problems.</li>";
      }
    } else {
      totalSection.style.display = "none";
      titleElement.innerText = "Problem not detected.";
    }
  });
});

// Streaming function for hints
async function streamHints(problem, platform) {
  return new Promise((resolve, reject) => {
    isStreaming = true;
    hintElement.innerHTML = '<span style="color: #666;">🔄 Generating hints...</span>';
    
    // Disable next hint button during streaming
    nextHintBtn.disabled = true;
    nextHintBtn.style.opacity = '0.5';
    
    const hints = {}; // Store hints by number
    let displayedHintNumber = 1;
    
    fetch("http://localhost:3000/generate-hint-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem, platform })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      function readStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Finalize hints from the hints object
            hintList = [];
            for (let i = 1; i <= 3; i++) {
              if (hints[i] && hints[i].trim()) {
                hintList.push(hints[i].trim());
              }
            }
            
            // Display first hint if available
            currentHintIndex = 0;
            if (hintList.length > 0) {
              hintElement.innerHTML = hintList[0];
            } else {
              hintElement.innerHTML = "No hints received.";
            }
            
            // Re-enable next hint button
            nextHintBtn.disabled = false;
            nextHintBtn.style.opacity = '1';
            isStreaming = false;
            
            resolve();
            return;
          }
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'raw_token':
                    // Raw streaming token - could be used for debug
                    break;
                    
                  case 'hint_update':
                    // Store/update hint
                    hints[data.number] = data.hint;
                    
                    // If this is the first hint, show it streaming
                    if (data.number === 1) {
                      hintElement.innerHTML = `<span style="color: #1976d2;">💡 Hint 1: </span>${data.hint}`;
                    }
                    break;
                    
                  case 'hint_final':
                    // Final version of hint
                    hints[data.number] = data.hint;
                    
                    // Update display if it's the currently shown hint
                    if (data.number === 1) {
                      hintElement.innerHTML = data.hint;
                    }
                    break;
                    
                  case 'done':
                    // Stream completed
                    break;
                    
                  case 'error':
                    throw new Error(data.message);
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
          
          return readStream();
        });
      }
      
      return readStream();
    })
    .catch(error => {
      console.error('Streaming error:', error);
      hintElement.innerText = "Error generating hints.";
      nextHintBtn.disabled = false;
      nextHintBtn.style.opacity = '1';
      isStreaming = false;
      reject(error);
    });
  });
}

// Streaming function for similar problems
async function streamSimilarProblems(problem, platform) {
  return new Promise((resolve, reject) => {
    similarList.innerHTML = '<li style="color: #666;">🔄 Finding similar problems...</li>';
    
    const problems = {}; // Store problems by number
    
    fetch("http://localhost:3000/similar-problems-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem, platform })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      function readStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Finalize similar problems display
            const problemNumbers = Object.keys(problems).sort((a, b) => parseInt(a) - parseInt(b));
            
            similarList.innerHTML = "";
            if (problemNumbers.length > 0) {
              problemNumbers.forEach(number => {
                const problemText = problems[number];
                if (problemText && problemText.trim()) {
                  const li = document.createElement("li");
                  li.style.cssText = `
                    margin-bottom: 8px;
                    padding: 8px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: #f9f9f9;
                    transition: background-color 0.2s ease;
                  `;
                  
                  // Create clickable link
                  const link = document.createElement("a");
                  const leetcodeUrl = convertToLeetCodeUrl(problemText);
                  
                  link.href = "#";
                  link.style.cssText = `
                    color: #1976d2;
                    text-decoration: none;
                    font-weight: 500;
                    display: block;
                    padding: 4px 0;
                  `;
                  link.textContent = problemText.trim();
                  
                  // Add click handler
                  link.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (leetcodeUrl) {
                      chrome.tabs.create({ url: leetcodeUrl });
                      window.close(); // Close popup after opening link
                    }
                  });
                  
                  // Add hover effect
                  link.addEventListener("mouseenter", () => {
                    link.style.textDecoration = "underline";
                    li.style.backgroundColor = "#f0f0f0";
                  });
                  
                  link.addEventListener("mouseleave", () => {
                    link.style.textDecoration = "none";
                    li.style.backgroundColor = "#f9f9f9";
                  });
                  
                  li.appendChild(link);
                  similarList.appendChild(li);
                }
              });
            } else {
              similarList.innerHTML = "<li>No similar problems found.</li>";
            }
            
            resolve();
            return;
          }
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'problem_start':
                    problems[data.number] = '';
                    
                    // Add a placeholder for the streaming problem
                    const li = document.createElement("li");
                    li.id = `problem-${data.number}`;
                    li.style.cssText = `
                      margin-bottom: 8px;
                      padding: 8px;
                      border: 1px solid #e0e0e0;
                      border-radius: 4px;
                      background-color: #f9f9f9;
                      min-height: 40px;
                    `;
                    li.innerHTML = '<span style="color: #1976d2;">📝 </span><span class="streaming-problem">Loading problem...</span>';
                    
                    // Clear loading message on first problem
                    if (data.number === 1) {
                      similarList.innerHTML = '';
                    }
                    
                    similarList.appendChild(li);
                    break;
                    
                  case 'problem_token':
                    problems[data.number] += data.token;
                    
                    // Update the streaming display
                    const streamingElement = document.querySelector(`#problem-${data.number} .streaming-problem`);
                    if (streamingElement) {
                      streamingElement.textContent = problems[data.number];
                    }
                    break;
                    
                  case 'problem_complete':
                    problems[data.number] = data.problem;
                    
                    // Update final display with clickable link
                    const completedElement = document.getElementById(`problem-${data.number}`);
                    if (completedElement) {
                      const problemText = data.problem.trim();
                      const leetcodeUrl = convertToLeetCodeUrl(problemText);
                      
                      // Create clickable link
                      const link = document.createElement("a");
                      link.href = "#";
                      link.style.cssText = `
                        color: #1976d2;
                        text-decoration: none;
                        font-weight: 500;
                        display: block;
                        padding: 4px 0;
                      `;
                      link.textContent = problemText;
                      
                      // Add click handler
                      link.addEventListener("click", (e) => {
                        e.preventDefault();
                        if (leetcodeUrl) {
                          chrome.tabs.create({ url: leetcodeUrl });
                          window.close(); // Close popup after opening link
                        }
                      });
                      
                      // Add hover effect
                      link.addEventListener("mouseenter", () => {
                        link.style.textDecoration = "underline";
                        completedElement.style.backgroundColor = "#f0f0f0";
                      });
                      
                      link.addEventListener("mouseleave", () => {
                        link.style.textDecoration = "none";
                        completedElement.style.backgroundColor = "#f9f9f9";
                      });
                      
                      completedElement.innerHTML = '';
                      completedElement.appendChild(link);
                    }
                    break;
                    
                  case 'done':
                    // All problems completed
                    break;
                    
                  case 'error':
                    throw new Error(data.message);
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
          
          return readStream();
        });
      }
      
      return readStream();
    })
    .catch(error => {
      console.error('Streaming error:', error);
      similarList.innerHTML = "<li>Error loading similar problems.</li>";
      reject(error);
    });
  });
}

// Handle next hint button
nextHintBtn.addEventListener("click", () => {
  if (isStreaming) {
    return; // Don't allow navigation while streaming
  }
  
  if (currentHintIndex < hintList.length - 1) {
    currentHintIndex++;
    hintElement.innerHTML = hintList[currentHintIndex];
  } else {
    hintElement.innerHTML = "No more hints available!";
  }
});