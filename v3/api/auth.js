const crypto = require('crypto');
const { getAuthClient } = require('../lib/auth');
const { getSupabaseClient } = require('../lib/supabase');
const { sendEmail } = require('../../lib/api/email');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

// ── Distributed-ish rate limiter for OTP endpoints ─────────────────────────
// We keep separate buckets per IP and per email so one abuser cannot starve
// legitimate users on the same network, and one email cannot be hammered.
const OTP_BUCKETS = new Map();
const OTP_LIMITS = {
  ip: { limit: 10, windowMs: 5 * 60_000 },    // 10 attempts / 5 min per IP
  email: { limit: 5, windowMs: 5 * 60_000 },   // 5 attempts / 5 min per email
};

function cleanupOtpBuckets() {
  const now = Date.now();
  for (const [key, meta] of OTP_BUCKETS) {
    if (now > meta.resetAt) OTP_BUCKETS.delete(key);
  }
}

function getOtpBucketKey(prefix, value, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  return `${prefix}:${value}:${bucket}`;
}

function checkOtpRateLimit(prefix, cfg, value) {
  if (OTP_BUCKETS.size > 50_000) cleanupOtpBuckets();

  const key = getOtpBucketKey(prefix, value, cfg.windowMs);
  const resetAt = (Math.floor(Date.now() / cfg.windowMs) + 1) * cfg.windowMs;

  let meta = OTP_BUCKETS.get(key);
  if (!meta) {
    meta = { count: 0, resetAt };
    OTP_BUCKETS.set(key, meta);
  }

  meta.count += 1;

  if (meta.count > cfg.limit) {
    const seconds = Math.ceil((resetAt - Date.now()) / 1000);
    return { limited: true, retryAfter: seconds };
  }
  return { limited: false };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtp(length = 6) {
  const digits = '0123456789';
  const bytes = crypto.randomBytes(length);
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

function generateTempPassword(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// ── OTP proxy endpoints ────────────────────────────────────────────────────
// These endpoints use the Supabase Service Role key server-side so the
// browser never hits Supabase Auth directly. This gives us full control over
// rate limiting and prevents Supabase's client-side rate limits from blocking
// international users who experience slower email delivery.

async function handleSendOtp(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const body = await parseBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const shouldCreateUser = body.shouldCreateUser === true;
  const metadata = body.metadata || {};
  const language = body.language || 'ar';

  if (!isValidEmail(email)) {
    return sendJson(res, 400, { error: 'Valid email is required' });
  }

  const ip = getClientIp(req);
  const ipLimit = checkOtpRateLimit('ip', OTP_LIMITS.ip, ip);
  if (ipLimit.limited) {
    res.setHeader('Retry-After', String(ipLimit.retryAfter));
    return sendJson(res, 429, {
      error: 'Too many attempts from this network. Please try again later.',
      retryAfter: ipLimit.retryAfter
    });
  }

  const emailLimit = checkOtpRateLimit('email', OTP_LIMITS.email, email);
  if (emailLimit.limited) {
    res.setHeader('Retry-After', String(emailLimit.retryAfter));
    return sendJson(res, 429, {
      error: 'Too many attempts for this email. Please wait before requesting a new code.',
      retryAfter: emailLimit.retryAfter
    });
  }

  try {
    // Admin actions (create user / update user) require the service role key.
    const adminClient = getSupabaseClient();

    // For new users we create the auth user immediately with service role.
    if (shouldCreateUser) {
      const { error: signUpError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { ...metadata, language }
      });

      if (signUpError) {
        // If user already exists, fall through to OTP send instead of failing.
        if (!/already|exists/i.test(signUpError.message)) {
          console.error('[auth/send-otp] createUser error:', signUpError.message);
          return sendJson(res, 500, { error: signUpError.message });
        }
      }
    }

    // Generate a server-side OTP and store it in the user's metadata. We do
    // NOT use Supabase signInWithOtp here because:
    //   1. It rejects service-role clients with "Signups not allowed for otp".
    //   2. Anon-key calls from Vercel share a single IP and hit Supabase's
    //      email/IP rate limits immediately.
    // Sending the OTP ourselves through Resend/SMTP bypasses both issues.
    const otp = generateOtp(6);
    const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const { data: userData, error: lookupError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (lookupError) {
      console.error('[auth/send-otp] listUsers error:', lookupError.message);
      return sendJson(res, 500, { error: lookupError.message });
    }

    const user = userData?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return sendJson(res, 404, { error: 'User not found' });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        bonds_otp: otp,
        bonds_otp_expires_at: otpExpiresAt
      }
    });

    if (updateError) {
      console.error('[auth/send-otp] updateUserById error:', updateError.message);
      return sendJson(res, 500, { error: updateError.message });
    }

    const subject = language === 'ar'
      ? 'رمز التحقق الخاص بك — بوندز'
      : 'Your verification code — Bonds';
    const bodyText = language === 'ar'
      ? `رمز التحقق الخاص بك هو: ${otp}\nالرمز صالح لمدة 10 دقائق.`
      : `Your verification code is: ${otp}\nThis code is valid for 10 minutes.`;
    const bodyHtml = language === 'ar'
      ? `<div dir="rtl"><p>رمز التحقق الخاص بك هو:</p><h2>${otp}</h2><p>الرمز صالح لمدة 10 دقائق.</p></div>`
      : `<p>Your verification code is:</p><h2>${otp}</h2><p>This code is valid for 10 minutes.</p>`;

    const emailResult = await sendEmail({
      to: email,
      subject,
      text: bodyText,
      html: bodyHtml
    });

    // Diagnostic logging while we verify Resend/SMTP config in production.
    console.error('[auth/send-otp] emailResult:', JSON.stringify(emailResult));

    if (!emailResult.success) {
      console.error('[auth/send-otp] sendEmail error:', emailResult.error);
      return sendJson(res, 500, { error: emailResult.error || 'Failed to send email' });
    }

    return sendJson(res, 200, {
      success: true,
      demo: emailResult.demo || false,
      message: language === 'ar'
        ? 'تم إرسال رمز التحقق إلى بريدك.'
        : 'Verification code sent to your email.'
    });
  } catch (err) {
    console.error('[auth/send-otp] unexpected error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleVerifyOtp(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const body = await parseBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const token = String(body.token || '').trim();
  const pendingPassword = body.pendingPassword;

  if (!isValidEmail(email) || !token) {
    return sendJson(res, 400, { error: 'Email and token are required' });
  }

  try {
    const adminClient = getSupabaseClient();

    const { data: userData, error: lookupError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (lookupError) {
      console.error('[auth/verify-otp] listUsers error:', lookupError.message);
      return sendJson(res, 500, { error: lookupError.message });
    }

    const user = userData?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return sendJson(res, 401, { error: 'Invalid or expired code' });
    }

    const otp = user.user_metadata?.bonds_otp;
    const expiresAt = user.user_metadata?.bonds_otp_expires_at;

    if (!otp || Date.now() > Number(expiresAt || 0)) {
      return sendJson(res, 401, { error: 'Invalid or expired code' });
    }

    if (token !== String(otp)) {
      return sendJson(res, 401, { error: 'Invalid code' });
    }

    // Clear the OTP so it cannot be reused.
    const updatedMetadata = { ...(user.user_metadata || {}) };
    delete updatedMetadata.bonds_otp;
    delete updatedMetadata.bonds_otp_expires_at;

    // Set the user's chosen password during signup.
    const password = (pendingPassword && pendingPassword.length >= 8)
      ? pendingPassword
      : generateTempPassword();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: updatedMetadata
    });

    if (updateError) {
      console.error('[auth/verify-otp] updateUserById error:', updateError.message);
      return sendJson(res, 500, { error: updateError.message });
    }

    // Create a real Supabase session using the (new) password.
    const authClient = getAuthClient();
    const { data, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    if (signInError || !data.session) {
      console.error('[auth/verify-otp] signInWithPassword error:', signInError?.message);
      return sendJson(res, 401, {
        error: signInError?.message || 'Invalid or expired code'
      });
    }

    return sendJson(res, 200, {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (err) {
    console.error('[auth/verify-otp] unexpected error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleRegister(req, res) {
  // Public admin user creation is disabled to prevent account takeover.
  return sendJson(res, 403, { error: 'Public registration is disabled.' });
}

async function handleLogin(req, res) {
  const { email, password } = await parseBody(req);

  if (!email || !password) {
    return sendJson(res, 400, { error: 'Email and password required' });
  }

  const authClient = getAuthClient();

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return sendJson(res, 401, { error: error?.message || 'Invalid credentials' });
  }

  sendJson(res, 200, {
    user: {
      id: data.user.id,
      email: data.user.email
    },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    }
  });
}

async function handleMe(req, res, user) {
  sendJson(res, 200, { user: { id: user.id, email: user.email } });
}

async function authRouter(req, res, path, user) {
  const parts = path.split('/').filter(Boolean);
  const action = parts[1];

  try {
    if (action === 'register' && req.method === 'POST') return await handleRegister(req, res);
    if (action === 'login' && req.method === 'POST') return await handleLogin(req, res);
    if (action === 'send-otp' && req.method === 'POST') return await handleSendOtp(req, res);
    if (action === 'verify-otp' && req.method === 'POST') return await handleVerifyOtp(req, res);
    if (action === 'me' && req.method === 'GET') {
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await handleMe(req, res, user);
    }

    return sendJson(res, 404, { error: 'Auth endpoint not found' });
  } catch (err) {
    console.error('[auth]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

module.exports = { authRouter };
