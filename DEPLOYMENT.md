# Map Application Deployment Guide

## Overview

| Component            | Deploy To               | Cost |
| --------------------- | ------------------------ | ---- |
| Frontend (Next.js)    | Vercel                   | FREE |
| Backend + C++ Engine  | Azure for Students (VM)  | FREE (no card) |
| Large Data Files      | Git LFS (or scp/rsync as a fallback) | FREE |

Vercel serverless functions were considered for the backend, but the graph data (~715MB) exceeds Vercel's stable 250MB function bundle limit — the only way around that is Vercel's beta "Large Functions" (5GB) feature. Instead, the backend runs as a normal persistent process (Docker Compose, no Kubernetes) on a single VM, which is what the C++ engine's mmap-based design actually wants.

**Why Azure for Students over other clouds**: it's the only major cloud that doesn't require a payment method at signup — verification is done via a school email (or student ID / GitHub Education). It comes with $100 of credit (12 months, renewable annually while you remain a verified student) plus a permanent "always free" B1s VM (1 vCPU/1GB RAM, 750 hrs/month) that needs no credit at all. A VM sized to match what's already been tested for this project (see below) will run comfortably on the credit for a few months; after that, either scale down to the free B1s tier or renew.

**Time-sensitive**: student verification must be *currently valid* to complete Azure's signup flow — if your verification is close to expiring, sign up now rather than later, since the 12-month credit term only starts once you've actually signed up.

---

## Step 1: Push Code (and Data) to GitHub

The large files (`nodes.bin`, `graph.weights`, `graph.targets`) are tracked via **Git LFS** — `git lfs track` has already been set up in this repo (see `.gitattributes`), so a normal `git add`/`commit`/`push` handles them like any other file, just routed through LFS instead of a regular blob. `graph.offset` and `places.bin` are small enough to be plain git files.

```bash
git add .
git commit -m "Deploy setup: Azure VM, Docker Compose, Git LFS for data"
git push origin main
```

This uses about 651MB of GitHub's 10GB/month free LFS bandwidth on the initial push — comfortably within budget even with several redeploys.

---

## Step 2: Deploy Backend to an Azure for Students VM

### 2.1 Sign up and provision the VM

