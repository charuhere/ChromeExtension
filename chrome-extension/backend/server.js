import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('🚀 CodeHint Assistant Backend Running!');
});

app.post('/generate-hint', (req, res) => {
  const { problem, platform } = req.body;

  if (!problem || !platform) {
    return res.status(400).json({ error: 'Missing problem or platform' });
  }

  const dummyHint = `Think about which data structure would best suit solving "${problem}" on ${platform}.`;

  return res.json({
    hint: dummyHint,
    source: 'static-express',
    problem,
    platform
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
