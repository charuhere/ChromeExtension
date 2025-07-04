import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.send('🚀 CodeHint Assistant Backend Running!');
});

// Main API endpoint
app.post('/generate-hint', (req, res) => {
  const { problem, platform } = req.body;

  if (!problem || !platform) {
    return res.status(400).json({ error: 'Missing problem or platform' });
  }

  // 🧠 Return multiple dummy hints instead of one
  const dummyHints = [
    `Think about which data structure would best suit solving "${problem}" on ${platform}.`,
    `Is there a greedy or dynamic programming approach that could help?`,
    `Try breaking down the problem into smaller subproblems.`,
    `What is the time complexity you're aiming for?`
  ];

  // ✅ Send the array of hints
  return res.json({
    hints: dummyHints,
    source: 'static-express',
    problem,
    platform
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});


