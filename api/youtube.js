// YTAutoAgent Backend — YouTube API + Gemini AI Proxy
// Deployed on Vercel — handles CORS for both YouTube and Gemini

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, channelId } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  try {

    // ACTION: Gemini AI analysis
    if (action === "ai") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
      if (!GEMINI_KEY) return res.status(500).json({ error: "Gemini API key not configured on server" });
      const body = req.body || {};
      const prompt = body.prompt;
      if (!prompt) return res.status(400).json({ error: "prompt required" });
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1500, temperature: 0.8 }
          })
        }
      );
      if (!geminiRes.ok) {
        const err = await geminiRes.json();
        return res.status(400).json({ error: err.error?.message || "Gemini error "+geminiRes.status });
      }
      const geminiData = await geminiRes.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({ text });
    }

    // ACTION: ping
    if (action === "ping") {
      return res.status(200).json({
        ok: true,
        message: "YTAutoAgent backend is live!",
        youtube: !!YT_KEY,
        gemini: !!GEMINI_KEY,
        time: new Date().toISOString()
      });
    }

    if (!YT_KEY) return res.status(500).json({ error: "YouTube API key not configured" });

    // ACTION: trending videos
    if (action === "trending") {
      if (!niche) return res.status(400).json({ error: "niche param required" });
      const KEYWORDS = {
        finance:"personal finance investing money",health:"health tips wellness medical",
        tech:"artificial intelligence technology",motivation:"motivation success mindset",
        relationship:"relationship advice dating",business:"business entrepreneurship startup",
        gaming:"gaming highlights gameplay",food:"food recipes cooking",
        travel:"travel vlog destination",education:"education learning tutorial",
        fitness:"fitness workout exercise",crypto:"cryptocurrency bitcoin",
        history:"history facts historical documentary",mystery:"mystery unsolved dark secrets",
        animals:"animals wildlife nature",news:"facts news documentary",
      };
      const kw = KEYWORDS[niche] || niche;
      const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const searchUrl = `${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=10&relevanceLanguage=en&key=${YT_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      if (!searchRes.ok) return res.status(400).json({ error: searchData.error?.message || "YouTube search failed" });
      const ids = (searchData.items||[]).map(i=>i.id.videoId).filter(Boolean).join(",");
      if (!ids) return res.status(200).json({ videos:[], kw });
      const statsUrl = `${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`;
      const statsRes = await fetch(statsUrl);
      const statsData = await statsRes.json();
      const videos = (statsData.items||[]).map(v=>({
        id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle,
        views:parseInt(v.statistics.viewCount||0), likes:parseInt(v.statistics.likeCount||0),
        comments:parseInt(v.statistics.commentCount||0),
        published:v.snippet.publishedAt?.slice(0,10),
        thumb:v.snippet.thumbnails?.medium?.url||v.snippet.thumbnails?.default?.url,
        url:"https://youtube.com/watch?v="+v.id,
      })).sort((a,b)=>b.views-a.views);
      return res.status(200).json({ videos, kw, fetchedAt:new Date().toISOString() });
    }

    return res.status(400).json({ error: "Unknown action: ping, trending, ai" });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
