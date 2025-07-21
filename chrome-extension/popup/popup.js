let currentHintIndex = 0;
let hintList = [];
let isStreaming = false;
let currentView = 'menu'; // 'menu', 'hints', 'similar'

// DOM elements
const problemTitle = document.getElementById("problemTitle");
const menuView = document.getElementById("menuView");
const hintsView = document.getElementById("hintsView");
const similarView = document.getElementById("similarView");

// Menu buttons
const getHintsBtn = document.getElementById("getHintsBtn");
const viewSimilarBtn = document.getElementById("viewSimilarBtn");
const analyzeCodeBtn = document.getElementById("analyzeCodeBtn");

// Hints view elements
const hintContent = document.getElementById("hintContent");
const nextHintBtn = document.getElementById("nextHintBtn");
const backFromHintsBtn = document.getElementById("backFromHintsBtn");

// Similar problems view elements
const similarProblemsContainer = document.getElementById("similarProblemsContainer");
const backFromSimilarBtn = document.getElementById("backFromSimilarBtn");

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

// View management functions
function showView(viewName) {
  // Hide all views
  menuView.style.display = 'none';
  hintsView.style.display = 'none';
  similarView.style.display = 'none';
  
  // Show requested view
  switch(viewName) {
    case 'menu':
      menuView.style.display = 'block';
      break;
    case 'hints':
      hintsView.style.display = 'block';
      break;
    case 'similar':
      similarView.style.display = 'block';
      break;
  }
  
  currentView = viewName;
}

// Initialize the extension
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const currentTab = tabs[0];
  const isLeetCodeProblemPage = currentTab.url.includes("leetcode.com/problems/") && !currentTab.url.includes("problemset");
  
  if (!isLeetCodeProblemPage) {
    // If not on a problem page, show "Problem not detected" with link
    problemTitle.innerHTML = `
      Problem not detected<br>
      <a href="#" id="goToLeetCode" style="color: #1976d2; text-decoration: underline; cursor: pointer; font-size: 14px; margin-top: 8px; display: inline-block;">
        Go to LeetCode Problems
      </a>
    `;
    
    // Hide menu buttons
    menuView.style.display = 'none';
    
    // Add click handler for the link
    document.getElementById("goToLeetCode").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "https://leetcode.com/problemset/all/" });
      window.close();
    });
    
    return;
  }
  
  // If on a problem page, check storage and show menu
  chrome.storage.local.get(["currentProblem", "platform"], async ({ currentProblem, platform }) => {
    if (currentProblem && platform) {
      problemTitle.textContent = currentProblem;
      showView('menu');
    } else {
      problemTitle.textContent = "Problem not detected";
      menuView.style.display = 'none';
    }
  });
});

// Button event listeners
getHintsBtn.addEventListener("click", async () => {
  showView('hints');
  hintContent.innerHTML = '<div style="text-align: center; color: #666;">🔄 Loading hints...</div>';
  
  try {
    chrome.storage.local.get(["currentProblem", "platform"], async ({ currentProblem, platform }) => {
      if (currentProblem && platform) {
        await streamHints(currentProblem, platform);
      }
    });
  } catch (error) {
    console.error("Error loading hints:", error);
    hintContent.innerHTML = '<div style="color: #f44336;">Error loading hints. Please try again.</div>';
  }
});

viewSimilarBtn.addEventListener("click", async () => {
  showView('similar');
  similarProblemsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">🔄 Finding similar problems...</div>';
  
  try {
    chrome.storage.local.get(["currentProblem", "platform"], async ({ currentProblem, platform }) => {
      if (currentProblem && platform) {
        await streamSimilarProblems(currentProblem, platform);
      }
    });
  } catch (error) {
    console.error("Error loading similar problems:", error);
    similarProblemsContainer.innerHTML = '<div style="color: #f44336; padding: 20px;">Error loading similar problems. Please try again.</div>';
  }
});

analyzeCodeBtn.addEventListener("click", () => {
  // Placeholder for future implementation
  alert("Analyze Code & Complexity feature will be implemented soon!");
});

// Back button event listeners
backFromHintsBtn.addEventListener("click", () => {
  showView('menu');
});

backFromSimilarBtn.addEventListener("click", () => {
  showView('menu');
});

// Next hint button event listener
nextHintBtn.addEventListener("click", () => {
  if (isStreaming) {
    return; // Don't allow navigation while streaming
  }
  
  if (currentHintIndex < hintList.length - 1) {
    currentHintIndex++;
    hintContent.innerHTML = hintList[currentHintIndex];
    updateHintCounter();
  } else {
    hintContent.innerHTML = '<div style="color: #ff9800; text-align: center;">No more hints available!</div>';
    nextHintBtn.disabled = true;
    nextHintBtn.style.opacity = '0.5';
  }
});

