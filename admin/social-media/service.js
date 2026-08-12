/**
 * Social Media Admin Service
 */
(function (root) {
  'use strict';

  const TIMEOUT_MS = 15000;

  async function getToken() {
    return BondsAdminCommon.getAdminToken();
  }

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), TIMEOUT_MS))
    ]);
  }

  async function apiFetch(path, options = {}) {
    const token = await getToken();
    if (!token) throw new Error('No admin token available');
    const res = await withTimeout(fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...(options.headers || {})
      }
    }), 'api:' + path);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `API ${path} failed`);
    return json;
  }

  async function getAccounts() {
    return apiFetch('/api/social-accounts');
  }

  async function testPlatform(platform) {
    return apiFetch('/api/social-accounts', {
      method: 'POST',
      body: JSON.stringify({ action: 'test', platform })
    });
  }

  async function getFeed(limit = 6) {
    const res = await fetch('/api/social-feed?limit=' + limit + '&platforms=all', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error('Feed request failed');
    return res.json();
  }

  async function publish(platforms, payload) {
    return apiFetch('/api/social-publish', {
      method: 'POST',
      body: JSON.stringify({ platforms, ...payload })
    });
  }

  async function uploadMedia(file) {
    const token = await getToken();
    if (!token) throw new Error('No admin token available');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          const res = await fetch('/api/social-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              base64,
            }),
            signal: AbortSignal.timeout(60000),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || 'Upload failed');
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function getScheduledPosts() {
    return apiFetch('/api/social-schedule');
  }

  async function schedulePost(payload) {
    return apiFetch('/api/social-schedule', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function cancelScheduledPost(id) {
    return apiFetch('/api/social-schedule?id=' + encodeURIComponent(id), {
      method: 'DELETE'
    });
  }

  root.SocialMediaService = {
    getAccounts, testPlatform, getFeed, publish,
    uploadMedia, getScheduledPosts, schedulePost, cancelScheduledPost
  };
})(window);
