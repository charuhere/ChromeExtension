const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

exports.generateHint = functions
  .region('us-central1') // Gen 1 region
  .https
  .onRequest((req, res) => {
    cors(req, res, () => {
      const { problem, platform } = req.body;

      if (!problem || !platform) {
        return res.status(400).json({ error: 'Missing problem or platform' });
      }

      const dummyHint = `Try thinking about the data structure that fits well for solving "${problem}".`;

      res.json({
        hint: dummyHint,
        problem,
        platform,
        source: 'static'
      });
    });
  });
