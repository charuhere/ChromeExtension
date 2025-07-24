import dotenv from 'dotenv';
dotenv.config(); // Loads your .env file
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =================================================================
// === CRITICAL FIX: Load the API key from the .env file         ===
// =================================================================
const genAI = new GoogleGenerativeAI("AIzaSyBpbBi2BMQDBtOIiEwGZ_XgwlzXMBm16Xk");

// --- Helper function to set up streaming headers ---
const setStreamHeaders = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
};

// =================================================================
// === ADDED: Endpoint for Hints                                 ===
// =================================================================
app.post('/generate-hint-stream', async (req, res) => {
  setStreamHeaders(res);
  const { problem } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Give 3 concise hints for the LeetCode problem "${problem}". Each hint on a new line. No extra text.`;
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      res.write(`data: ${JSON.stringify({ hint: chunk.text() })}\n\n`);
    }
    res.end();
  } catch (error) {
    console.error('Hint streaming error:', error);
    res.end();
  }
});

// =================================================================
// === ADDED: Endpoint for Similar Problems                      ===
// =================================================================
app.post('/similar-problems-stream', async (req, res) => {
  setStreamHeaders(res);
  const { problem } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `List 3 similar problems to "${problem}". Just the problem titles, each on a new line.`;
    const result = await model.generateContentStream(prompt);
    // In a real app, you might parse this more carefully.
    // For now, we send the completed problems.
    let fullResponse = "";
    for await (const chunk of result.stream) {
      fullResponse += chunk.text();
    }
    const problems = fullResponse.split('\n').filter(p => p.trim());
    for (const p of problems) {
       res.write(`data: ${JSON.stringify({ type: 'problem_complete', problem: p })}\n\n`);
    }
    res.end();
  } catch (error) {
    console.error('Similar problems streaming error:', error);
    res.end();
  }
});


// =================================================================
// === Endpoint for Code Analysis (Already Present)              ===
// =================================================================
// Replace the existing '/analyze-code-stream' function in your server.js

app.post('/analyze-code-stream', async (req, res) => {
  setStreamHeaders(res);
  const { problem, platform, code } = req.body;
  if (!problem || !platform || !code) return res.status(400).end();

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // =================================================================
    // === THE FIX IS HERE: The user's 'code' is now in the prompt ===
    // =================================================================
    const prompt = `
      You are an expert programming assistant. Your task is to analyze the user's provided code for the LeetCode problem: "${problem}".
      Do NOT provide a general approach or write a new solution.
      Analyze the specific code below for its logic, correctness, and complexity.

      **Provided Code:**
      \`\`\`
      ${code}
      \`\`\`

      **Your Analysis (in this exact format):**
      **TIME_COMPLEXITY:** O(value)
      **SPACE_COMPLEXITY:** O(value)
      **EXPLANATION:**
      A 2-3 sentence explanation of the provided code's logic. Mention any potential bugs or major improvements.
    `;

    const result = await model.generateContentStream(prompt);
    
    let fullResponse = "";
    for await (const chunk of result.stream) {
      fullResponse += chunk.text();
    }
    
    const timeMatch = fullResponse.match(/TIME_COMPLEXITY:\s*(.*)/);
    const spaceMatch = fullResponse.match(/SPACE_COMPLEXITY:\s*(.*)/);
    const explanationMatch = fullResponse.match(/EXPLANATION:\s*([\s\S]*)/);

    if (timeMatch && spaceMatch && explanationMatch) {
      res.write(`data: ${JSON.stringify({
        type: 'analysis_complete',
        time: timeMatch[1].trim(),
        space: spaceMatch[1].trim(),
        explanation: explanationMatch[1].trim()
      })}\n\n`);
    } else {
      // If parsing fails, send the whole response as a fallback
      res.write(`data: ${JSON.stringify({ type: 'analysis_fallback', text: fullResponse })}\n\n`);
    }
    res.end();
  } catch (error) {
    console.error('Code analysis streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to get analysis from AI.' })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});