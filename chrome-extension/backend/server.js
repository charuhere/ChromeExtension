import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const PROMPTS = {
  hints: (problem) => `You are an expert programming coach helping a user solve the LeetCode problem: "${problem}".

Provide THREE strictly progressive hints in this EXACT format:

**Hint 1:** [Conceptual Hint]
Give a gentle nudge about the problem type or a key observation (e.g., "This is a Sliding Window problem" or "Think about using a Hash Map") without revealing the solution. Focus on *how* to think about it.

**Hint 2:** [Strategy Hint]
Explain the specific approach or algorithm to apply. Explain the logic connecting the concept to the solution (e.g., "Use two pointers starting from both ends to find the maximum area...").

**Hint 3:** [Implementation/Code Hint]
Provide the core formula, main loop logic, or a small helper code snippet. This should practically help them write the code (e.g., "Logic: ans = max(ans, height[i] * width)").

Keep each hint clear, concise, and high-value. Do not waste the user's time with generic advice.`,

  similar: (problem) => `Identify exactly 3 LeetCode problems that use the SAME underlying algorithmic pattern (e.g., Sliding Window, DFS, Two Pointers) as "${problem}". Do NOT match by name similarity.

Sort them by difficulty: 1 Easy, then 1 Medium, then 1 Hard (or slightly harder).

Return ONLY the problem titles, one per line. No difficulty labels, no numbers, no bullets.

Example output format:
Best Time to Buy and Sell Stock
Maximum Subarray
Maximum Product Subarray`,

  analysis: (problem, code) => `Analyze this code for the LeetCode problem "${problem}".

**Code:**
\`\`\`
${code}
\`\`\`

Provide analysis in this EXACT format:

**TIME_COMPLEXITY:** O(?)
**SPACE_COMPLEXITY:** O(?)
**EXPLANATION:**
[2-3 sentences explaining the logic, potential bugs, and improvements]

Be specific about what the code does and any issues.`
};

// HELPER FUNCTIONS 
const setStreamHeaders = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
};

const sendStreamData = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const handleStreamError = (res, error, context) => {
  console.error(`${context} error:`, error.message);
  const message = error.status === 429
    ? 'Rate limit exceeded. Please try again in a moment.'
    : `Failed to process request: ${error.message}`;
  sendStreamData(res, { type: 'error', message });
  res.end();
};

async function streamGroqResponse(model, messages, onChunk) {
  const stream = await groq.chat.completions.create({
    model: model,
    messages: messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2000
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullResponse += content;
      if (onChunk) onChunk(content);
    }
  }
  return fullResponse;
}

app.post('/generate-hint-stream', async (req, res) => {
  setStreamHeaders(res);
  const { problem } = req.body;

  if (!problem) {
    sendStreamData(res, { type: 'error', message: 'Problem name is required' });
    return res.end();
  }

  try {
    const prompt = PROMPTS.hints(problem);

    const fullResponse = await streamGroqResponse(
      'llama-3.3-70b-versatile',
      [{ role: 'user', content: prompt }],
      (content) => sendStreamData(res, { hint: content })
    );

    res.end();
  } catch (error) {
    handleStreamError(res, error, 'Hint generation');
  }
});

app.post('/similar-problems-stream', async (req, res) => {
  setStreamHeaders(res);
  const { problem } = req.body;

  if (!problem) {
    sendStreamData(res, { type: 'error', message: 'Problem name is required' });
    return res.end();
  }

  try {
    const prompt = PROMPTS.similar(problem);

    const fullResponse = await streamGroqResponse(
      'llama-3.3-70b-versatile',
      [{ role: 'user', content: prompt }],
      null
    );

    // Parse and send problems
    const problems = fullResponse
      .split('\n')
      .map(p => p.replace(/^[\d+.\-\*•]\s*/, '').trim())
      .filter(p => p && p.length > 3)
      .slice(0, 3);

    if (problems.length === 0) {
      sendStreamData(res, { type: 'error', message: 'Could not find similar problems' });
    } else {
      problems.forEach(problem => {
        sendStreamData(res, { type: 'problem_complete', problem });
      });
    }

    res.end();
  } catch (error) {
    handleStreamError(res, error, 'Similar problems');
  }
});

app.post('/analyze-code-stream', async (req, res) => {
  setStreamHeaders(res);
  const { problem, code } = req.body;

  if (!problem || !code) {
    sendStreamData(res, { type: 'error', message: 'Problem name and code are required' });
    return res.end();
  }

  try {
    const prompt = PROMPTS.analysis(problem, code);

    const fullResponse = await streamGroqResponse(
      'llama-3.3-70b-versatile',
      [{ role: 'user', content: prompt }],
      null
    );

    // Parse the response
    const timeMatch = fullResponse.match(/TIME_COMPLEXITY:\s*\*?\*?\s*(O\([^)]+\))/i);
    const spaceMatch = fullResponse.match(/SPACE_COMPLEXITY:\s*\*?\*?\s*(O\([^)]+\))/i);
    const explanationMatch = fullResponse.match(/EXPLANATION:\s*\*?\*?\s*([\s\S]*?)(?=\n\n|$)/i);

    if (timeMatch && spaceMatch && explanationMatch) {
      sendStreamData(res, {
        type: 'analysis_complete',
        time: timeMatch[1].trim(),
        space: spaceMatch[1].trim(),
        explanation: explanationMatch[1].trim()
      });
    } else {
      // Fallback: Try to extract any complexity mentions
      const timeAlt = fullResponse.match(/time.*?(O\([^)]+\))/i);
      const spaceAlt = fullResponse.match(/space.*?(O\([^)]+\))/i);

      sendStreamData(res, {
        type: 'analysis_complete',
        time: timeAlt ? timeAlt[1] : 'Unable to determine',
        space: spaceAlt ? spaceAlt[1] : 'Unable to determine',
        explanation: explanationMatch ? explanationMatch[1].trim() : fullResponse
      });
    }

    res.end();
  } catch (error) {
    handleStreamError(res, error, 'Code analysis');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
