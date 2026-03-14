export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, niche, prompt } = req.query;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const BASE = "https://www.googleapis.com/youtube/v3";

  // Real established faceless/automation-friendly channel IDs per niche
  const TOP_CHANNELS = {
    mystery:    ["UCVnH6EgQRXBjlxWJnnnXvTg","UC3sznuotAs2ohg_MxF1aFRQ","UCpko_-a4wgz2u_DgDgd9fqA","UCIRiWCPZoUyZDbzIuKblW4g","UC9-y-6csu5WGm29I7JiwpnA","UCLtREJY21xRfDn_JMiPOWGQ","UCddiUEpeqJcYeBxX1IVBKvQ","UC5s4GrFwAFl-7MDWj0ozH1Q","UCxbKGpRORvhHFGEYKDcFBdQ","UCqezqcAiWkD2MkGXRqh_O5g"],
    history:    ["UC3sznuotAs2ohg_MxF1aFRQ","UCpko_-a4wgz2u_DgDgd9fqA","UCvW8JzztV3k3W8tohjSNRlw","UC4QZ_LsYcvcq7qOsOhpAX4A","UCYO_jab_esuFRV4b17AJtAg","UCVnH6EgQRXBjlxWJnnnXvTg","UCGzCROwg0E3aMgM5G0nRgIg","UCZdWN3J-GCBFBBGOqDSCj3A","UCIRiWCPZoUyZDbzIuKblW4g","UCJ0-OtVpF0wOKEqT2Z1HEtA"],
    finance:    ["UCL-EHMnkZZWknSuSL3ckHMg","UCpko_-a4wgz2u_DgDgd9fqA","UCOmcA3f_RrH6b9NmcNa4tdg","UCBR8-60-B28hp2BmDPdntcQ","UCddiUEpeqJcYeBxX1IVBKvQ","UCuZgS2jLT6blmVCIxJKLgiA","UCKMqmkHABuhfNfR03KYPBzQ","UC2UXDak6o7rBm23x3jUMGfQ","UCVoX_LBLzYBlFx9YbYd9MQQ","UC0vBXGSyV14uvJ4hECDOl0Q"],
    tech:       ["UCBcRF18a7Qf58cCRy5xuWwQ","UC9-y-6csu5WGm29I7JiwpnA","UCXuqSBlHAE6Xw-yeJA0Tunw","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCWX3yGbODI3HLKLJAq49vbw","UC0RhatS1pyxInC00YKjjBqQ","UCMiJRAwDNSNzuYeN2uWa0pA","UCddiUEpeqJcYeBxX1IVBKvQ","UCeVMnSShP_Iviwkknt83cww"],
    motivation: ["UCpko_-a4wgz2u_DgDgd9fqA","UCKMqmkHABuhfNfR03KYPBzQ","UC3sznuotAs2ohg_MxF1aFRQ","UCXRqTMGAGqIbdxyEb4E4IsQ","UCfvgFBjXNFIEFSNm5X-6ZbA","UCqezqcAiWkD2MkGXRqh_O5g","UC0vBXGSyV14uvJ4hECDOl0Q","UCWX3yGbODI3HLKLJAq49vbw","UCiGm_E4ZwYSHV3bcW1pnp4Q","UCGSGPehp0RWfca-kENgBJ9Q"],
    business:   ["UCpko_-a4wgz2u_DgDgd9fqA","UCL-EHMnkZZWknSuSL3ckHMg","UC0vBXGSyV14uvJ4hECDOl0Q","UCKMqmkHABuhfNfR03KYPBzQ","UCBR8-60-B28hp2BmDPdntcQ","UCddiUEpeqJcYeBxX1IVBKvQ","UCuZgS2jLT6blmVCIxJKLgiA","UC2UXDak6o7rBm23x3jUMGfQ","UCVoX_LBLzYBlFx9YbYd9MQQ","UCnUYZLuoy1rq1aVMwx4aTzw"],
    gaming:     ["UCX6OQ3DkcsbYNE6H8uQQuVA","UCam8T03EOFBsNdR0thrTztw","UCpqXJOEqGS-TCnazcHCo0rA","UC-lHJZR3Gqxm24_Vd_AJ5Yw","UC2wKfjlioOCLP4xQMOWNcgg","UCYzPXprvl5Y-Sf0g4vX-m6g","UCKvoBPlFafkqFHzkEkSNqKg","UCq-Fj5jknLsUf-MWSy4_brA","UCZ_Y9a5UQZX0UBRoLJPqIKQ","UCjmJDM5pRKbUf-skrMKLBcA"],
    food:       ["UCJFp8uSYCjXOMnkUyb3CQ3Q","UCpko_-a4wgz2u_DgDgd9fqA","UC0vBXGSyV14uvJ4hECDOl0Q","UC3sznuotAs2ohg_MxF1aFRQ","UCR-DT9uhXMfAHCOgYcOl2gA","UCuExwJYVlHxHBMRwqb9BUPA","UCKMqmkHABuhfNfR03KYPBzQ","UCmmPgObSUPw1HL2lq6H4ffA","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg"],
    travel:     ["UCpko_-a4wgz2u_DgDgd9fqA","UC3sznuotAs2ohg_MxF1aFRQ","UCvW8JzztV3k3W8tohjSNRlw","UC0vBXGSyV14uvJ4hECDOl0Q","UCKMqmkHABuhfNfR03KYPBzQ","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCfvgFBjXNFIEFSNm5X-6ZbA","UCOmcA3f_RrH6b9NmcNa4tdg","UCuZgS2jLT6blmVCIxJKLgiA"],
    fitness:    ["UC0vBXGSyV14uvJ4hECDOl0Q","UCpko_-a4wgz2u_DgDgd9fqA","UCKMqmkHABuhfNfR03KYPBzQ","UCHrnqmkfGFi_-FbHEEkpqoA","UCmMUZbaYdNH0bEd1PAlAqsA","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCfvgFBjXNFIEFSNm5X-6ZbA","UC3sznuotAs2ohg_MxF1aFRQ","UCuZgS2jLT6blmVCIxJKLgiA"],
    crypto:     ["UCL-EHMnkZZWknSuSL3ckHMg","UCpko_-a4wgz2u_DgDgd9fqA","UCOmcA3f_RrH6b9NmcNa4tdg","UCddiUEpeqJcYeBxX1IVBKvQ","UCuZgS2jLT6blmVCIxJKLgiA","UCKMqmkHABuhfNfR03KYPBzQ","UC2UXDak6o7rBm23x3jUMGfQ","UCVoX_LBLzYBlFx9YbYd9MQQ","UC0vBXGSyV14uvJ4hECDOl0Q","UC9-y-6csu5WGm29I7JiwpnA"],
    health:     ["UC0vBXGSyV14uvJ4hECDOl0Q","UCpko_-a4wgz2u_DgDgd9fqA","UCKMqmkHABuhfNfR03KYPBzQ","UC3sznuotAs2ohg_MxF1aFRQ","UCmMUZbaYdNH0bEd1PAlAqsA","UCHrnqmkfGFi_-FbHEEkpqoA","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCfvgFBjXNFIEFSNm5X-6ZbA","UCOmcA3f_RrH6b9NmcNa4tdg"],
    education:  ["UC4QZ_LsYcvcq7qOsOhpAX4A","UCYO_jab_esuFRV4b17AJtAg","UCpko_-a4wgz2u_DgDgd9fqA","UCvW8JzztV3k3W8tohjSNRlw","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCKMqmkHABuhfNfR03KYPBzQ","UCXuqSBlHAE6Xw-yeJA0Tunw","UC3sznuotAs2ohg_MxF1aFRQ","UCX6OQ3DkcsbYNE6H8uQQuVA"],
    animals:    ["UCpko_-a4wgz2u_DgDgd9fqA","UC3sznuotAs2ohg_MxF1aFRQ","UCvW8JzztV3k3W8tohjSNRlw","UC0vBXGSyV14uvJ4hECDOl0Q","UCKMqmkHABuhfNfR03KYPBzQ","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCfvgFBjXNFIEFSNm5X-6ZbA","UCOmcA3f_RrH6b9NmcNa4tdg","UCuZgS2jLT6blmVCIxJKLgiA"],
    news:       ["UCupvZG-5ko_eiXAupbDfxWw","UCHaHD477h-FeBbVh9Sh7syA","UCpko_-a4wgz2u_DgDgd9fqA","UC3sznuotAs2ohg_MxF1aFRQ","UCvW8JzztV3k3W8tohjSNRlw","UC0vBXGSyV14uvJ4hECDOl0Q","UCKMqmkHABuhfNfR03KYPBzQ","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCfvgFBjXNFIEFSNm5X-6ZbA"],
    relationship:["UCpko_-a4wgz2u_DgDgd9fqA","UC3sznuotAs2ohg_MxF1aFRQ","UC0vBXGSyV14uvJ4hECDOl0Q","UCKMqmkHABuhfNfR03KYPBzQ","UCnUYZLuoy1rq1aVMwx4aTzw","UCbmNph6atAoGfqLoCL_duAg","UCfvgFBjXNFIEFSNm5X-6ZbA","UCOmcA3f_RrH6b9NmcNa4tdg","UCuZgS2jLT6blmVCIxJKLgiA","UCXRqTMGAGqIbdxyEb4E4IsQ"],
  };

  const isEnglish = (text) => {
    let nonLatin = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code > 0x024F && code < 0xFB00) nonLatin++;
    }
    return (nonLatin / text.length) < 0.15;
  };

  // Filter out TV channels, news networks, and mainstream media
  const TV_KEYWORDS = [
    "cnn","bbc","fox news","nbc","abc news","cbs","msnbc","sky news","al jazeera",
    "bloomberg","reuters","associated press","ap news","the guardian","new york times",
    "washington post","vice news","buzzfeed","vox","vice","nbc news","abc","cbs news",
    "channel 4","channel 5","itv","channel news","news channel","tv channel",
    "official channel","national geographic","discovery","history channel","a&e",
    "animal planet","food network","travel channel","tlc","hgtv","espn","sports center",
    "disney","netflix","hbo","amazon","hulu","paramount","universal","sony","warner",
    "news24","ndtv","zee news","aaj tak","india today","times now","republic tv",
    "wion","dd news","doordarshan","press tv","rt news","cgtn","france 24"
  ];
  
  const isCreatorChannel = (channel) => {
    const name = (channel.name || channel.channelTitle || "").toLowerCase();
    const desc = (channel.description || "").toLowerCase();
    
    // Filter TV/media channels
    if(TV_KEYWORDS.some(kw => name.includes(kw))) return false;
    
    // Filter verified mega channels that are TV/media (usually have "official" or "tv" in name)
    if(name.includes(" tv") && !name.includes("review")) return false;
    if(name.includes("official") && channel.subs > 5000000) return false;
    if(name.includes("news") && !name.includes("tech news") && !name.includes("daily news")) return false;
    
    return true;
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

  const getChannelData = async (channelIds) => {
    if (!channelIds.length) return [];
    const ids = channelIds.slice(0,10).join(",");
    const cr = await fetch(`${BASE}/channels?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const cd = await cr.json();
    return (cd.items||[]).map(ch => ({
      id: ch.id,
      name: ch.snippet.title,
      url: ch.snippet.customUrl ? `https://youtube.com/${ch.snippet.customUrl}` : `https://youtube.com/channel/${ch.id}`,
      subs: parseInt(ch.statistics.subscriberCount||0),
      totalViews: parseInt(ch.statistics.viewCount||0),
      videoCount: parseInt(ch.statistics.videoCount||0),
      thumb: ch.snippet.thumbnails?.default?.url||"",
      description: ch.snippet.description?.slice(0,80)||"",
    }));
  };

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
    if (!ids) return { videos:[], channels:[], kw };
    const vr = await fetch(`${BASE}/videos?part=statistics,snippet&id=${ids}&key=${YT_KEY}`);
    const vd = await vr.json();
    const channelIds = [...new Set((vd.items||[]).map(v=>v.snippet.channelId))];
    const channelData = await getChannelData(channelIds);
    const chMap = Object.fromEntries(channelData.map(c=>[c.id,c]));
    const videos = (vd.items||[])
      .filter(v => isEnglish(v.snippet.title) && isCreatorChannel({name: v.snippet.channelTitle}))
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

  const fetchRisingChannels = async (niche) => {
    const KW = {
      finance:"personal finance investing",health:"health wellness",
      tech:"ai technology",motivation:"motivation mindset",
      relationship:"relationship advice",business:"business startup",
      gaming:"gaming",food:"food recipes",travel:"travel vlog",
      education:"education tutorial",fitness:"fitness workout",
      crypto:"crypto bitcoin",history:"history facts",
      mystery:"mystery unsolved",animals:"wildlife nature",news:"facts documentary",
    };
    const kw = (KW[niche]||niche) + " english";
    const since = new Date(Date.now() - 365*24*60*60*1000).toISOString();
    const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(kw)}&type=video&order=viewCount&publishedAfter=${since}&maxResults=20&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
    const sd = await sr.json();
    if (!sr.ok) throw new Error(sd.error?.message);
    const englishItems = (sd.items||[]).filter(i => isEnglish(i.snippet.title||""));
    const channelIds = [...new Set(englishItems.map(i=>i.snippet.channelId))].slice(0,10);
    const channels = await getChannelData(channelIds);
    return channels.filter(ch => ch.subs < 500000 && ch.subs > 1000 && isCreatorChannel(ch)).sort((a,b)=>b.totalViews-a.totalViews).slice(0,10);
  };

  try {
    if (action === "ping") {
      return res.status(200).json({ ok:true, youtube:!!YT_KEY, groq:!!GROQ_KEY, time:new Date().toISOString() });
    }

    if (action === "top-channels") {
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      
      // Search for channels in this niche
      const KW = {
        finance:"personal finance investing",health:"health wellness tips",
        tech:"artificial intelligence tech review",motivation:"motivation success mindset",
        relationship:"relationship advice psychology",business:"business entrepreneurship",
        gaming:"gaming commentary",food:"food recipes cooking",travel:"travel vlog documentary",
        education:"education explained",fitness:"fitness workout training",
        crypto:"cryptocurrency bitcoin investing",history:"history documentary dark facts",
        mystery:"mystery unsolved dark secrets",animals:"wildlife nature documentary",
        news:"facts documentary explained",relationship:"relationship advice dating",
      };
      const kw = KW[niche] || niche;
      
      // Search multiple keyword variations to get more channels
      const searches = [kw, kw+" channel", kw+" youtube"];
      let allChannelIds = new Set();
      
      for(const q of searches) {
        const sr = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(q)}&type=channel&maxResults=15&relevanceLanguage=en&regionCode=US&key=${YT_KEY}`);
        const sd = await sr.json();
        if(sr.ok) {
          (sd.items||[])
            .filter(i => isEnglish(i.snippet.title||""))
            .forEach(i => allChannelIds.add(i.id.channelId));
        }
      }
      
      // Get real stats for all found channels
      const allChannels = await getChannelData([...allChannelIds]);
      
      // Filter: minimum 50K subs = established channel
      const topChannels = allChannels
        .filter(ch => ch.subs >= 50000)
        .sort((a,b) => b.subs - a.subs)
        .slice(0,10);
      
      const filteredChannels = topChannels.filter(ch => isCreatorChannel(ch));
      return res.status(200).json({ channels: filteredChannels });
    }

    if (action === "rising-channels") {
      if (!YT_KEY) return res.status(500).json({ error:"YouTube key missing" });
      const channels = await fetchRisingChannels(niche);
      return res.status(200).json({ channels });
    }

    if (action === "analyze") {
      if (!GROQ_KEY||!YT_KEY) return res.status(500).json({ error:"Key missing" });
      if (!niche||!prompt) return res.status(400).json({ error:"niche and prompt required" });
      const { videos, channels, kw } = await fetchTrending(niche);
      if (!videos.length) return res.status(200).json({ text:"No English trending videos found this week.", videos:[], channels:[] });
      const videoSummary = videos.slice(0,8).map((v,i) =>
        `#${i+1} "${v.title}" by ${v.channel} (${v.channelUrl}) — ${v.views.toLocaleString()} views | ${v.url}`
      ).join("\n");
      const channelSummary = channels.slice(0,6).map(ch =>
        `• ${ch.name} | URL: ${ch.url} | ${ch.subs.toLocaleString()} subs | ${ch.totalViews.toLocaleString()} total views`
      ).join("\n");
      const analysisPrompt = `REAL YouTube data for "${niche}" niche. When mentioning any channel, always include its full URL.

TRENDING VIDEOS THIS WEEK:
${videoSummary}

CHANNELS IN TRENDING:
${channelSummary}

IMPORTANT: Only use real data above. Never invent URLs or statistics.
Task: ${decodeURIComponent(prompt)}`;
      const text = await groqAI(
        "You are a YouTube strategy expert. Use ONLY real data provided. Never invent channel names, URLs, or stats.",
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
