export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, prompt } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  const groqAI = async (systemPrompt, userPrompt) => {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1200
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Groq error");
    return d.choices?.[0]?.message?.content || "";
  };

  const fetchTrending = async (niche) => {
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
    if (!sr.ok) throw new Error(sd.error?.message);
    const ids = (sd.items||[]).map(i=>i.id.videoId).filter(Boolean).join(",");
    if (!ids) return { videos:[], kw };
    const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const vd = await vr.json();
    const videos = (vd.items||[]).map(v=>({
      id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle,
      views:parseInt(v.statistics.viewCount||0), likes:parseInt(v.statistics.likeCount||0),
      comments:parseInt(v.statistics.commentCount||0),
      published:v.snippet.publishedAt?.slice(0,10),
      thumb:v.snippet.thumbnails?.medium?.url,
      url:"https://youtube.com/watch?v="+v.id,
      tags: v.snippet.tags?.slice(0,5)||[],
    })).sort((a,b)=>b.views-a.views);
    return { videos, kw };
  };

  try {
    // ── PING ─────────────────────────────────────────────────────────────────
    if (action === "ping") {
      return res.status(200).json({ ok:true, message:"YTAutoAgent backend is live!", youtube:!!YT_KEY, groq:!!GROQ_KEY, time:new Date().toISOString() });
    }

    // ── PURE AI (general tabs) ────────────────────────────────────────────────
    if (action === "ai") {
      if (!GROQ_KEY) return res.status(500).json({ error:"Groq key missing" });
      if (!prompt) return res.status(400).json({ error:"prompt missing" });
      const text = await groqAI(
        "You are a world-class YouTube automation expert. Be highly actionable, detailed, use emojis.",
        decodeURIComponent(prompt)
      );
      return res.status(200).json({ text });
    }

    // ── REAL DATA + AI ANALYSIS ───────────────────────────────────────────────
    if (action === "analyze") {
      if (!GROQ_KEY) return res.status(500).json({ error:"Groq key missing" });
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      if (!niche) return res.status(400).json({ error:"niche required" });
      if (!prompt) return res.status(400).json({ error:"prompt missing" });

      // Step 1: Get real YouTube data
      const { videos, kw } = await fetchTrending(niche);
      if (!videos.length) return res.status(200).json({ text:"No trending videos found for this niche this week.", videos:[] });

      // Step 2: Build data summary for AI
      const dataSummary = videos.slice(0,8).map((v,i) =>
        `#${i+1} "${v.title}" by ${v.channel} — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.comments.toLocaleString()} comments (${v.published})`
      ).join("\n");

      // Step 3: AI analyzes real data
      const analysisPrompt = `You are analyzing REAL YouTube trending data from this week for the "${niche}" niche.

REAL TRENDING VIDEOS THIS WEEK:
${dataSummary}

Based on this REAL data, ${decodeURIComponent(prompt)}

Be specific — reference actual titles, view counts, and patterns from the data above. Give actionable insights.`;

      const text = await groqAI(
        "You are a world-class YouTube strategist analyzing real trending data. Be highly specific, data-driven, and actionable. Use emojis.",
        analysisPrompt
      );

      return res.status(200).json({ text, videos, kw, dataAnalyzed: videos.length });
    }

    // ── TRENDING (raw data only) ──────────────────────────────────────────────
    if (action === "trending") {
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      if (!niche) return res.status(400).json({ error:"niche required" });
      const result = await fetchTrending(niche);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error:"Unknown action" });
  } catch(err) {
    return res.status(500).json({ error:err.message });
  }
}
