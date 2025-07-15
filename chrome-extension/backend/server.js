import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Gemini client
const genAI = new GoogleGenerativeAI("AIzaSyBpbBi2BMQDBtOIiEwGZ_XgwlzXMBm16Xk");

app.get('/', (req, res) => {
  res.send('🚀 CodeHint Assistant Backend with Gemini is running!');
});

// Original non-streaming endpoints (keep for backwards compatibility)
app.post('/generate-hint', async (req, res) => {
  const { problem, platform } = req.body;

  if (!problem || !platform) {
    return res.status(400).json({ error: 'Missing problem or platform' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Give exactly 3 concise and focused coding hints for solving the problem "${problem}" on ${platform}. Each hint should be short, direct, and spark problem-solving ideas. Do not include any introduction or explanation. Return only the 3 hints as separate bullet points.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const hints = text.split("\n").filter(line => line.trim() !== "");

    return res.json({
      hints,
      source: 'gemini',
      problem,
      platform
    });
  } catch (err) {
    console.error('Gemini API error:', err);
    return res.status(500).json({ error: 'Failed to generate hint' });
  }
});

app.post('/similar-problems', async (req, res) => {
  const { problem, platform } = req.body;

  if (!problem || !platform) {
    return res.status(400).json({ error: 'Missing problem or platform' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Suggest 3 coding problems that are conceptually or algorithmically similar to "${problem}" on ${platform}. Include one easier, one medium, and one harder problem to help learners improve progressively. Return only the list in the following Markdown format:

• Problem Title 1
• Problem Title 2
• Problem Title 3

Don't add any introduction, explanation, or extra content. Just return exactly this list in bullet-point format.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Process output into a clean array of problem titles
    const similarProblems = text
      .split("\n")
      .map(line => line.replace(/^[-*\d.]+\s*/, "").trim()) // remove bullet formatting
      .filter(line => line.length > 0);

    return res.json({ similarProblems });
  } catch (err) {
    console.error("Gemini API error in similar-problems:", err);
    return res.status(500).json({ error: 'Failed to generate similar problems' });
  }
});

// NEW STREAMING ENDPOINTS

// Streaming endpoint for hints
app.post('/generate-hint-stream', async (req, res) => {
  const { problem, platform } = req.body;
  
  if (!problem || !platform) {
    return res.status(400).json({ error: 'Missing problem or platform' });
  }
  
  // Set up Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Give exactly 3 concise and focused coding hints for solving the problem "${problem}" on ${platform}. Each hint should be short, direct, and spark problem-solving ideas. Format each hint clearly with "Hint 1:", "Hint 2:", "Hint 3:" prefixes. Do not include any introduction or explanation.`;

    // Generate content with streaming
    const result = await model.generateContentStream(prompt);
    
    let fullResponse = '';
    let lastSentLength = 0;
    
    // Collect full response first, then stream it intelligently
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // Send the new chunk as it arrives
      res.write(`data: ${JSON.stringify({ type: 'raw_token', token: chunkText })}\n\n`);
      
      // Try to detect and send complete hints as they form
      const hints = extractHints(fullResponse);
      
      // Send any newly completed hints
      for (let i = 0; i < hints.length; i++) {
        const hintNum = i + 1;
        const hintContent = hints[i];
        
        // Only send if this is a new or updated hint
        if (hintContent && hintContent.length > 0) {
          res.write(`data: ${JSON.stringify({ 
            type: 'hint_update', 
            number: hintNum, 
            hint: hintContent,
            isComplete: isHintComplete(fullResponse, hintNum)
          })}\n\n`);
        }
      }
    }
    
    // Final processing - send all hints clearly separated
    const finalHints = extractHints(fullResponse);
    
    for (let i = 0; i < finalHints.length; i++) {
      const hintNum = i + 1;
      const hintContent = finalHints[i];
      
      if (hintContent && hintContent.trim().length > 0) {
        res.write(`data: ${JSON.stringify({ 
          type: 'hint_final', 
          number: hintNum, 
          hint: hintContent.trim()
        })}\n\n`);
      }
    }
    
    res.write('data: {"type": "done"}\n\n');
    res.end();
    
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// Helper function to extract hints from the full response
function extractHints(text) {
  const hints = [];
  
  // Split by hint markers
  const hintPattern = /Hint\s+(\d+):\s*(.*?)(?=Hint\s+\d+:|$)/gs;
  let match;
  
  while ((match = hintPattern.exec(text)) !== null) {
    const hintNumber = parseInt(match[1]);
    const hintContent = match[2].trim();
    
    // Store in correct position (hint 1 at index 0, etc.)
    hints[hintNumber - 1] = hintContent;
  }
  
  return hints;
}

// Helper function to check if a hint is complete
function isHintComplete(text, hintNumber) {
  const nextHintPattern = new RegExp(`Hint\\s+${hintNumber + 1}:`);
  const hasNextHint = nextHintPattern.test(text);
  
  // If there's a next hint, current hint is complete
  // If this is hint 3, check if text seems complete
  return hasNextHint || (hintNumber === 3 && text.length > 100);
}

// Streaming endpoint for similar problems
app.post('/similar-problems-stream', async (req, res) => {
  const { problem, platform } = req.body;
  
  if (!problem || !platform) {
    return res.status(400).json({ error: 'Missing problem or platform' });
  }
  
  // Set up Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Suggest 3 coding problems that are conceptually or algorithmically similar to "${problem}" on ${platform}. Include one easier, one medium, and one harder problem to help learners improve progressively. Format each problem clearly with "Problem 1:", "Problem 2:", "Problem 3:" prefixes. Don't add any introduction, explanation, or extra content.`;

    // Generate content with streaming
    const result = await model.generateContentStream(prompt);
    
    let problemNumber = 0;
    let currentProblem = '';
    let buffer = '';
    
    // Process streaming response from Gemini
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      buffer += chunkText;
      
      // Check for problem boundaries
      const problemMatch = buffer.match(/Problem\s+(\d+):/);
      if (problemMatch) {
        // If we have a previous problem, complete it
        if (currentProblem.trim() && problemNumber > 0) {
          res.write(`data: ${JSON.stringify({ type: 'problem_complete', problem: currentProblem.trim(), number: problemNumber })}\n\n`);
        }
        
        // Start new problem
        problemNumber = parseInt(problemMatch[1]);
        currentProblem = '';
        res.write(`data: ${JSON.stringify({ type: 'problem_start', number: problemNumber })}\n\n`);
        
        // Remove the "Problem X:" part from buffer
        buffer = buffer.replace(/Problem\s+\d+:\s*/, '');
      }
      
      // Send token if we're in a problem
      if (problemNumber > 0 && chunkText) {
        currentProblem += chunkText;
        res.write(`data: ${JSON.stringify({ type: 'problem_token', token: chunkText, number: problemNumber })}\n\n`);
      }
    }
    
    // Send final problem completion
    if (currentProblem.trim() && problemNumber > 0) {
      res.write(`data: ${JSON.stringify({ type: 'problem_complete', problem: currentProblem.trim(), number: problemNumber })}\n\n`);
    }
    
    res.write('data: {"type": "done"}\n\n');
    res.end();
    
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});

