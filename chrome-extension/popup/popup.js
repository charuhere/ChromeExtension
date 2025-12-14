// =================================================================
// === CONFIGURATION                                             ===
// =================================================================
const API_BASE = 'http://localhost:3000';
const ENDPOINTS = {
  hints: '/generate-hint-stream',
  similar: '/similar-problems-stream',
  analysis: '/analyze-code-stream'
};

// =================================================================
// === STATE MANAGEMENT                                          ===
// =================================================================
const state = {
  hints: [],
  currentHintIndex: 0,
  hintsCache: {} // Store hints by problem name
};

// =================================================================
// === DOM ELEMENTS (Cached for performance)                     ===
// =================================================================
const elements = {
  problemTitle: document.getElementById('problemTitle'),
  views: {
    menu: document.getElementById('menuView'),
    hints: document.getElementById('hintsView'),
    similar: document.getElementById('similarView'),
    analysis: document.getElementById('analysisView')
  },
  buttons: {
    getHints: document.getElementById('getHintsBtn'),
    viewSimilar: document.getElementById('viewSimilarBtn'),
    analyzeCode: document.getElementById('analyzeCodeBtn')
  },
  hints: {
    content: document.getElementById('hintContent'),
    next: document.getElementById('nextHintBtn'),
    prev: document.getElementById('prevHintBtn'),
    back: document.getElementById('backFromHintsBtn')
  },
  similar: {
    container: document.getElementById('similarProblemsContainer'),
    back: document.getElementById('backFromSimilarBtn')
  },
  analysis: {
    content: document.getElementById('analysisContent'),
    back: document.getElementById('backFromAnalysisBtn')
  }
};

// =================================================================
// === UTILITY FUNCTIONS                                         ===
// =================================================================

function convertToLeetCodeUrl(problemTitle) {
  if (!problemTitle) return null;
  const slug = problemTitle
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  return `https://leetcode.com/problems/${slug}/`;
}

function showView(viewName) {
  Object.values(elements.views).forEach(view => view.style.display = 'none');
  elements.views[viewName].style.display = 'block';
}

function setLoadingState(element, message) {
  element.innerHTML = `<div class="loading"><div class="spinner"></div><i>${message}</i></div>`;
}

function setErrorState(element, message) {
  element.innerHTML = `<div class="error">❌ ${message}</div>`;
}

// =================================================================
// === GENERIC STREAMING FUNCTION (DRY - No repetition!)         ===
// =================================================================

async function streamFromAPI(endpoint, body, onData, onComplete, onError) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'error') {
              onError(data.message);
              return;
            }
            onData(data);
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }

    if (onComplete) onComplete();
  } catch (error) {
    console.error('Stream error:', error);
    onError(error.message);
  }
}

// =================================================================
// === FEATURE 1: HINTS                                          ===
// =================================================================

async function handleGetHints() {
  showView('hints');

  const { currentProblem } = await chrome.storage.local.get('currentProblem');
  if (!currentProblem) {
    setErrorState(elements.hints.content, 'No problem detected');
    return;
  }

  // Check if hints already cached for this problem
  if (state.hintsCache[currentProblem]) {
    console.log('✅ Loading cached hints for:', currentProblem);
    state.hints = state.hintsCache[currentProblem];
    state.currentHintIndex = 0;
    displayCurrentHint();
    updateHintButtons();
    return;
  }

  // Not cached - fetch from API
  setLoadingState(elements.hints.content, '🔄 Generating hints...');
  elements.hints.next.style.display = 'none';

  let fullResponse = '';

  await streamFromAPI(
    ENDPOINTS.hints,
    { problem: currentProblem },
    (data) => {
      if (data.hint) fullResponse += data.hint;
    },
    () => {
      // Parse hints from response
      // We look for "**Hint X:**" markers. 
      // Using split is more robust than regex for capturing full content including newlines and symbols.
      const parts = fullResponse.split(/\*\*Hint \d:\*\*/).map(p => p.trim()).filter(p => p);

      if (parts.length > 0) {
        state.hints = parts;

        // Cache the hints for this problem
        state.hintsCache[currentProblem] = state.hints;
        console.log('💾 Cached hints for:', currentProblem);

        state.currentHintIndex = 0;
        displayCurrentHint();
        updateHintButtons();
      } else {
        elements.hints.content.innerHTML = fullResponse || 'No hints generated';
      }
    },
    (error) => setErrorState(elements.hints.content, error)
  );
}

function showNextHint() {
  state.currentHintIndex++;
  if (state.currentHintIndex < state.hints.length) {
    displayCurrentHint();
  }
  updateHintButtons();
}

function showPreviousHint() {
  if (state.currentHintIndex > 0) {
    state.currentHintIndex--;
    displayCurrentHint();
    updateHintButtons();
  }
}

