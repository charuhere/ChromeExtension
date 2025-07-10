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

Don't add any introduction, explanation, or extra content. Just return exactly this list in bullet-point format.`

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

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
