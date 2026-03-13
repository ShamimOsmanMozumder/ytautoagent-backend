export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, prompt } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  try {
    if (action === "ping") {
      return res.status(200).json({ ok: true, message: "YTAutoAgent backend is live!", youtube: !!YT_KEY, groq: !!GROQ_KEY, time: new Date().toISOString() });
    }

    if (action === "ai") {
      if (!GROQ_KEY) return res.status(500).json({ error: "Groq key missing" });
      if (!prompt) return res.status(400).json({ error: "prompt missing" });

      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a world-class YouTube automation expert. Be highly actionable, detailed, use emojis." },
            { role: "user", content: decodeURIComponent(prompt) }
          ],
          max_tokens: 1500
        })
      });
      const d = await r.json();
      if (!r.ok) return res.status(400).json({ error: d.error?.message || "Groq error" });
      const text = d.choices?.[0]?.message?.content || "";
      return res.status(200).json({ text });
    }

    if (!YT_KEY) return res.status(500).json({ error: "YouTube key missing" });

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
