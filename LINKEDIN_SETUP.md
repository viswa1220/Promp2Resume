# LinkedIn posting — setup (one-time, ~10 min, free)

The app can draft a post with AI and publish it to your LinkedIn with one button.
Drafting works out of the box; **posting** needs a free LinkedIn app you create.

## 1. Create the LinkedIn app
1. Go to https://www.linkedin.com/developers/apps → **Create app**.
2. Fill in name, associate a LinkedIn **Page** (you can make a throwaway page if needed), upload a logo, agree, create.

## 2. Add the products
On the app's **Products** tab, request (both are self-serve / instant for personal posting):
- **Sign In with LinkedIn using OpenID Connect**
- **Share on LinkedIn**

## 3. Set the redirect URL
On the **Auth** tab → **Authorized redirect URLs for your app**, add EXACTLY:
- Local: `http://localhost:4000/api/linkedin/callback`
- Production: `https://prompt2resume-api.onrender.com/api/linkedin/callback`

(Use your real API host. It must match `LINKEDIN_REDIRECT_URI` character-for-character.)

## 4. Copy credentials → env
From the **Auth** tab copy the **Client ID** and **Client Secret**, then set on the
server (Render → Environment, or local `backend/.env`):

```
LINKEDIN_CLIENT_ID=xxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxx
LINKEDIN_REDIRECT_URI=https://prompt2resume-api.onrender.com/api/linkedin/callback
```

Make sure `FRONTEND_URL` is also set (used to send you back to the app after auth).

## 5. Use it
1. Redeploy the backend (so the env + new `linkedin*` DB columns apply — `npm run setup` runs `prisma db push`).
2. In the app open **LinkedIn** in the nav → **Connect LinkedIn** → authorize.
3. **Generate post** → tweak the text → **Post to LinkedIn**. Done.

## Notes & limits
- **Scopes used:** `openid profile w_member_social` (post to *your own* profile).
- **Token life:** ~60 days. When it expires the app asks you to reconnect.
- **Rate limit:** LinkedIn allows ~100 calls/day per member — plenty for posting.
- **Text only for now.** Posting an image requires LinkedIn's asset-upload flow
  (a follow-up). The AI can still use a photo description to write the caption.
- **Company Pages** need LinkedIn's Community Management API, which is only granted
  to registered legal entities — not covered here.
