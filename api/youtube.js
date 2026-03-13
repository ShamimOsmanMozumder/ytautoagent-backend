export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, prompt } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  try {
    // ── PING ──────────────────────────────────────────────────────────────────
    if (action === "ping") {
      return res.status(200).json({ ok: true, message: "YTAutoAgent backend is live!", youtube: !!YT_KEY, gemini: !!GEMINI_KEY, time: new Date().toISOString() });
    }

    // ── GEMINI AI (GET with prompt in query) ──────────────────────────────────
    if (action === "ai") {
      if (!GEMINI_KEY) return res.status(500).json({ error: "Gemini key missing" });
      if (!prompt) return res.status(400).json({ error: "prompt param missing" });

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: decodeURIComponent(prompt) }] }],
            generationConfig: { maxOutputTokens: 1500, temperature: 0.8 }
          })
        }
      );
      const d = await r.json();
      if (!r.ok) return res.status(400).json({ error: d.error?.message || "Gemini error" });
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({ text });
    }

    if (!YT_KEY) return res.status(500).json({ error: "YouTube key missing" });

    // ── TRENDING ──────────────────────────────────────────────────────────────
    if (action === "trending") {
      if (!niche) return res.status(400).json({ error: "niche required" });
      const KW = {
        finance:"personal finance investing money",health:"health tips wellness",
        tech:"artificial intelligence technology",motivation:"motivation success mindset",
        relationship:"relationship advice dating",business:"business entrepreneurship",
        gaming:"gaming highlights gameplay",food:"food recipes cooking",
        travel:"travel vlog destination",education:"education learning tutorial",
        fitness:"fitness workout exercise",crypto:"cryptocurrency bitcoin",
        history:"history facts historical documentary",mystery:"mystery unsolved dark secrets",
        animals:"animals wildlife nature",news:"facts news documentary",
      };
      const kw = KW[niche] || niche;
      const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=10&relevanceLanguage=en&key=${YT_KEY}`);
      const sd = await sr.json();
      if (!sr.ok) return res.status(400).json({ error: sd.error?.message });
      const ids = (sd.items||[]).map(i=>i.id.videoId).filter(Boolean).join(",");
      if (!ids) return res.status(200).json({ videos:[], kw });
      const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
      const vd = await vr.json();
      const videos = (vd.items||[]).map(v=>({
        id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle,
        views:parseInt(v.statistics.viewCount||0), likes:parseInt(v.statistics.likeCount||0),
        comments:parseInt(v.statistics.commentCount||0),
        published:v.snippet.publishedAt?.slice(0,10),
        thumb:v.snippet.thumbnails?.medium?.url,
        url:"https://youtube.com/watch?v="+v.id,
      })).sort((a,b)=>b.views-a.views);
      return res.status(200).json({ videos, kw });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
