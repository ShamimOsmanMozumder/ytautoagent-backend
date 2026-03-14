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
    if(!text) return false;
    let nonLatin = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code > 0x024F && code < 0xFB00) nonLatin++;
    }
    return (nonLatin / text.length) < 0.15;
  };

  const TV_KEYWORDS = ["cnn","bbc","fox news","nbc","abc news","cbs","msnbc","sky news",
    "al jazeera","bloomberg","reuters","ap news","guardian","new york times","washington post",
    "vice","national geographic","discovery channel","history channel","a&e","animal planet",
    "food network","travel channel","tlc","hgtv","espn","disney","netflix","hbo",
    "news24","ndtv","zee news","aaj tak","india today","times now","republic tv","wion",
    "dd news","doordarshan","press tv","rt news","cgtn","france 24","dw news","euronews"
  ];

  const isCreator = (name = "") => {
    const n = name.toLowerCase();
    if (TV_KEYWORDS.some(kw => n.includes(kw))) return false;
    if (n.endsWith(" tv") && n.length < 15) return false;
    if (n.includes(" news") && !n.includes("tech news") && !n.includes("gaming news")) return false;
    return true;
  };

  const getChannelData = async (channelIds) => {
    if (!channelIds.length) return [];
    const ids = [...new Set(channelIds)].slice(0, 20).join(",");
    const cr = await fetch(`${BASE}/channels?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const cd = await cr.json();
    return (cd.items || []).map(ch => ({
      id: ch.id,
      name: ch.snippet.title,
      url: ch.snippet.customUrl ? `https://youtube.com/${ch.snippet.customUrl}` : `https://youtube.com/channel/${ch.id}`,
      subs: parseInt(ch.statistics.subscriberCount || 0),
      totalViews: parseInt(ch.statistics.viewCount || 0),
      videoCount: parseInt(ch.statistics.videoCount || 0),
      thumb: ch.snippet.thumbnails?.default?.url || "",
    }));
  };

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

  // Best single search term per niche — proven to return big channels
  const BEST_TERM = {
    mystery:      "mystery explained",
    history:      "history explained",
    finance:      "personal finance",
    tech:         "technology explained",
    motivation:   "self improvement",
    business:     "entrepreneurship",
    gaming:       "gaming",
    food:         "cooking",
    travel:       "travel documentary",
    education:    "science explained",
    fitness:      "fitness",
    crypto:       "cryptocurrency explained",
    animals:      "wildlife documentary",
    relationship: "psychology explained",
    news:         "documentary explained",
  };

  const fetchTopChannels = async (niche) => {
    const term = BEST_TERM[niche] || niche;
    let allIds = new Set();

    // Only 2 searches to save quota
    const queries = [term, term + " youtube channel"];
    
    for(const q of queries) {
      const sr = await fetch(
        `${BASE}/search?part=snippet&q=${encodeURIComponent(q)}&type=channel&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`
      );
      const sd = await sr.json();
      if(sr.ok) {
        (sd.items||[])
          .filter(i => isEnglish(i.snippet.title) && isCreator(i.snippet.title))
          .forEach(i => allIds.add(i.id.channelId));
      }
    }

    // Also search videos to find channels — more reliable
    const vsr = await fetch(
      `${BASE}/search?part=snippet&q=${encodeURIComponent(term+" english")}&type=video&order=viewCount&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`
    );
    const vsd = await vsr.json();
    if(vsr.ok) {
      (vsd.items||[])
        .filter(i => isEnglish(i.snippet.title||"") && isCreator(i.snippet.channelTitle||""))
        .forEach(i => allIds.add(i.snippet.channelId));
    }

    const channels = await getChannelData([...allIds]);
    
    const filtered = channels
      .filter(ch => isCreator(ch.name) && isEnglish(ch.name))
      .sort((a,b) => b.subs - a.subs);

    // Return top 10, minimum 1K subs
    return filtered.filter(ch => ch.subs >= 1000).slice(0,10);
  };

  const fetchRisingChannels = async (niche) => {
    const term = (BEST_TERM[niche] || niche) + " 2025";
    const since = new Date(Date.now() - 365*24*60*60*1000).toISOString();
    
    const sr = await fetch(
      `${BASE}/search?part=snippet&q=${encodeURIComponent(term)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`
    );
    const sd = await sr.json();
    if(!sr.ok) return [];

    const ids = [...new Set(
      (sd.items||[])
        .filter(i => isEnglish(i.snippet.title||"") && isCreator(i.snippet.channelTitle||""))
        .map(i => i.snippet.channelId)
    )];

    const channels = await getChannelData(ids);
    return channels
      .filter(ch => ch.subs >= 1000 && ch.subs <= 1000000 && isCreator(ch.name))
      .sort((a,b) => b.totalViews - a.totalViews)
      .slice(0,10);
  };

  const fetchTrending = async (niche) => {
    const KW = {
      finance:"personal finance investing",health:"health tips wellness",
      tech:"artificial intelligence explained",motivation:"motivation success",
      relationship:"relationship psychology",business:"business entrepreneur",
      gaming:"gaming explained",food:"food cooking explained",
      travel:"travel documentary",education:"science explained",
      fitness:"fitness workout",crypto:"cryptocurrency bitcoin",
      history:"dark history facts",mystery:"mystery unsolved secrets",
      animals:"wildlife nature facts",news:"facts documentary explained",
    };
    const kw = (KW[niche]||niche)+" english";
    const since = new Date(Date.now()-7*24*60*60*1000).toISOString();

    const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
    const sd = await sr.json();
    if(!sr.ok) throw new Error(sd.error?.message);

    const ids = (sd.items||[]).map(i=>i.id.videoId).filter(Boolean).join(",");
    if(!ids) return {videos:[],channels:[],kw};

    const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const vd = await vr.json();

    const chIds = [...new Set((vd.items||[]).map(v=>v.snippet.channelId))];
    const chData = await getChannelData(chIds);
    const chMap = Object.fromEntries(chData.map(c=>[c.id,c]));

    const videos = (vd.items||[])
      .filter(v => isEnglish(v.snippet.title) && isCreator(v.snippet.channelTitle))
      .map(v=>({
        id:v.id, title:v.snippet.title, channel:v.snippet.channelTitle,
        channelId:v.snippet.channelId,
        channelUrl:chMap[v.snippet.channelId]?.url||`https://youtube.com/channel/${v.snippet.channelId}`,
        views:parseInt(v.statistics.viewCount||0),
        likes:parseInt(v.statistics.likeCount||0),
        comments:parseInt(v.statistics.commentCount||0),
        published:v.snippet.publishedAt?.slice(0,10),
        thumb:v.snippet.thumbnails?.medium?.url,
        url:"https://youtube.com/watch?v="+v.id,
      }))
      .sort((a,b)=>b.views-a.views).slice(0,10);

    const channels = chData.filter(ch=>isCreator(ch.name)).sort((a,b)=>b.subs-a.subs).slice(0,6);
    return {videos,channels,kw};
  };

  try {
    if(action==="ping") {
      return res.status(200).json({ok:true,youtube:!!YT_KEY,groq:!!GROQ_KEY,time:new Date().toISOString()});
    }

    if(action==="top-channels") {
      if(!YT_KEY) return res.status(500).json({error:"YouTube key missing"});
      const channels = await fetchTopChannels(niche);
      return res.status(200).json({channels});
    }

    if(action==="rising-channels") {
      if(!YT_KEY) return res.status(500).json({error:"YouTube key missing"});
      const channels = await fetchRisingChannels(niche);
      return res.status(200).json({channels});
    }

    if(action==="trending") {
      if(!YT_KEY) return res.status(500).json({error:"YouTube key missing"});
      const result = await fetchTrending(niche);
      return res.status(200).json(result);
    }

    if(action==="ai") {
      if(!GROQ_KEY) return res.status(500).json({error:"Groq key missing"});
      if(!prompt) return res.status(400).json({error:"prompt missing"});
      const text = await groqAI(
        "You are a world-class YouTube automation expert. Be highly actionable, specific, and data-driven. Use emojis.",
        decodeURIComponent(prompt)
      );
      return res.status(200).json({text});
    }

    if(action==="analyze") {
      if(!GROQ_KEY||!YT_KEY) return res.status(500).json({error:"Keys missing"});
      if(!niche||!prompt) return res.status(400).json({error:"niche and prompt required"});
      const {videos,channels,kw} = await fetchTrending(niche);
      const vSum = videos.slice(0,8).map((v,i)=>
        `#${i+1} "${v.title}" by ${v.channel} (${v.channelUrl}) — ${v.views.toLocaleString()} views | ${v.url}`
      ).join("\n");
      const cSum = channels.slice(0,5).map(ch=>
        `• ${ch.name} | ${ch.url} | ${ch.subs.toLocaleString()} subs`
      ).join("\n");
      const ap = `REAL YouTube data for "${niche}":\n\nTRENDING VIDEOS:\n${vSum||"none"}\n\nCHANNELS:\n${cSum||"none"}\n\nTASK: ${decodeURIComponent(prompt)}`;
      const text = await groqAI(
        "You are a YouTube strategy expert. Use ONLY real data provided. Never invent URLs or stats.",
        ap
      );
      return res.status(200).json({text,videos,channels,kw});
    }

    return res.status(400).json({error:"Unknown action"});
  } catch(err) {
    return res.status(500).json({error:err.message});
  }
}