// Function to update hint counter
function updateHintCounter() {
  const hintCounter = document.getElementById("hintCounter");
  if (hintCounter) {
    hintCounter.textContent = `${currentHintIndex + 1} / ${hintList.length}`;
  }
}

// Streaming function for hints
async function streamHints(problem, platform) {
  return new Promise((resolve, reject) => {
    isStreaming = true;
    hintContent.innerHTML = '<div style="text-align: center; color: #666;">🔄 Generating hints...</div>';
    
    // Disable next hint button during streaming
    nextHintBtn.disabled = true;
    nextHintBtn.style.opacity = '0.5';
    
    const hints = {}; // Store hints by number
    
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
              hintContent.innerHTML = hintList[0];
              updateHintCounter();
            } else {
              hintContent.innerHTML = '<div style="color: #f44336;">No hints received.</div>';
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
                  case 'hint_update':
                    hints[data.number] = data.hint;
                    
                    // If this is the first hint, show it streaming
                    if (data.number === 1) {
                      hintContent.innerHTML = `<div style="color: #1976d2;">💡 Hint 1: </div><div style="margin-top: 8px;">${data.hint}</div>`;
                    }
                    break;
                    
                  case 'hint_final':
                    hints[data.number] = data.hint;
                    
                    // Update display if it's the currently shown hint
                    if (data.number === 1) {
                      hintContent.innerHTML = `<div>${data.hint}</div>`;
                    }
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
      hintContent.innerHTML = '<div style="color: #f44336;">Error generating hints. Please try again.</div>';
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
    similarProblemsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">🔄 Finding similar problems...</div>';
    
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
            
            similarProblemsContainer.innerHTML = "";
            if (problemNumbers.length > 0) {
              problemNumbers.forEach(number => {
                const problemText = problems[number];
                if (problemText && problemText.trim()) {
                  const problemCard = document.createElement("div");
                  problemCard.style.cssText = `
                    margin-bottom: 12px;
                    padding: 16px;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    background-color: #f9f9f9;
                    transition: all 0.2s ease;
                    cursor: pointer;
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
                    line-height: 1.4;
                  `;
                  link.textContent = problemText.trim();
                  
                  // Add click handler
                  link.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (leetcodeUrl) {
                      chrome.tabs.create({ url: leetcodeUrl });
                      window.close();
                    }
                  });
                  
                  // Add hover effect
                  problemCard.addEventListener("mouseenter", () => {
                    problemCard.style.backgroundColor = "#f0f0f0";
                    problemCard.style.transform = "translateY(-2px)";
                    problemCard.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                    link.style.textDecoration = "underline";
                  });
                  
                  problemCard.addEventListener("mouseleave", () => {
                    problemCard.style.backgroundColor = "#f9f9f9";
                    problemCard.style.transform = "translateY(0)";
                    problemCard.style.boxShadow = "none";
                    link.style.textDecoration = "none";
                  });
                  
                  problemCard.appendChild(link);
                  similarProblemsContainer.appendChild(problemCard);
                }
              });
            } else {
              similarProblemsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No similar problems found.</div>';
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
                    const placeholder = document.createElement("div");
                    placeholder.id = `problem-${data.number}`;
                    placeholder.style.cssText = `
                      margin-bottom: 12px;
                      padding: 16px;
                      border: 1px solid #e0e0e0;
                      border-radius: 8px;
                      background-color: #f9f9f9;
                      min-height: 50px;
                    `;
                    placeholder.innerHTML = '<div style="color: #1976d2;">📝 <span class="streaming-problem">Loading problem...</span></div>';
                    
                    // Clear loading message on first problem
                    if (data.number === 1) {
                      similarProblemsContainer.innerHTML = '';
                    }
                    
                    similarProblemsContainer.appendChild(placeholder);
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
                        line-height: 1.4;
                      `;
                      link.textContent = problemText;
                      
                      // Add click handler
                      link.addEventListener("click", (e) => {
                        e.preventDefault();
                        if (leetcodeUrl) {
                          chrome.tabs.create({ url: leetcodeUrl });
                          window.close();
                        }
                      });
                      
                      // Add hover effect
                      completedElement.addEventListener("mouseenter", () => {
                        completedElement.style.backgroundColor = "#f0f0f0";
                        completedElement.style.transform = "translateY(-2px)";
                        completedElement.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                        link.style.textDecoration = "underline";
                      });
                      
                      completedElement.addEventListener("mouseleave", () => {
                        completedElement.style.backgroundColor = "#f9f9f9";
                        completedElement.style.transform = "translateY(0)";
                        completedElement.style.boxShadow = "none";
                        link.style.textDecoration = "none";
                      });
                      
                      completedElement.innerHTML = '';
                      completedElement.appendChild(link);
                      completedElement.style.cursor = 'pointer';
                    }
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
      similarProblemsContainer.innerHTML = '<div style="color: #f44336; padding: 20px;">Error loading similar problems. Please try again.</div>';
      reject(error);
    });
  });
}

// Initialize the view
showView('menu');