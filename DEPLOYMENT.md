# Map Application Deployment Guide

## Overview

| Component            | Deploy To | Cost                 |
| -------------------- | --------- | -------------------- |
| Frontend (Next.js)   | Vercel    | FREE                 |
| Backend + C++ Engine | Railway   | FREE (500 hrs/month) |
| Large Data Files     | AWS S3    | Pay per use          |

---

## Step 1: S3 Bucket Setup (Already Done ✅)

Your data files are already on S3. Make sure:

1. Bucket has **public read access** enabled, OR
2. You're using pre-signed URLs

### S3 URL Format

```
https://your-bucket-name.s3.region.amazonaws.com/
```

---

## Step 2: Push Code to GitHub

### Files to Commit

The `.gitignore` excludes large files. You CAN commit:

- All source code
- `data/places.bin` (0.5 MB)
- `data/graph.offset` (64 MB)

### Push

```bash
git add .
git commit -m "Initial deployment setup"
git push origin main
```

---

## Step 3: Deploy Backend to Railway

### 3.1 Create Project

1. Go to [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Select your repository

### 3.2 Set Build Arguments

In Railway → Settings → Build:

```
S3_BUCKET_URL=https://your-bucket.s3.amazonaws.com
```

### 3.3 Set Environment Variables

```
NODE_ENV=production
PORT=8080
```

### 3.4 Deploy

Railway will:

1. Build Docker image
2. Download data files from S3
3. Compile C++ engine for Linux
4. Start the server

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Create Project

1. Go to [vercel.com](https://vercel.com)
2. **Import** your GitHub repo
3. Set **Root Directory** to `frontend`

### 4.2 Environment Variables

```
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

---

## File Storage Summary

```
GitHub Repository:
├── places.bin      (0.5 MB) ✅
├── graph.offset    (64 MB)  ✅
└── source code     ✅

AWS S3 Bucket:
├── nodes.bin       (257 MB)
├── graph.weights   (264 MB)
├── graph.targets   (132 MB)
├── nodes.txt       (525 MB)
└── edges.txt       (306 MB)
```

---

## Troubleshooting

### S3 Access Denied

- Check bucket policy allows public read
- Or use pre-signed URLs with expiry

### Railway build timeout

- Large file downloads may take time
- Consider using Railway persistent volumes instead

### "File too large" on git push

```bash
git rm --cached data/nodes.bin data/graph.weights data/graph.targets
git commit -m "Remove large files"
```
