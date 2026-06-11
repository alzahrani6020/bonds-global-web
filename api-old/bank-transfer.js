/**
 * Bank Transfer Request API
 * Stores bank transfer subscription requests in Supabase
 * Sends email notification to admin
 */

const getSupabase = require('./lib/supabase');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'iiffund.dev@gmail.com';

async function sendAdminNotification(request) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
        <h2 style="color: #b8954e;">🏦 طلب تحويل بنكي جديد</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">الاسم</td><td style="padding: 10px; border: 1px solid #ddd;">${request.name}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">البريد</td><td style="padding: 10px; border: 1px solid #ddd;">${request.email}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">الجوال</td><td style="padding: 10px; border: 1px solid #ddd;">${request.phone || '-'}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">الباقة</td><td style="padding: 10px; border: 1px solid #ddd;">${request.tier}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">المبلغ</td><td style="padding: 10px; border: 1px solid #ddd;">${request.amount_sar} ر.س</td></tr>
        </table>
        <a href="https://bonds-global.com/admin/bank-transfers.html" style="display: inline-block; background: #b8954e; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">الذهاب إلى لوحة التحكم</a>
      </div>
    `;

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com'}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: ADMIN_EMAIL,
        subject: `🏦 طلب تحويل بنكي جديد — ${request.name}`,
        html,
      }),
    });
  } catch (err) {
    console.error('Notification email failed:', err.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, tier } = req.body || {};
  if (!name || !email || !tier) {
    return res.status(400).json({ error: 'Name, email and tier are required' });
  }
  if (!['pro', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'Tier must be pro or enterprise' });
  }

  const amountSar = tier === 'enterprise' ? 212 : 82;

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('bank_transfer_requests')
      .insert([{ name, email, phone, tier, amount_sar: amountSar }])
      .select()
      .single();

    if (error) throw error;

    // Send admin notification (non-blocking)
    sendAdminNotification({ name, email, phone, tier, amount_sar: amountSar });

    res.status(200).json({
      success: true,
      requestId: data.id,
      message: 'تم استلام طلبك. سنفعل اشتراكك خلال 24 ساعة بعد التحقق من التحويل.',
    });
  } catch (err) {
    console.error('Bank transfer error:', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
};
