export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, prompt } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  // Filter non-English titles
  const isEnglish = (text) => {
    let nonLatin = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code > 0x024F && code < 0xFB00) nonLatin++;
    }
    return (nonLatin / text.length) < 0.15;
  };

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
      finance:"personal finance investing money",
      health:"health tips wellness",
      tech:"artificial intelligence technology",
      motivation:"motivation success mindset",
      relationship:"relationship advice dating",
      business:"business entrepreneurship",
      gaming:"gaming highlights gameplay",
      food:"food recipes cooking",
      travel:"travel vlog destination",
      education:"education learning tutorial",
      fitness:"fitness workout exercise",
      crypto:"cryptocurrency bitcoin",
      history:"dark history facts documentary",
      mystery:"mystery unsolved secrets",
      animals:"animals wildlife nature documentary",
      news:"facts news documentary",
    };
    const kw = (KW[niche] || niche) + " english";
    const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();

    // Step 1: Search videos
    const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
    const sd = await sr.json();
    if (!sr.ok) throw new Error(sd.error?.message);

    const items = sd.items || [];
    const ids = items.map(i=>i.id.videoId).filter(Boolean).join(",");
    if (!ids) return { videos:[], channels:[], kw };

    // Step 2: Get video stats
    const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const vd = await vr.json();

    // Step 3: Filter English only
    const englishVideos = (vd.items||[]).filter(v => isEnglish(v.snippet.title));

    // Step 4: Get unique channel IDs from English videos
    const channelIds = [...new Set(englishVideos.map(v => v.snippet.channelId))].slice(0,8).join(",");

    // Step 5: Get REAL channel stats from YouTube API
    let channelMap = {};
    if (channelIds) {
      const cr = await fetch(`${BASE}/channels?part=statistics,snippet&id=${channelIds}&key=${YT_KEY}`);
      const cd = await cr.json();
      (cd.items||[]).forEach(ch => {
        channelMap[ch.id] = {
          name: ch.snippet.title,
          handle: ch.snippet.customUrl || "",
          subs: parseInt(ch.statistics.subscriberCount||0),
          totalViews: parseInt(ch.statistics.viewCount||0),
          videoCount: parseInt(ch.statistics.videoCount||0),
          thumb: ch.snippet.thumbnails?.default?.url || "",
          url: ch.snippet.customUrl 
            ? `https://youtube.com/${ch.snippet.customUrl}`
            : `https://youtube.com/channel/${ch.id}`,
        };
      });
    }

    // Step 6: Build video list with real channel data
    const videos = englishVideos.map(v=>({
      id: v.id,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      channelId: v.snippet.channelId,
      channelUrl: channelMap[v.snippet.channelId]?.url || `https://youtube.com/channel/${v.snippet.channelId}`,
      views: parseInt(v.statistics.viewCount||0),
      likes: parseInt(v.statistics.likeCount||0),
      comments: parseInt(v.statistics.commentCount||0),
      published: v.snippet.publishedAt?.slice(0,10),
      thumb: v.snippet.thumbnails?.medium?.url,
      url: "https://youtube.com/watch?v="+v.id,
      tags: v.snippet.tags?.slice(0,5)||[],
    })).sort((a,b)=>b.views-a.views).slice(0,10);

    // Step 7: Build real channel list
    const channels = Object.values(channelMap).map(ch => ({
      ...ch,
      topVideo: videos.find(v => v.channelId === Object.keys(channelMap).find(k => channelMap[k] === ch))
    }));

    return { videos, channels, kw };
  };

  try {
    if (action === "ping") {
      return res.status(200).json({ ok:true, message:"YTAutoAgent backend is live!", youtube:!!YT_KEY, groq:!!GROQ_KEY, time:new Date().toISOString() });
    }

    if (action === "ai") {
      if (!GROQ_KEY) return res.status(500).json({ error:"Groq key missing" });
      if (!prompt) return res.status(400).json({ error:"prompt missing" });
      const text = await groqAI(
        "You are a world-class YouTube automation expert. Be highly actionable, detailed, use emojis.",
        decodeURIComponent(prompt)
      );
      return res.status(200).json({ text });
    }

    if (action === "analyze") {
      if (!GROQ_KEY) return res.status(500).json({ error:"Groq key missing" });
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      if (!niche) return res.status(400).json({ error:"niche required" });
      if (!prompt) return res.status(400).json({ error:"prompt missing" });

      const { videos, channels, kw } = await fetchTrending(niche);
      if (!videos.length) return res.status(200).json({ text:"No English trending videos found this week. Try a different niche.", videos:[], channels:[] });

      // Real video data summary
      const videoSummary = videos.slice(0,8).map((v,i) =>
        `#${i+1} "${v.title}" by ${v.channel} (${v.channelUrl}) — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.comments.toLocaleString()} comments | ${v.url}`
      ).join("\n");

      // Real channel data summary
      const channelSummary = channels.slice(0,6).map(ch =>
        `• ${ch.name} | ${ch.url} | ${ch.subs.toLocaleString()} subs | ${ch.totalViews.toLocaleString()} total views | ${ch.videoCount} videos`
      ).join("\n");

      const analysisPrompt = `You are analyzing REAL YouTube data from this week for the "${niche}" niche.

REAL TRENDING VIDEOS (English only, this week):
${videoSummary}

REAL CHANNEL DATA (actual YouTube API stats):
${channelSummary}

All URLs above are real and clickable. Use ONLY this real data to answer:
${decodeURIComponent(prompt)}

Never invent channel names, URLs, or statistics. Only use the data provided above.`;

      const text = await groqAI(
        "You are a world-class YouTube strategist. Use ONLY the real data provided. Never invent URLs, stats, or channel names. Be specific and actionable.",
        analysisPrompt
      );

      return res.status(200).json({ text, videos, channels, kw, dataAnalyzed: videos.length });
    }

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
