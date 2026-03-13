# YTAutoAgent Backend

YouTube API proxy server for YTAutoAgent — deployed free on Vercel.

## Deploy in 5 minutes

### Step 1: Upload to GitHub
1. Go to github.com → click "+" → "New repository"
2. Name it: `ytautoagent-backend`
3. Make it Public
4. Click "Create repository"
5. Upload these files:
   - `api/youtube.js`
   - `package.json`
   - `vercel.json`

### Step 2: Deploy on Vercel
1. Go to vercel.com → "Add New Project"
2. Import your `ytautoagent-backend` GitHub repo
3. Click "Deploy" (no changes needed)
4. Wait ~30 seconds → you get a URL like: `https://ytautoagent-backend.vercel.app`

### Step 3: Add YouTube API Key
1. In Vercel dashboard → your project → "Settings" → "Environment Variables"
2. Add:
   - Name: `YOUTUBE_API_KEY`
   - Value: your YouTube Data API v3 key (AIzaSy...)
3. Click "Save" → Go to "Deployments" → "Redeploy"

### Step 4: Test it
Open in browser:
```
https://your-project.vercel.app/api/youtube?action=ping
```
Should show: `{"ok":true,"message":"YTAutoAgent backend is live!"}`

### Step 5: Add URL to YTAutoAgent
Paste your Vercel URL into the YTAutoAgent settings panel.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `?action=ping` | Health check |
| `?action=trending&niche=mystery` | Top trending videos this week |
| `?action=channel&channelId=UC...` | Channel statistics |
| `?action=videostats&videoIds=id1,id2` | Video statistics |

## Free Limits
- Vercel: 100GB bandwidth/month, unlimited requests
- YouTube API: 10,000 units/day (each search = 100 units = ~100 searches/day free)
