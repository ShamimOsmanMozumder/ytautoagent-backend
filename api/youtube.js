export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, prompt } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  const isEnglish = (text) => {
    let nonLatin = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code > 0x024F && code < 0xFB00) nonLatin++;
    }
    return (nonLatin / text.length) < 0.15;
  };

  const groqAI = async (system, user) => {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role:"system", content:system }, { role:"user", content:user }],
        max_tokens: 1200
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Groq error");
    return d.choices?.[0]?.message?.content || "";
  };

  // Get real channel data by channel IDs
  const getChannelData = async (channelIds) => {
    if (!channelIds.length) return [];
    const cr = await fetch(`${BASE}/channels?part=statistics,snippet&id=${channelIds.join(",")}&key=${YT_KEY}`);
    const cd = await cr.json();
    return (cd.items||[]).map(ch => ({
      id: ch.id,
      name: ch.snippet.title,
      url: ch.snippet.customUrl ? `https://youtube.com/${ch.snippet.customUrl}` : `https://youtube.com/channel/${ch.id}`,
      subs: parseInt(ch.statistics.subscriberCount||0),
      totalViews: parseInt(ch.statistics.viewCount||0),
      videoCount: parseInt(ch.statistics.videoCount||0),
      description: ch.snippet.description?.slice(0,100)||"",
      thumb: ch.snippet.thumbnails?.default?.url||"",
    }));
  };

  // Fetch TOP ESTABLISHED channels (search by channel, sorted by subscriber count)
  const fetchTopChannels = async (niche) => {
    const KW = {
      finance:"personal finance investing",health:"health wellness tips",
      tech:"artificial intelligence tech",motivation:"motivation success",
      relationship:"relationship advice",business:"business entrepreneurship",
      gaming:"gaming channel",food:"food recipes",travel:"travel vlog",
      education:"education learning",fitness:"fitness workout",
      crypto:"cryptocurrency bitcoin",history:"history documentary facts",
      mystery:"mystery unsolved dark",animals:"wildlife nature documentary",
      news:"news documentary facts",
    };
    const kw = (KW[niche]||niche) + " channel english";

    // Search for channels directly
    const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=channel&maxResults=15&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
    const sd = await sr.json();
    if (!sr.ok) throw new Error(sd.error?.message);

    const channelIds = (sd.items||[])
      .filter(i => isEnglish(i.snippet.title))
      .map(i => i.id.channelId)
      .filter(Boolean);

    const channels = await getChannelData(channelIds);

    // Sort by subscribers — top established channels first
    return channels
      .filter(ch => ch.subs > 10000) // minimum 10K subs
      .sort((a,b) => b.subs - a.subs)
      .slice(0,8);
  };

  // Fetch RISING channels (new channels growing fast — last 1 year)
  const fetchRisingChannels = async (niche) => {
    const KW = {
      finance:"personal finance investing",health:"health wellness",
      tech:"ai technology",motivation:"motivation mindset",
      relationship:"relationship advice",business:"business startup",
      gaming:"gaming",food:"food recipes cooking",travel:"travel vlog",
      education:"education tutorial",fitness:"fitness workout",
      crypto:"crypto bitcoin",history:"history facts",
      mystery:"mystery unsolved",animals:"wildlife nature",
      news:"facts documentary",
    };
    const kw = (KW[niche]||niche) + " english";
    const since = new Date(Date.now() - 365*24*60*60*1000).toISOString(); // 1 year

    const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
    const sd = await sr.json();
    if (!sr.ok) throw new Error(sd.error?.message);

    const englishItems = (sd.items||[]).filter(i => isEnglish(i.snippet.title||""));
    const channelIds = [...new Set(englishItems.map(i=>i.snippet.channelId))].slice(0,10);

    const channels = await getChannelData(channelIds);

    // Rising = smaller channels (under 500K subs) with good content
    return channels
      .filter(ch => ch.subs < 500000 && ch.subs > 1000)
      .sort((a,b) => b.totalViews - a.totalViews)
      .slice(0,8);
  };

  // Fetch trending videos (this week - 7 days)
  const fetchTrending = async (niche) => {
    const KW = {
      finance:"personal finance investing money",health:"health tips wellness",
      tech:"artificial intelligence technology",motivation:"motivation success mindset",
      relationship:"relationship advice",business:"business entrepreneurship",
      gaming:"gaming highlights",food:"food recipes cooking",
      travel:"travel vlog",education:"education learning tutorial",
      fitness:"fitness workout",crypto:"cryptocurrency bitcoin",
      history:"dark history facts documentary",mystery:"mystery unsolved secrets",
      animals:"animals wildlife nature",news:"facts documentary",
    };
    const kw = (KW[niche]||niche) + " english";
    const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();

    const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
    const sd = await sr.json();
    if (!sr.ok) throw new Error(sd.error?.message);

    const ids = (sd.items||[]).map(i=>i.id.videoId).filter(Boolean).join(",");
    if (!ids) return { videos:[], kw };

    const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const vd = await vr.json();

    const channelIds = [...new Set((vd.items||[]).map(v=>v.snippet.channelId))];
    const channelData = await getChannelData(channelIds);
    const chMap = Object.fromEntries(channelData.map(c=>[c.id,c]));

    const videos = (vd.items||[])
      .filter(v => isEnglish(v.snippet.title))
      .map(v=>({
        id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle,
        channelId:v.snippet.channelId,
        channelUrl: chMap[v.snippet.channelId]?.url || `https://youtube.com/channel/${v.snippet.channelId}`,
        channelSubs: chMap[v.snippet.channelId]?.subs || 0,
        views:parseInt(v.statistics.viewCount||0),
        likes:parseInt(v.statistics.likeCount||0),
        comments:parseInt(v.statistics.commentCount||0),
        published:v.snippet.publishedAt?.slice(0,10),
        thumb:v.snippet.thumbnails?.medium?.url,
        url:"https://youtube.com/watch?v="+v.id,
      }))
      .sort((a,b)=>b.views-a.views)
      .slice(0,10);

    const channels = channelData.sort((a,b)=>b.subs-a.subs).slice(0,6);
    return { videos, channels, kw };
  };

  try {
    if (action === "ping") {
      return res.status(200).json({ ok:true, youtube:!!YT_KEY, groq:!!GROQ_KEY, time:new Date().toISOString() });
    }

    if (action === "top-channels") {
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      const channels = await fetchTopChannels(niche);
      return res.status(200).json({ channels });
    }

    if (action === "rising-channels") {
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      const channels = await fetchRisingChannels(niche);
      return res.status(200).json({ channels });
    }

    if (action === "analyze") {
      if (!GROQ_KEY||!YT_KEY) return res.status(500).json({ error:"Key missing" });
      if (!niche||!prompt) return res.status(400).json({ error:"niche and prompt required" });

      const isChannelTab = ["faceless_finder","rising_channels","channel_clone"].includes(decodeURIComponent(prompt).slice(0,30));

      const { videos, channels, kw } = await fetchTrending(niche);
      if (!videos.length) return res.status(200).json({ text:"No English trending videos found this week.", videos:[], channels:[] });

      const videoSummary = videos.slice(0,8).map((v,i) =>
        `#${i+1} "${v.title}" by ${v.channel} (${v.channelUrl}) — ${v.views.toLocaleString()} views | ${v.url}`
      ).join("\n");

      const channelSummary = channels.slice(0,6).map(ch =>
        `• ${ch.name} | ${ch.url} | ${ch.subs.toLocaleString()} subs | ${ch.totalViews.toLocaleString()} total views`
      ).join("\n");

      const analysisPrompt = `REAL YouTube data for "${niche}" niche:

TRENDING VIDEOS THIS WEEK:
${videoSummary}

CHANNELS IN THIS NICHE:
${channelSummary}

IMPORTANT: Only use the real data above. Never invent URLs or statistics.

Task: ${decodeURIComponent(prompt)}`;

      const text = await groqAI(
        "You are a YouTube strategy expert. Use ONLY the real data provided. Never invent channel names, URLs, or stats.",
        analysisPrompt
      );

      return res.status(200).json({ text, videos, channels, kw, dataAnalyzed:videos.length });
    }

    if (action === "trending") {
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      const result = await fetchTrending(niche);
      return res.status(200).json(result);
    }

    if (action === "ai") {
      if (!GROQ_KEY) return res.status(500).json({ error:"Groq key missing" });
      const text = await groqAI(
        "You are a world-class YouTube automation expert. Be highly actionable, detailed, use emojis.",
        decodeURIComponent(prompt)
      );
      return res.status(200).json({ text });
    }

    return res.status(400).json({ error:"Unknown action" });
  } catch(err) {
    return res.status(500).json({ error:err.message });
  }
}
