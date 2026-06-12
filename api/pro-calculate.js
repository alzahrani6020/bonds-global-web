const { calculateProject, aiInsight } = require('../pro/pro-engine');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { sector, activity, capital, revenue } = body;

    if (!sector || !activity || !capital || !revenue) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = calculateProject({ sector, activity, capital: parseFloat(capital), revenue: parseFloat(revenue) });
    const ai = aiInsight(result);

    res.status(200).json({ result, ai });
  } catch (err) {
    console.error('[pro-calculate] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
