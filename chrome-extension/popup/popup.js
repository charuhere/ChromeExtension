// Waits for the HTML to be ready before running
document.addEventListener('DOMContentLoaded', () => {

    // --- State Variables ---
    let hintList = [];
    let currentHintIndex = 0;

    // --- DOM Elements ---
    const problemTitleEl = document.getElementById('problemTitle');
    const allViews = {
        menu: document.getElementById('menuView'),
        hints: document.getElementById('hintsView'),
        similar: document.getElementById('similarView'),
        analysis: document.getElementById('analysisView')
    };
    const menuButtons = {
        getHints: document.getElementById('getHintsBtn'),
        viewSimilar: document.getElementById('viewSimilarBtn'),
        analyzeCode: document.getElementById('analyzeCodeBtn')
    };
    const hintsElements = {
        content: document.getElementById('hintContent'),
        next: document.getElementById('nextHintBtn'),
        back: document.getElementById('backFromHintsBtn')
    };
    const similarElements = {
        container: document.getElementById('similarProblemsContainer'),
        back: document.getElementById('backFromSimilarBtn')
    };
    const analysisElements = {
        content: document.getElementById('analysisContent'),
        back: document.getElementById('backFromAnalysisBtn')
    };

    // --- Helper Function ---
    function convertToLeetCodeUrl(problemTitle) {
        if (!problemTitle) return null;
        const slug = problemTitle.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        return `https://leetcode.com/problems/${slug}/`;
    }

    // --- View Management ---
    const showView = (viewName) => {
        Object.values(allViews).forEach(view => view.style.display = 'none');
        if (allViews[viewName]) {
            allViews[viewName].style.display = 'block';
        }
    };

    // --- Initialization ---
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const onProblemPage = tabs[0] && tabs[0].url && tabs[0].url.includes("leetcode.com/problems/");
        if (onProblemPage) {
            chrome.storage.local.get("currentProblem", ({ currentProblem }) => {
                problemTitleEl.textContent = currentProblem || "Problem Detected";
                Object.values(menuButtons).forEach(btn => btn.disabled = false);
            });
        } else {
            problemTitleEl.innerHTML = 'Not on a LeetCode problem page. <br><a href="#" id="goToLeetCode">Go to problems &rarr;</a>';
            const goToLeetCodeLink = document.getElementById('goToLeetCode');
            if (goToLeetCodeLink) {
                goToLeetCodeLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    chrome.tabs.create({ url: "https://leetcode.com/problemset/" });
                });
            }
            Object.values(menuButtons).forEach(btn => btn.disabled = true);
        }
    });

    // --- Event Listeners ---
    menuButtons.getHints.addEventListener('click', handleGetHints);
    menuButtons.viewSimilar.addEventListener('click', handleViewSimilar);
    menuButtons.analyzeCode.addEventListener('click', handleAnalyzeCode);

    hintsElements.back.addEventListener('click', () => showView('menu'));
    hintsElements.next.addEventListener('click', showNextHint);

    similarElements.back.addEventListener('click', () => showView('menu'));
    analysisElements.back.addEventListener('click', () => showView('menu'));


    // --- Feature Handlers ---

    function handleGetHints() {
        showView('hints');
        hintsElements.content.innerHTML = '<i>🔄 Generating hints...</i>';
        hintsElements.next.style.display = 'none'; // Hide until hints are loaded
        chrome.storage.local.get(["currentProblem", "platform"], ({ currentProblem, platform }) => {
            if (currentProblem && platform) {
                streamHints(currentProblem, platform);
            }
        });
    }

    function handleViewSimilar() {
        showView('similar');
        similarElements.container.innerHTML = '<i>🔄 Finding similar problems...</i>';
        chrome.storage.local.get(["currentProblem", "platform"], ({ currentProblem, platform }) => {
            if (currentProblem && platform) {
                streamSimilarProblems(currentProblem, platform);
            }
        });
    }

    function handleAnalyzeCode() {
        showView('analysis');
        analysisElements.content.textContent = 'Getting code from editor...';
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: "GET_USER_CODE" }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    analysisElements.content.textContent = 'Error: Could not communicate with the page. Please refresh it.';
                    return;
                }
                if (response.error) {
                    analysisElements.content.textContent = response.error;
                    return;
                }
                chrome.storage.local.get(["currentProblem", "platform"], ({ currentProblem, platform }) => {
                    analysisElements.content.textContent = 'Analyzing...';
                    streamCodeAnalysis(currentProblem, platform, response.code);
                });
            });
        });
    }

    // --- Streaming and Logic Functions ---

    function showNextHint() {
        currentHintIndex++;
        if (currentHintIndex < hintList.length) {
            hintsElements.content.innerHTML = hintList[currentHintIndex];
        }
        if (currentHintIndex >= hintList.length - 1) {
            hintsElements.next.style.display = 'none'; // Hide on last hint
        }
    }

    async function streamHints(problem, platform) {
        hintList = [];
        currentHintIndex = 0;
        let fullResponse = "";
        const response = await fetch("http://localhost:3000/generate-hint-stream", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem, platform }),
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for await (const chunk of readStream(reader, decoder)) {
            if (chunk.hint) { fullResponse += chunk.hint; }
        }
        // Assuming hints are separated by newlines
        hintList = fullResponse.split('\n').map(h => h.replace(/^(Hint \d:|\*|\•)\s*/, '').trim()).filter(h => h);
        if (hintList.length > 0) {
            hintsElements.content.innerHTML = hintList[0];
            hintsElements.next.style.display = hintList.length > 1 ? 'block' : 'none';
        } else {
            hintsElements.content.innerHTML = 'Could not generate hints.';
        }
    }

    async function streamSimilarProblems(problem, platform) {
        similarElements.container.innerHTML = ''; // Clear previous results
        const response = await fetch("http://localhost:3000/similar-problems-stream", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem, platform }),
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for await (const chunk of readStream(reader, decoder)) {
            if (chunk.type === 'problem_complete') {
                const problemCard = document.createElement('a');
                problemCard.href = convertToLeetCodeUrl(chunk.problem);
                problemCard.textContent = chunk.problem;
                problemCard.target = "_blank";
                problemCard.style.cssText = "display: block; padding: 8px; border-radius: 4px; margin-bottom: 5px; text-decoration: none; color: #333; background-color: #fff;";
                problemCard.onmouseover = () => { problemCard.style.backgroundColor = '#e2e8f0'; };
                problemCard.onmouseout = () => { problemCard.style.backgroundColor = '#fff'; };
                similarElements.container.appendChild(problemCard);
            }
        }
    }

    async function streamCodeAnalysis(problem, platform, code) {
        analysisElements.content.innerHTML = `
            <div style="margin-bottom: 5px;"><strong>Time:</strong> <span id="time-complexity">...</span></div>
            <div style="margin-bottom: 10px;"><strong>Space:</strong> <span id="space-complexity">...</span></div><hr style="border: none; border-top: 1px solid #eee; margin: 10px 0;">
            <div><strong>Explanation:</strong></div>
            <div id="explanation-text"></div>`;
        const timeEl = document.getElementById('time-complexity');
        const spaceEl = document.getElementById('space-complexity');
        const explanationEl = document.getElementById('explanation-text');
        try {
            const response = await fetch("http://localhost:3000/analyze-code-stream", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ problem, platform, code }),
            });
            if (!response.ok) throw new Error(`Server responded: ${response.status}`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            for await (const chunk of readStream(reader, decoder)) {
                if (chunk.type === 'analysis_complete') {
                    timeEl.textContent = chunk.time;
                    spaceEl.textContent = chunk.space;
                    explanationEl.textContent = chunk.explanation;
                }
            }
        } catch (error) {
            analysisElements.content.textContent = `Analysis failed: ${error.message}. Is your server running?`;
        }
    }

    async function* readStream(reader, decoder) {
        let buffer = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.startsWith('data: ')) yield JSON.parse(line.substring(6));
            }
        }
    }
});