1. Go to [azure.microsoft.com/free/students](https://azure.microsoft.com/en-us/free/students) and verify with your school email (or student ID / GitHub Education if the email isn't accepted). Do this now if your verification window is closing soon.
2. In the [Azure Portal](https://portal.azure.com): **Virtual machines → Create → Azure virtual machine.**
   - Subscription: **Azure for Students**.
   - Resource group: create a new one (e.g. `map-app-rg`).
   - Image: **Ubuntu Server 22.04 LTS**.
   - Size: click **See all sizes** and pick something matching what we've already tested for this project — **Standard_B2s** (2 vCPU / 4GB RAM) is a solid choice and burns the $100 credit slowly. If you want to stay entirely inside the always-free allowance instead (no credit spent at all, indefinitely), use **Standard_B1s** (1 vCPU / 1GB RAM) — but that's tighter than anything validated so far and may need the dataset trimmed down to fit reliably.
   - Authentication: **SSH public key** — paste your public key, or let Azure generate a new key pair for you to download.
   - Under **Inbound port rules**, allow **SSH (22)**, and add rules for **8080** (and **80**/**443** if using Caddy for HTTPS).
   - Create the VM and note its public IP and the username you set (commonly `azureuser`).
3. Azure's stock Ubuntu images don't ship extra host-level firewall rules the way some other clouds do, but double check anyway once you're in:
   ```bash
   sudo ufw status   # should say "inactive" — if it's active, add rules for 8080/80/443
   ```
4. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   ```
   Log out and back in (or run `newgrp docker`) so your user can run `docker` without `sudo`.
5. Install Git LFS so the clone below pulls the actual data, not just pointer files:
   ```bash
   sudo apt-get update && sudo apt-get install -y git-lfs
   git lfs install
   ```

### 2.2 Clone the repo (data included, via Git LFS)

```bash
git clone https://github.com/m-s-sat/map.git
cd map
```

Since Git LFS is installed, this pulls `nodes.bin`, `graph.weights`, and `graph.targets` along with everything else — no separate data-transfer step needed.

**Fallback**, if you'd rather not push the data to GitHub: skip Step 1's data push, clone normally, then copy the files straight from your dev machine instead:
```bash
rsync -avzP data/nodes.bin data/graph.weights data/graph.targets azureuser@<vm-public-ip>:~/map/data/
```

### 2.3 Build and run

```bash
docker compose up -d --build
```

`docker-compose.yml` builds the multi-stage [Dockerfile](Dockerfile) (no `--platform` pin, so it builds natively for whatever architecture the VM is — B-series VMs are x86_64, so this is a standard native build, no emulation needed) and mounts `./data` into the container read-only. Redeploying code later (`git pull && docker compose up -d --build`) never re-pulls the dataset unless it actually changed.

`restart: unless-stopped` in `docker-compose.yml` means the container survives crashes and VM reboots automatically.

Check it came up:
```bash
docker compose logs -f
```
Look for `C++ routing engine ready!`, then `Ctrl+C` to stop following (the container keeps running).

### 2.4 Optional: HTTPS via Caddy

1. Point your domain's DNS **A record** at the VM's public IP (e.g. `api.ms-sat.live` → `<vm-ip>`).
2. Install Caddy natively on the VM (runs on the host, in front of the Docker container which stays on 8080):
   ```bash
   sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt-get update && sudo apt-get install -y caddy
   ```
3. Copy this repo's [Caddyfile](Caddyfile) into place and reload:
   ```bash
   sudo cp Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```
   Caddy auto-provisions and renews the Let's Encrypt certificate with no extra config — your API is now live at `https://api.ms-sat.live`.

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Create Project

1. Go to [vercel.com](https://vercel.com)
2. **Import** your GitHub repo
3. Set **Root Directory** to `frontend`

### 3.2 Environment Variables

```
NEXT_PUBLIC_API_URL=https://api.ms-sat.live
```

(Or `http://<vm-public-ip>:8080` if you're not using a domain/Caddy.)

Only point this at the new backend once you've confirmed it's actually up (`curl` the VM directly first) — flipping it earlier breaks the live frontend if it currently depends on something else still working.

---

## Planning ahead: when the $100 credit runs out

A B2s VM running 24/7 will burn the $100 credit in roughly 3 months. Before that happens, either:
- **Scale down** the same VM to the always-free B1s size (1 vCPU/1GB) in the Azure Portal — no redeploy needed, just resize, though you may need to trim the dataset to fit comfortably in 1GB.
- **Renew** Azure for Students for another 12 months/$100 if you're still a verified student then.
- **Migrate** — everything here is plain Docker Compose, so the same setup drops onto any other VM (Oracle Cloud's Always-Free tier was the other option evaluated, still available as a fallback).

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

Azure VM disk (./data, mounted into the container, populated by `git clone`):
├── nodes.bin
├── graph.offset
├── graph.targets
├── graph.weights
└── places.bin
```

---

## Troubleshooting

### `git clone` is slow or the data files are tiny pointer text files

Git LFS isn't installed/initialized on that machine — run `sudo apt-get install -y git-lfs && git lfs install`, then `git lfs pull` inside the repo to fetch the real content.

### SSH connection refused or times out

- Confirm port 22 is allowed in the VM's Network Security Group (Azure Portal → VM → Networking).
- Use the username you set during VM creation (commonly `azureuser`), not `root` or `ubuntu`.

### Docker build slow or failing on the VM

- B-series Azure VMs are x86_64, so the Dockerfile's lack of a `--platform` pin just means a standard native build — no emulation involved, unlike an ARM target.
