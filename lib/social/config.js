/**
 * Bonds Social — Centralized configuration (server-side only).
 */

module.exports = {
  // Public profile URLs (also exposed in window.__ENV via api/env.js)
  urls: {
    instagram: process.env.SOCIAL_INSTAGRAM_URL || 'https://instagram.com/bonds.global',
    youtube: process.env.SOCIAL_YOUTUBE_URL || 'https://www.youtube.com/@bondsglobal',
    x: process.env.SOCIAL_X_URL || 'https://x.com/bonds_global',
    linkedin: process.env.SOCIAL_LINKEDIN_URL || 'https://www.linkedin.com/company/bonds-global',
  },

  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    accountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
    appId: process.env.INSTAGRAM_APP_ID || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    channelId: process.env.YOUTUBE_CHANNEL_ID || '',
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    accessToken: process.env.YOUTUBE_ACCESS_TOKEN || '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
  },

  x: {
    bearerToken: process.env.X_BEARER_TOKEN || '',
    username: process.env.X_USERNAME || '',
    userId: process.env.X_USER_ID || '',
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || '',
  },

  feed: {
    enabled: process.env.SOCIAL_FEED_ENABLED === 'true',
    cacheTtlSeconds: parseInt(process.env.SOCIAL_FEED_CACHE_TTL_SECONDS || '900', 10),
  },

  upload: {
    bucket: process.env.SOCIAL_STORAGE_BUCKET || 'social-media',
    maxBytes: parseInt(process.env.SOCIAL_UPLOAD_MAX_BYTES || '16777216', 10), // 16 MB
  },
};
