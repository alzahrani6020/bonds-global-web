/**
 * Bonds Social — Transform platform API responses into a unified post shape.
 */

const MAX_EXCERPT = 160;

function truncate(text, max = MAX_EXCERPT) {
  const str = String(text ?? '').trim();
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

function stripHtml(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function transformInstagram(item) {
  const caption = item.caption || '';
  const mediaUrl = item.media_url || item.thumbnail_url || '';
  return {
    id: `instagram_${item.id}`,
    platform: 'instagram',
    type: item.media_type === 'VIDEO' ? 'video' : item.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'image',
    title: caption.split(/\n|\./)[0].slice(0, 80) || 'Instagram post',
    excerpt: truncate(caption),
    mediaUrl,
    permalink: item.permalink || `https://instagram.com/p/${item.id}`,
    publishedAt: item.timestamp,
    metrics: {
      likes: typeof item.like_count === 'number' ? item.like_count : null,
      comments: typeof item.comments_count === 'number' ? item.comments_count : null,
    },
  };
}

function transformYouTube(item, channelId) {
  const snippet = item.snippet || {};
  const videoId = item.id?.videoId || item.contentDetails?.videoId || snippet.resourceId?.videoId;
  const description = stripHtml(snippet.description || '');
  const thumbnails = snippet.thumbnails || {};
  const mediaUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';
  return {
    id: `youtube_${videoId || item.id}`,
    platform: 'youtube',
    type: 'video',
    title: snippet.title || 'YouTube video',
    excerpt: truncate(description),
    mediaUrl,
    permalink: videoId ? `https://www.youtube.com/watch?v=${videoId}` : `https://www.youtube.com/channel/${channelId}`,
    publishedAt: snippet.publishedAt,
    metrics: null,
  };
}

function transformX(tweet, username) {
  const text = tweet.text || '';
  const media = tweet.media || [];
  const firstMedia = media[0] || {};
  const mediaUrl = firstMedia.preview_image_url || firstMedia.url || '';
  return {
    id: `x_${tweet.id}`,
    platform: 'x',
    type: 'tweet',
    title: text.split(/\n|\./)[0].slice(0, 80) || 'Post on X',
    excerpt: truncate(text),
    mediaUrl,
    permalink: username ? `https://x.com/${username}/status/${tweet.id}` : `https://x.com/i/web/status/${tweet.id}`,
    publishedAt: tweet.created_at,
    metrics: {
      likes: tweet.public_metrics?.like_count ?? null,
      retweets: tweet.public_metrics?.retweet_count ?? null,
      replies: tweet.public_metrics?.reply_count ?? null,
      views: tweet.public_metrics?.impression_count ?? null,
    },
  };
}

module.exports = { transformInstagram, transformYouTube, transformX, truncate };
