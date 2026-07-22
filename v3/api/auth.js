const { getAuthClient } = require('../lib/auth');
const { getSupabaseClient } = require('../lib/supabase');

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
    const supabase = getSupabaseClient();

    // For new users we create the auth user immediately with service role so
    // Supabase does not throttle the public endpoint. The OTP email is still
    // sent by Supabase Auth.
    if (shouldCreateUser) {
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { ...metadata, language }
      });

      if (signUpError) {
        // If user already exists, fall through to OTP sign-in instead of failing.
        if (!/already|exists/i.test(signUpError.message)) {
          console.error('[auth/send-otp] createUser error:', signUpError.message);
          return sendJson(res, 500, { error: signUpError.message });
        }
      }
    }

    // Send the OTP / magic link email through Supabase Auth.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // we already created above, or user exists
        data: { ...metadata, language }
      }
    });

    if (error) {
      console.error('[auth/send-otp] signInWithOtp error:', error.message);
      return sendJson(res, 500, { error: error.message });
    }

    return sendJson(res, 200, {
      success: true,
      message: language === 'ar'
        ? 'تم إرسال رابط التحقق إلى بريدك.'
        : 'Verification link sent to your email.'
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
  const type = body.type || 'email';
  const pendingPassword = body.pendingPassword;

  if (!isValidEmail(email) || !token) {
    return sendJson(res, 400, { error: 'Email and token are required' });
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    });

    if (error || !data.session) {
      return sendJson(res, 401, {
        error: error?.message || 'Invalid or expired token'
      });
    }

    // If the user has a pending password from the signup flow, set it now.
    if (pendingPassword && pendingPassword.length >= 8) {
      const adminClient = getSupabaseClient();
      await adminClient.auth.admin.updateUserById(data.user.id, {
        password: pendingPassword
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
