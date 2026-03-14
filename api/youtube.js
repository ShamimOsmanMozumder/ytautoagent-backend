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
    return text.length > 0 && (nonLatin / text.length) < 0.15;
  };

  // Filter TV/media/news channels — only individual YouTube creators
  const TV_KEYWORDS = ["cnn","bbc","fox news","nbc","abc news","cbs","msnbc","sky news",
    "al jazeera","bloomberg","reuters","ap news","guardian","new york times","washington post",
    "vice news","buzzfeed","vox","national geographic","discovery channel","history channel",
    "a&e","animal planet","food network","travel channel","tlc","hgtv","espn","disney",
    "netflix","hbo","amazon prime","hulu","paramount","universal","sony pictures","warner",
    "news24","ndtv","zee news","aaj tak","india today","times now","republic tv","wion",
    "dd news","doordarshan","press tv","rt news","cgtn","france 24","dw news","euronews",
    "sky sports","bein sports","star sports","ten sports"
  ];

  const isCreatorChannel = (name = "") => {
    const n = name.toLowerCase();
    if (TV_KEYWORDS.some(kw => n.includes(kw))) return false;
    if (n.endsWith(" tv") && n.length < 20) return false;
    if (n.includes(" news") && !n.includes("tech news") && !n.includes("gaming news")) return false;
    if (n.includes("official channel")) return false;
    return true;
  };

  // Get real channel stats from YouTube API
  const getChannelData = async (channelIds) => {
    if (!channelIds.length) return [];
    const ids = [...new Set(channelIds)].slice(0, 50).join(",");
    const cr = await fetch(`${BASE}/channels?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const cd = await cr.json();
    return (cd.items || []).map(ch => ({
      id: ch.id,
      name: ch.snippet.title,
      url: ch.snippet.customUrl
        ? `https://youtube.com/${ch.snippet.customUrl}`
        : `https://youtube.com/channel/${ch.id}`,
      subs: parseInt(ch.statistics.subscriberCount || 0),
      totalViews: parseInt(ch.statistics.viewCount || 0),
      videoCount: parseInt(ch.statistics.videoCount || 0),
      thumb: ch.snippet.thumbnails?.default?.url || "",
      description: ch.snippet.description?.slice(0, 100) || "",
    }));
  };

  // Groq AI call
  const groqAI = async (system, user) => {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: 1500
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Groq error");
    return d.choices?.[0]?.message?.content || "";
  };

  // Fetch top established channels using multiple search strategies
  const fetchTopChannels = async (niche) => {
    const SEARCH_TERMS = {
      mystery: [
        "mystery youtube channel", "unsolved mysteries explained", 
        "dark secrets youtube", "conspiracy theories explained",
        "true crime mystery channel", "paranormal explained youtube"
      ],
      history: [
        "history youtube channel", "dark history explained",
        "ancient civilization documentary", "historical events explained",
        "world history channel", "history facts documentary"
      ],
      finance: [
        "personal finance youtube", "investing for beginners channel",
        "stock market explained channel", "financial independence youtube",
        "money tips youtube channel", "passive income investing"
      ],
      tech: [
        "technology youtube channel", "artificial intelligence explained",
        "future technology documentary", "science technology channel",
        "tech explained youtube", "gadgets technology review"
      ],
      motivation: [
        "motivation youtube channel", "self improvement explained",
        "success mindset channel", "personal development youtube",
        "life advice channel", "discipline motivation youtube"
      ],
      business: [
        "business youtube channel", "entrepreneurship explained",
        "startup success stories", "make money online channel",
        "side hustle youtube", "business strategy explained"
      ],
      gaming: [
        "gaming youtube channel", "video game documentary",
        "gaming history explained", "game facts channel",
        "gaming lore explained", "esports documentary youtube"
      ],
      food: [
        "food youtube channel", "cooking explained documentary",
        "food science channel", "recipe youtube channel",
        "food history explained", "culinary documentary youtube"
      ],
      travel: [
        "travel youtube channel", "travel documentary explained",
        "hidden places world youtube", "adventure travel channel",
        "country explained youtube", "travel facts channel"
      ],
      education: [
        "education youtube channel", "science explained channel",
        "learn something new youtube", "knowledge documentary channel",
        "how things work explained", "educational documentary youtube"
      ],
      fitness: [
        "fitness youtube channel", "workout explained channel",
        "health science youtube", "body transformation channel",
        "exercise science explained", "nutrition fitness youtube"
      ],
      crypto: [
        "cryptocurrency youtube channel", "bitcoin explained channel",
        "crypto investing documentary", "blockchain explained youtube",
        "defi explained channel", "web3 youtube channel"
      ],
      animals: [
        "wildlife youtube channel", "animal documentary channel",
        "nature facts explained", "animal behavior youtube",
        "wild animals documentary", "ocean documentary youtube"
      ],
      relationship: [
        "psychology youtube channel", "relationship advice channel",
        "human behavior explained", "social skills youtube",
        "dating advice channel", "body language explained youtube"
      ],
      news: [
        "facts documentary youtube", "explained news channel",
        "world events documentary", "history documentary channel",
        "current events explained", "geopolitics explained youtube"
      ],
    };

    const terms = SEARCH_TERMS[niche] || [niche + " facts", niche + " explained"];
    let allChannelIds = new Set();

    // Search ALL terms to get maximum channels
    for (const term of terms) {
      const sr = await fetch(
        `${BASE}/search?part=snippet&q=${encodeURIComponent(term)}&type=channel&maxResults=15&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`
      );
      const sd = await sr.json();
      if (sr.ok) {
        (sd.items || [])
          .filter(i => {
            const title = i.snippet.title || "";
            const desc = i.snippet.description || "";
            // Must be English AND creator channel
            return isEnglish(title) && isCreatorChannel(title) && 
                   // Extra check: description should be mostly English
                   (desc.length === 0 || isEnglish(desc.slice(0, 100)));
          })
          .forEach(i => allChannelIds.add(i.id.channelId));
      }
    }

    // Get real stats in batches (max 50 IDs)
    const idArray = [...allChannelIds].slice(0, 50);
    let allChannels = [];
    
    // Fetch in batches of 10
    for(let i = 0; i < idArray.length; i += 10) {
      const batch = idArray.slice(i, i+10);
      const batchData = await getChannelData(batch);
      allChannels.push(...batchData);
    }

    // Filter: English channels, 50K+ subs, creator channels only
    return allChannels
      .filter(ch => ch.subs >= 50000 && isCreatorChannel(ch.name) && isEnglish(ch.name))
      .sort((a, b) => b.subs - a.subs)
      .slice(0, 10);
  };

  // Fetch rising channels (new, fast growing)
  const fetchRisingChannels = async (niche) => {
    const SEARCH_TERMS = {
      mystery: ["mystery shorts","mystery facts 2024","new mystery channel"],
      history: ["history shorts","history facts 2024","animated history"],
      finance: ["finance tips 2024","money tips shorts","investing 2024"],
      tech: ["ai explained 2024","tech shorts","technology 2024"],
      motivation: ["motivation shorts 2024","mindset 2024","self help 2024"],
      business: ["business 2024","entrepreneur 2024","side hustle 2024"],
      gaming: ["gaming 2024","game facts shorts","gaming shorts"],
      food: ["food facts 2024","recipe shorts","cooking 2024"],
      travel: ["travel 2024","travel shorts","travel facts 2024"],
      education: ["explained 2024","learn 2024","facts shorts 2024"],
      fitness: ["fitness 2024","workout shorts","health 2024"],
      crypto: ["crypto 2024","bitcoin 2024","crypto shorts"],
      animals: ["animal shorts 2024","nature 2024","wildlife 2024"],
      relationship: ["psychology 2024","relationship 2024","behavior 2024"],
      news: ["facts 2024","did you know 2024","amazing facts shorts"],
    };

    const terms = SEARCH_TERMS[niche] || [niche + " 2024", niche + " shorts"];
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    let allChannelIds = new Set();

    for (const term of terms.slice(0, 2)) {
      const sr = await fetch(
        `${BASE}/search?part=snippet&q=${encodeURIComponent(term)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=15&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`
      );
      const sd = await sr.json();
      if (sr.ok) {
        (sd.items || [])
          .filter(i => isEnglish(i.snippet.title || "") && isCreatorChannel(i.snippet.channelTitle || ""))
          .forEach(i => allChannelIds.add(i.snippet.channelId));
      }
    }

    const channels = await getChannelData([...allChannelIds]);
    return channels
      .filter(ch => ch.subs >= 1000 && ch.subs <= 500000 && isCreatorChannel(ch.name))
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 10);
  };

  // Fetch trending videos (this week)
  const fetchTrending = async (niche) => {
    const KW = {
      finance: "personal finance investing money",
      health: "health tips wellness",
      tech: "artificial intelligence technology explained",
      motivation: "motivation success mindset",
      relationship: "relationship psychology behavior",
      business: "business entrepreneur",
      gaming: "gaming facts explained",
      food: "food science cooking facts",
      travel: "travel documentary facts",
      education: "education science explained",
      fitness: "fitness workout science",
      crypto: "cryptocurrency bitcoin explained",
      history: "dark history facts documentary",
      mystery: "mystery unsolved secrets",
      animals: "animals wildlife nature facts",
      news: "facts documentary explained",
    };
    const kw = (KW[niche] || niche) + " english";
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const sr = await fetch(
      `${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`
    );
    const sd = await sr.json();
    if (!sr.ok) throw new Error(sd.error?.message);

    const ids = (sd.items || []).map(i => i.id.videoId).filter(Boolean).join(",");
    if (!ids) return { videos: [], channels: [], kw };

    const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const vd = await vr.json();

    const channelIds = [...new Set((vd.items || []).map(v => v.snippet.channelId))];
    const channelData = await getChannelData(channelIds);
    const chMap = Object.fromEntries(channelData.map(c => [c.id, c]));

    const videos = (vd.items || [])
      .filter(v => isEnglish(v.snippet.title) && isCreatorChannel(v.snippet.channelTitle))
      .map(v => ({
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        channelUrl: chMap[v.snippet.channelId]?.url || `https://youtube.com/channel/${v.snippet.channelId}`,
        channelSubs: chMap[v.snippet.channelId]?.subs || 0,
        views: parseInt(v.statistics.viewCount || 0),
        likes: parseInt(v.statistics.likeCount || 0),
        comments: parseInt(v.statistics.commentCount || 0),
        published: v.snippet.publishedAt?.slice(0, 10),
        thumb: v.snippet.thumbnails?.medium?.url,
        url: "https://youtube.com/watch?v=" + v.id,
        tags: v.snippet.tags?.slice(0, 5) || [],
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const channels = channelData
      .filter(ch => isCreatorChannel(ch.name))
      .sort((a, b) => b.subs - a.subs)
      .slice(0, 6);

    return { videos, channels, kw };
  };

  try {
    // PING
    if (action === "ping") {
      return res.status(200).json({ ok: true, youtube: !!YT_KEY, groq: !!GROQ_KEY, time: new Date().toISOString() });
    }

    // TOP ESTABLISHED CHANNELS
    if (action === "top-channels") {
      if (!YT_KEY) return res.status(500).json({ error: "YouTube key missing" });
      const channels = await fetchTopChannels(niche);
      return res.status(200).json({ channels });
    }

    // RISING CHANNELS
    if (action === "rising-channels") {
      if (!YT_KEY) return res.status(500).json({ error: "YouTube key missing" });
      const channels = await fetchRisingChannels(niche);
      return res.status(200).json({ channels });
    }

    // TRENDING VIDEOS
    if (action === "trending") {
      if (!YT_KEY) return res.status(500).json({ error: "YouTube key missing" });
      const result = await fetchTrending(niche);
      return res.status(200).json(result);
    }

    // ANALYZE — real data + AI
    if (action === "analyze") {
      if (!GROQ_KEY || !YT_KEY) return res.status(500).json({ error: "Keys missing" });
      if (!niche || !prompt) return res.status(400).json({ error: "niche and prompt required" });

      const { videos, channels, kw } = await fetchTrending(niche);

      const videoSummary = videos.slice(0, 8).map((v, i) =>
        `#${i+1} "${v.title}" by ${v.channel} (${v.channelUrl}) — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes | ${v.url}`
      ).join("\n");

      const channelSummary = channels.slice(0, 5).map(ch =>
        `• ${ch.name} | ${ch.url} | ${ch.subs.toLocaleString()} subs | ${ch.totalViews.toLocaleString()} total views`
      ).join("\n");

      const analysisPrompt = `REAL YouTube data fetched live from YouTube API for "${niche}" niche:

TRENDING VIDEOS THIS WEEK (real data):
${videoSummary || "No trending videos found"}

CHANNELS IN THIS NICHE (real data):
${channelSummary || "No channel data"}

Use ONLY this real data. Never invent URLs or statistics. Always include real URLs when mentioning channels or videos.

TASK: ${decodeURIComponent(prompt)}`;

      const text = await groqAI(
        "You are a world-class YouTube strategy expert. Analyze ONLY the real data provided. Never invent channel names, URLs, or statistics. Be specific, data-driven, and actionable.",
        analysisPrompt
      );

      return res.status(200).json({ text, videos, channels, kw, dataAnalyzed: videos.length });
    }

    // PURE AI
    if (action === "ai") {
      if (!GROQ_KEY) return res.status(500).json({ error: "Groq key missing" });
      if (!prompt) return res.status(400).json({ error: "prompt missing" });
      const text = await groqAI(
        "You are a world-class YouTube automation expert. Be highly actionable, detailed, use emojis.",
        decodeURIComponent(prompt)
      );
      return res.status(200).json({ text });
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
