const { calculateProject, aiInsight, buildHTMLReport } = require('../pro/pro-engine');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  try {
    const params = req.method === 'GET' ? req.query : req.body || {};
    const { sector, activity, capital, revenue, format = 'json' } = params;

    if (!sector || !activity || !capital || !revenue) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = calculateProject({
      sector,
      activity,
      capital: parseFloat(capital),
      revenue: parseFloat(revenue)
    });
    const insight = aiInsight(result);

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(buildHTMLReport(result, insight));
    }

    res.status(200).json({ result, insight });
  } catch (err) {
    console.error('[pro-report] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
