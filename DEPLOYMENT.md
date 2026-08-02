# Map Application Deployment Guide

## Overview

| Component            | Deploy To               | Cost |
| --------------------- | ------------------------ | ---- |
| Frontend (Next.js)    | Vercel                   | FREE |
| Backend + C++ Engine  | Render (free web service) | FREE (no card) |
| Large Data Files      | Git LFS, baked into the Docker image at build time | FREE |

Vercel serverless functions were considered for the backend, but the graph data (~715MB) exceeds Vercel's stable 250MB function bundle limit — the only way around that is Vercel's beta "Large Functions" (5GB) feature. Render's Docker-based web services don't have that bundle-size ceiling, so the same multi-stage [Dockerfile](Dockerfile) that builds the C++ engine + Node backend works there directly.

**The real constraint on Render is RAM, not bundle size**: the free plan gives **512MB** total. This was a genuine concern going in — the full dataset (16.8M nodes, all of India) was originally validated against 2GB+ containers. Testing locally under an actual hard 512MB cgroup limit (`docker run --memory=512m`) found the real bottleneck wasn't the C++ engine's mmap'd data at all — mmap'd read-only pages are reclaimable page cache, not pinned memory, so even a worst-case cross-country query (touching ~6.9M graph nodes) only used ~28MB. The actual problem was `places.controller.ts` doing a full `fs.readFileSync` of all of `nodes.bin` (257MB) into a permanent in-memory Buffer at startup, unlike the other controllers which already streamed via `fs.readSync`. That's been rewritten to stream in chunks the same way — after the fix, idle memory dropped from ~283MB to ~25MB, and stayed flat under repeated heavy queries. `render.yaml` also caps Node's own heap at 200MB as extra headroom, though testing suggests it isn't the tight fit it first appeared to be.

Render's free tier needs no payment method at all, sleeps after 15 minutes of inactivity (30-60s cold start on the next request), and has no persistent disk on the free plan — which is exactly why the data is baked into the image via `COPY data/ ./data/` in the Dockerfile now, instead of a mounted volume.

---

## Step 1: Push Code (and Data) to GitHub

The large files (`nodes.bin`, `graph.weights`, `graph.targets`) are tracked via **Git LFS** — already set up in this repo (see `.gitattributes`), so a normal `git add`/`commit`/`push` handles them like any other file, just routed through LFS instead of a regular blob. `graph.offset` and `places.bin` are small enough to be plain git files.

```bash
git add .
git commit -m "Deploy setup: Render, Docker, Git LFS for data"
git push origin main
```

This uses about 651MB of GitHub's 10GB/month free LFS bandwidth per push — comfortably within budget even with several redeploys.

---

## Step 2: Deploy Backend to Render

### 2.1 Create the service

1. Go to [dashboard.render.com](https://dashboard.render.com), sign up (GitHub login works, no card needed for the free plan), and connect this repo.
2. Render should detect [render.yaml](render.yaml) automatically and offer to create the service from it (a "Blueprint"). If it doesn't pick it up automatically, create a **New → Web Service** manually:
   - Runtime: **Docker**.
   - Dockerfile path: `./Dockerfile`.
   - Instance type: **Free**.
   - Add environment variables `NODE_ENV=production` and `NODE_OPTIONS=--max-old-space-size=200` (already in `render.yaml` if it was picked up automatically).
3. Click **Create Web Service**. The first build compiles the C++ engine, builds the TypeScript backend, and copies in the ~715MB dataset — expect this build to take a while (several minutes) given the image size; subsequent builds reuse Docker's layer cache for anything that didn't change.

### 2.2 Verify it's up

Render gives you a URL like `https://map-backend-xxxx.onrender.com`. Once the build finishes:

```bash
curl https://map-backend-xxxx.onrender.com/
```

Watch the build/deploy logs in the Render dashboard for `C++ routing engine ready!` — if the service crashes shortly after starting, that's the 512MB ceiling being hit; see Troubleshooting below.

### 2.3 Custom domain (optional)

Render supports custom domains + automatic HTTPS directly in the dashboard (**Settings → Custom Domains**) — no separate Caddy/reverse-proxy setup needed here, unlike a raw VM.

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Create Project

1. Go to [vercel.com](https://vercel.com)
2. **Import** your GitHub repo
3. Set **Root Directory** to `frontend`

### 3.2 Environment Variables

```
NEXT_PUBLIC_API_URL=https://map-backend-xxxx.onrender.com
```

(Or your custom domain if you set one up in Step 2.3.)

Only point this at the new backend once you've confirmed it's actually up — flipping it earlier breaks the live frontend if it currently depends on something else still working. Also note the 30-60s cold start after 15 minutes idle: the first request after a quiet period will be slow, not broken — worth a small "waking up the server..." loading state on the frontend if this matters for first impressions.

---

## Troubleshooting

### Service crashes / restarts shortly after a heavy request

Local testing under an actual 512MB cap didn't reproduce this (see above — even worst-case cross-country queries used ~28MB after the places.controller.ts fix), so if it happens on Render specifically, something else is likely different in that environment. Options, roughly in order of effort:
1. Check Render's logs for the actual failure — an OOM kill looks different from a crash/exception, and it's worth confirming which one it actually is before assuming it's memory.
2. Lower `NODE_OPTIONS=--max-old-space-size` further (frees more RAM for the C++ engine, at the cost of less headroom for the Node side).
3. Shrink the dataset to a single region (city/metro) using `cpp-engine/tools/csv_to_graph` on a smaller OSM extract — the most robust fix if memory genuinely is the issue, but real additional work.

### `git clone` is slow or the data files are tiny pointer text files

Whatever machine you're on doesn't have Git LFS installed — run `git lfs install`, then `git lfs pull` inside the repo to fetch the real content instead of pointer files.

### Build times out or fails on Render

The image is large (~715MB of data plus two compiler toolchains in the build stages) — if a build stage times out, check Render's build log for which step failed; the C++ compile (`g++ -O3 ...`) and the two `npm ci` steps are the most resource-intensive parts.

---

## Alternative: a VM instead of Render

Local testing suggests Render's 512MB is workable, not a near-certain problem, but if real-world usage proves otherwise, [Azure for Students](https://azure.microsoft.com/en-us/free/students) (no card, $100/12-month credit, or a permanent free 1GB VM) or [Oracle Cloud's Always-Free tier](https://cloud.oracle.com) (needs a card for identity verification, but 2 OCPU/12GB RAM) both give a real persistent VM with far more headroom, at the cost of manual server setup instead of Render's push-to-deploy flow. Both were evaluated earlier; ask if you want those steps written out again — the same Dockerfile and `docker-compose.yml` (just add back a `./data` volume mount if you don't want data baked into the image on a VM you control directly) work there too.

---

## File Storage Summary

```
GitHub Repository (code + data, data via Git LFS):
├── places.bin      (0.5 MB, plain git)
├── graph.offset    (64 MB, plain git)
├── nodes.bin       (257 MB, Git LFS)
├── graph.weights   (264 MB, Git LFS)
├── graph.targets   (132 MB, Git LFS)
└── source code

Baked into the Docker image at build time (COPY data/ ./data/):
├── nodes.bin
├── graph.offset
├── graph.targets
├── graph.weights
└── places.bin
```
