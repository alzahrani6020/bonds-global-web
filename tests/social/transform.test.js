const { transformInstagram, transformYouTube, transformX, truncate } = require('../../lib/social/transform');

describe('social/transform', () => {
  test('transformInstagram produces unified shape', () => {
    const item = {
      id: '123',
      caption: 'Hello world. This is a test caption.',
      media_type: 'IMAGE',
      media_url: 'https://example.com/img.jpg',
      permalink: 'https://instagram.com/p/123',
      timestamp: '2024-01-15T10:00:00+0000',
      like_count: 42,
      comments_count: 5,
    };
    const post = transformInstagram(item);
    expect(post.platform).toBe('instagram');
    expect(post.type).toBe('image');
    expect(post.title).toBe('Hello world');
    expect(post.mediaUrl).toBe('https://example.com/img.jpg');
    expect(post.permalink).toBe('https://instagram.com/p/123');
    expect(post.metrics.likes).toBe(42);
    expect(post.metrics.comments).toBe(5);
  });

  test('transformYouTube produces unified shape', () => {
    const item = {
      id: { videoId: 'abc123' },
      snippet: {
        title: 'Video Title',
        description: 'A <b>description</b> with html and more text than needed.',
        publishedAt: '2024-02-01T12:00:00Z',
        thumbnails: { medium: { url: 'https://i.ytimg.com/mqdefault.jpg' } },
      },
    };
    const post = transformYouTube(item, 'UCchannel');
    expect(post.platform).toBe('youtube');
    expect(post.type).toBe('video');
    expect(post.title).toBe('Video Title');
    expect(post.excerpt).not.toContain('<b>');
    expect(post.permalink).toBe('https://www.youtube.com/watch?v=abc123');
  });

  test('transformX produces unified shape', () => {
    const tweet = {
      id: '987',
      text: 'A tweet about finance.',
      created_at: '2024-03-10T08:30:00.000Z',
      public_metrics: { like_count: 10, retweet_count: 2, reply_count: 1, impression_count: 100 },
      media: [{ media_key: 'm1', preview_image_url: 'https://example.com/card.jpg' }],
    };
    const post = transformX(tweet, 'bonds_global');
    expect(post.platform).toBe('x');
    expect(post.permalink).toBe('https://x.com/bonds_global/status/987');
    expect(post.metrics.views).toBe(100);
  });

  test('truncate shortens long text', () => {
    expect(truncate('a'.repeat(200), 50).length).toBe(50);
    expect(truncate('short', 50)).toBe('short');
  });
});