function displayCurrentHint() {
  elements.hints.content.innerHTML =
    `<strong>Hint ${state.currentHintIndex + 1}:</strong> ${state.hints[state.currentHintIndex]}`;
}

function updateHintButtons() {
  // Show/hide Previous button
  if (elements.hints.prev) {
    elements.hints.prev.style.display = state.currentHintIndex > 0 ? 'block' : 'none';
  }

  // Show/hide Next button
  elements.hints.next.style.display =
    state.currentHintIndex < state.hints.length - 1 ? 'block' : 'none';
}

// =================================================================
// === FEATURE 2: SIMILAR PROBLEMS                               ===
// =================================================================

async function handleViewSimilar() {
  showView('similar');
  setLoadingState(elements.similar.container, '🔄 Finding similar problems...');

  const { currentProblem } = await chrome.storage.local.get('currentProblem');
  if (!currentProblem) {
    setErrorState(elements.similar.container, 'No problem detected');
    return;
  }

  elements.similar.container.innerHTML = '';
  let problemCount = 0;

  await streamFromAPI(
    ENDPOINTS.similar,
    { problem: currentProblem },
    (data) => {
      if (data.type === 'problem_complete') {
        problemCount++;
        const card = createProblemCard(data.problem);
        elements.similar.container.appendChild(card);
      }
    },
    () => {
      if (problemCount === 0) {
        elements.similar.container.innerHTML = '<i>No similar problems found</i>';
      }
    },
    (error) => setErrorState(elements.similar.container, error)
  );
}

function createProblemCard(problemTitle) {
  const card = document.createElement('a');
  card.href = convertToLeetCodeUrl(problemTitle);
  card.target = '_blank';
  card.className = 'problem-card';
  card.textContent = problemTitle;
  return card;
}

// =================================================================
// === FEATURE 3: CODE ANALYSIS                                  ===
// =================================================================

async function handleAnalyzeCode() {
  showView('analysis');
  setLoadingState(elements.analysis.content, '⏳ Getting code from editor...');

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_USER_CODE' }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      setErrorState(elements.analysis.content, 'Could not communicate with page. Try refreshing.');
      return;
    }

    if (response.error) {
      setErrorState(elements.analysis.content, response.error);
      return;
    }

    const { currentProblem } = await chrome.storage.local.get('currentProblem');

    elements.analysis.content.innerHTML = `
      <div class="analysis-result">
        <div class="complexity-row">
          <strong>Time:</strong> <span id="time-complexity" class="loading-dots">...</span>
        </div>
        <div class="complexity-row">
          <strong>Space:</strong> <span id="space-complexity" class="loading-dots">...</span>
        </div>
        <hr>
        <div class="explanation-section">
          <strong>Explanation:</strong>
          <div id="explanation-text" class="loading-dots">Analyzing...</div>
        </div>
      </div>
    `;

    await streamFromAPI(
      ENDPOINTS.analysis,
      { problem: currentProblem, code: response.code },
      (data) => {
        if (data.type === 'analysis_complete') {
          document.getElementById('time-complexity').textContent = data.time;
          document.getElementById('space-complexity').textContent = data.space;
          document.getElementById('explanation-text').textContent = data.explanation;
        }
      },
      null,
      (error) => setErrorState(elements.analysis.content, error)
    );
  });
}

// =================================================================
// === INITIALIZATION                                            ===
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const onProblemPage = tabs[0]?.url?.includes('leetcode.com/problems/');

  if (onProblemPage) {
    const { currentProblem } = await chrome.storage.local.get('currentProblem');
    elements.problemTitle.textContent = currentProblem || 'Problem Detected';
    Object.values(elements.buttons).forEach(btn => btn.disabled = false);
  } else {
    elements.problemTitle.innerHTML =
      'Not on a LeetCode problem page. <br><a href="#" id="goToLeetCode">Go to problems →</a>';

    document.getElementById('goToLeetCode')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://leetcode.com/problemset/' });
    });

    Object.values(elements.buttons).forEach(btn => btn.disabled = true);
  }

  // Event listeners
  elements.buttons.getHints.addEventListener('click', handleGetHints);
  elements.buttons.viewSimilar.addEventListener('click', handleViewSimilar);
  elements.buttons.analyzeCode.addEventListener('click', handleAnalyzeCode);

  elements.hints.back.addEventListener('click', () => showView('menu'));
  elements.hints.next.addEventListener('click', showNextHint);

  // Add Previous hint button listener
  if (elements.hints.prev) {
    elements.hints.prev.addEventListener('click', showPreviousHint);
  }
  elements.similar.back.addEventListener('click', () => showView('menu'));
  elements.analysis.back.addEventListener('click', () => showView('menu'));
});