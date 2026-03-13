// YTAutoAgent Backend — YouTube API Proxy
// Deployed on Vercel — handles CORS so browser can call YouTube API

export default async function handler(req, res) {
  // Allow requests from anywhere (Claude.ai artifact)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { action, niche, videoIds, channelId } = req.query;
  const API_KEY = process.env.YOUTUBE_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: "YouTube API key not configured on server." });

  const BASE = "https://www.googleapis.com/youtube/v3";

  try {
    // ── ACTION: trending videos by niche ──────────────────────────────────────
    if (action === "trending") {
      if (!niche) return res.status(400).json({ error: "niche param required" });

      const KEYWORDS = {
        finance: "personal finance investing money",
        health: "health tips wellness medical",
        tech: "artificial intelligence technology",
        motivation: "motivation success mindset",
        relationship: "relationship advice dating",
        business: "business entrepreneurship startup",
        gaming: "gaming highlights gameplay",
        food: "food recipes cooking",
        travel: "travel vlog destination",
        education: "education learning tutorial",
        fitness: "fitness workout exercise",
        crypto: "cryptocurrency bitcoin",
        history: "history facts historical documentary",
        mystery: "mystery unsolved dark secrets",
        animals: "animals wildlife nature",
        news: "facts news documentary",
      };

      const kw = KEYWORDS[niche] || niche;
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Step 1: Search
      const searchUrl = `${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=10&relevanceLanguage=en&key=${API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchRes.ok) {
        return res.status(400).json({ error: searchData.error?.message || "YouTube search failed" });
      }

      const ids = (searchData.items || []).map(i => i.id.videoId).filter(Boolean).join(",");
      if (!ids) return res.status(200).json({ videos: [], kw });

      // Step 2: Get stats
      const statsUrl = `${BASE}/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${API_KEY}`;
      const statsRes = await fetch(statsUrl);
      const statsData = await statsRes.json();

      const videos = (statsData.items || []).map(v => ({
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        views: parseInt(v.statistics.viewCount || 0),
        likes: parseInt(v.statistics.likeCount || 0),
        comments: parseInt(v.statistics.commentCount || 0),
        published: v.snippet.publishedAt?.slice(0, 10),
        thumb: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
        url: "https://youtube.com/watch?v=" + v.id,
        duration: v.contentDetails?.duration || "",
        description: v.snippet.description?.slice(0, 200) || "",
        tags: (v.snippet.tags || []).slice(0, 8),
      })).sort((a, b) => b.views - a.views);

      return res.status(200).json({ videos, kw, fetchedAt: new Date().toISOString() });
    }

    // ── ACTION: channel stats ─────────────────────────────────────────────────
    if (action === "channel") {
      if (!channelId) return res.status(400).json({ error: "channelId param required" });
      const url = `${BASE}/channels?part=statistics,snippet,brandingSettings&id=${channelId}&key=${API_KEY}`;
      const r = await fetch(url);
      const d = await r.json();
      const ch = d.items?.[0];
      if (!ch) return res.status(404).json({ error: "Channel not found" });
      return res.status(200).json({
        id: ch.id,
        name: ch.snippet.title,
        description: ch.snippet.description?.slice(0, 300),
        subs: parseInt(ch.statistics.subscriberCount || 0),
        totalViews: parseInt(ch.statistics.viewCount || 0),
        videoCount: parseInt(ch.statistics.videoCount || 0),
        country: ch.snippet.country || "Unknown",
        thumb: ch.snippet.thumbnails?.medium?.url,
        banner: ch.brandingSettings?.image?.bannerExternalUrl,
      });
    }

    // ── ACTION: video stats by IDs ────────────────────────────────────────────
    if (action === "videostats") {
      if (!videoIds) return res.status(400).json({ error: "videoIds param required" });
      const url = `${BASE}/videos?part=statistics,snippet&id=${videoIds}&key=${API_KEY}`;
      const r = await fetch(url);
      const d = await r.json();
      return res.status(200).json({ items: d.items || [] });
    }

    // ── ACTION: health check ──────────────────────────────────────────────────
    if (action === "ping") {
      return res.status(200).json({ ok: true, message: "YTAutoAgent backend is live!", time: new Date().toISOString() });
    }

    return res.status(400).json({ error: "Unknown action. Use: trending, channel, videostats, ping" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
