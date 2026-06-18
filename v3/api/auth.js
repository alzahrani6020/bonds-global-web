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

async function handleRegister(req, res) {
  const { email, password } = await parseBody(req);

  if (!email || !password || password.length < 6) {
    return sendJson(res, 400, { error: 'Email and password (min 6 chars) required' });
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    return sendJson(res, 400, { error: error.message });
  }

  sendJson(res, 201, {
    user: { id: data.user.id, email: data.user.email }
  });
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
