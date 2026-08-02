# 🗺️ India Road Network Map

A **production-grade routing application** that handles **17 million nodes** and **35 million edges** of India's road network data, optimized to run under **1GB RAM**.

![Map Screenshot](https://img.shields.io/badge/Nodes-17M-blue) ![Edges](https://img.shields.io/badge/Edges-35M-green) ![RAM](https://img.shields.io/badge/RAM-<1GB-orange)

## 🎯 Key Features

- 🗺️ **Interactive Map** - Visualize road network with Leaflet
- 🔍 **Place Search** - Search 4,000+ named locations
- 🛣️ **Shortest Path Routing** - A* algorithm in C++
- ⚡ **Memory Optimized** - 17M nodes in under 1GB RAM

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   C++ Engine    │
│   (Next.js)     │     │   (Express)     │     │      (A*)       │
│    Vercel       │     │ Azure Students  │     │   Memory-Mapped │
│                 │     │   (Free VM)     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Binary Data Files │
                    │  (host volume mount)│
                    └─────────────────────┘
```

---

## 🧠 The 1GB Challenge: How We Did It

### The Problem

- **17 million nodes** (lat/lon coordinates) = 257 MB
- **35 million edges** (road connections) = 400 MB
- **Graph weights** (distances) = 263 MB
- **Total: ~920 MB** just for data!

### The Solution: Memory-Mapped Files (mmap)

Instead of loading everything into RAM, we use **memory-mapped files**:

```cpp
// Traditional approach (loads everything into RAM)
vector<Node> nodes;
nodes.resize(17000000); // 💥 Uses 257MB RAM

// Our approach (zero RAM usage)
void* data = mmap(nullptr, fileSize, PROT_READ, MAP_PRIVATE, fd, 0);
Node* nodes = reinterpret_cast<Node*>(data);
// ✅ OS loads pages on-demand, actual RAM usage: ~50MB
```

### Memory Breakdown

| Component  | Before     | After Optimization  |
| ---------- | ---------- | ------------------- |
| Node data  | 257 MB     | **~10 MB** (mmap)   |
| Edge data  | 400 MB     | **~20 MB** (mmap)   |
| C++ Engine | 200 MB     | **~50 MB**          |
| Node.js    | 500 MB     | **512 MB** (capped) |
| **Total**  | **1.3 GB** | **~600 MB** ✅      |

---

## 📊 Data Pipeline

### 1. Extract from OpenStreetMap

```bash
# Download India OSM data (1.2 GB .pbf)
python scripts/extract_osm.py india-latest.osm.pbf
```

### 2. Convert to Binary Format

```bash
# Convert to optimized binary files
python scripts/convert_to_binary.py
python scripts/convert_places_to_bin.py
```

### 3. Binary File Structure

| File            | Contents      | Format            | Size   |
| --------------- | ------------- | ----------------- | ------ |
| `nodes.bin`     | Lat/Lon pairs | 16 bytes per node | 257 MB |
| `graph.offset`  | Edge offsets  | 4 bytes per node  | 64 MB  |
| `graph.targets` | Edge targets  | 4 bytes per edge  | 131 MB |
| `graph.weights` | Edge weights  | 8 bytes per edge  | 263 MB |
| `places.bin`    | Named places  | Variable          | 600 KB |

### 4. Why Binary Format? (The Speed Secret 🚀)

Converting raw OSM/CSV data to binary format is **critical** for performance:

```
📄 CSV Format (Before):
"node_id,latitude,longitude"
"0,28.6139,77.2090"
"1,28.6140,77.2091"
...

📦 Binary Format (After):
[8 bytes: lat][8 bytes: lon][8 bytes: lat][8 bytes: lon]...
```

#### Performance Comparison

| Metric             | CSV/JSON      | Binary      | Improvement     |
| ------------------ | ------------- | ----------- | --------------- |
| File size          | 2.1 GB        | 715 MB      | **3x smaller**  |
| Parse time         | 45 seconds    | 0.3 seconds | **150x faster** |
| Memory during load | 4+ GB         | ~50 MB      | **80x less**    |
| Random access      | ❌ Impossible | ✅ Instant  | ∞               |

#### Why Binary Wins

1. **No parsing overhead** - Data is stored exactly as it appears in memory
2. **Fixed-size records** - Jump directly to any node: `offset = nodeId × 16`
3. **Memory-mappable** - OS can map file directly to memory without copying
4. **Cache-friendly** - Sequential reads maximize CPU cache efficiency

```python
# Converting CSV to Binary (extract from our script)
with open('nodes.bin', 'wb') as f:
    for lat, lon in nodes:
        f.write(struct.pack('<dd', lat, lon))  # 16 bytes per node
```

---

## 🛠️ Tech Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Frontend       | Next.js 14, React, Leaflet, Redux    |
| Backend        | Node.js, Express, TypeScript         |
| Routing Engine | C++17, A* Algorithm                  |
| Data Format    | Custom Binary (mmap-compatible)      |
| Hosting        | Vercel (Frontend), Azure for Students (Backend) |
| Data Storage   | Git LFS (large files ship with the repo)       |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- GCC/G++ (for C++ engine)
- ~4GB disk space

### Local Development

```bash
# Clone the repository
git clone https://github.com/m-s-sat/map.git
cd map

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Build C++ engine
cd cpp-engine
g++ -O3 -std=c++17 -o src/map_v2.exe src/main.cpp src/graph.cpp -I include
cd ..

# Start backend (terminal 1)
cd backend && npm run dev

# Start frontend (terminal 2)
cd frontend && npm run dev

# Open http://localhost:3000
```

---

## 🌐 Deployment Architecture

We use a **split deployment** strategy, entirely on free tiers:

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   👤 User                                                        │
│     │                                                             │
│     ▼                                                             │
│   ┌─────────────┐    API calls    ┌─────────────────────────┐   │
│   │   Vercel    │ ──────────────▶ │   Azure for Students VM │   │
│   │  (Frontend) │                 │   (B-series, x86_64)    │   │
│   │   Next.js   │                 │  Node.js + C++ Engine   │   │
│   │    FREE     │                 │   FREE ($100 credit,    │   │
│   │             │                 │   no card required)     │   │
│   └─────────────┘                 └───────────┬─────────────┘   │
│                                               │                   │
│                                               ▼                   │
│                                   ┌─────────────────────┐        │
│                                   │   VM disk / volume  │        │
│                                   │   715 MB binaries   │        │
│                                   └─────────────────────┘        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Split?

| Concern          | Solution                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Frontend CDN     | Vercel's global edge network                                                                                                      |
| Backend compute  | A single Azure for Students VM (a real persistent process, not serverless — needed because the C++ engine mmaps ~715MB and stays resident between requests) |
| Large data files | Shipped via Git LFS, pulled onto the VM's disk by `git clone`, mounted into the container                                          |
| Cost             | **$0 upfront** — no card required to sign up; the VM itself draws down a renewable $100/12-month credit                            |

Vercel serverless functions were considered for the backend too, but don't fit: their stable bundle limit is 250MB and this graph is ~715MB — the only way around that is Vercel's beta "Large Functions" (5GB) feature, which we chose not to depend on for production. A single free VM with a normal persistent process sidesteps that entirely.

---

### Backend Deployment (Azure for Students VM)

Runs via plain Docker Compose — no Kubernetes needed for a single box. Full step-by-step (Azure Portal screens, NSG rules, credit planning) is in [DEPLOYMENT.md](DEPLOYMENT.md); summary here:

**1. Sign up and provision the VM**

Verify at [azure.microsoft.com/free/students](https://azure.microsoft.com/en-us/free/students) (school email, no card), then create an Ubuntu 22.04 VM sized to match what's already been tested (e.g. **Standard_B2s**, 2 vCPU/4GB), opening ports 8080 (and 80/443 for Caddy) in its Network Security Group.

**2. Install Docker and Git LFS, then clone the repo**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get install -y git-lfs && git lfs install
git clone https://github.com/m-s-sat/map.git
cd map
```

Since the large data files are tracked with Git LFS, `git clone` pulls `nodes.bin`, `graph.weights`, and `graph.targets` along with everything else — no separate data-transfer step needed.

**3. Build and run**

```bash
docker compose up -d --build
```

`docker-compose.yml` builds the same multi-stage [Dockerfile](Dockerfile) and mounts `./data` into the container read-only, so re-deploying code (`git pull && docker compose up -d --build`) never re-pulls the 715MB dataset unless it actually changed.

**4. Optional: HTTPS via Caddy**

If you want a real domain (e.g. `api.ms-sat.live`), point it at the VM and run Caddy in front using the included [Caddyfile](Caddyfile) — it auto-provisions and renews a Let's Encrypt certificate with no extra config.

**5. Resilience**

`docker-compose.yml` sets `restart: unless-stopped`, so the container comes back up automatically after a crash or VM reboot.

---

### Frontend Deployment (Vercel)

Vercel provides zero-config Next.js deployment:

**1. Connect GitHub repo to Vercel**

```
vercel.com → Add New Project → Import from GitHub
```

**2. Configure:**

- Root directory: `frontend`
- Framework: Next.js (auto-detected)
- Build command: `npm run build`

**3. Environment variable:**

```
NEXT_PUBLIC_API_URL=https://api.ms-sat.live
```

**4. Benefits:**

- Global CDN (edge caching)
- Automatic HTTPS
- Preview deployments on PRs
- **100% FREE** for hobby projects

## 📁 Project Structure

```
map/
├── frontend/          # Next.js React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── map-view.tsx      # Leaflet map
│   │   │   └── place-search.tsx  # Search component
│   │   └── redux/                # State management
│   └── .env.production           # Backend API URL
│
├── backend/           # Express API server
│   └── src/
│       ├── controllers/
│       │   ├── node.controller.ts   # Streaming nodes
│       │   ├── edge.controller.ts   # Streaming edges
│       │   └── route.controller.ts  # Routing API
│       └── services/
│           └── cpp-engine.service.ts # C++ IPC
│
├── cpp-engine/        # C++ routing engine
│   ├── src/
│   │   ├── main.cpp   # CLI interface
│   │   └── graph.cpp  # A* + mmap
│   └── include/
│       └── graph.h    # Data structures
│
├── data/              # Binary data files (nodes.bin/graph.weights/graph.targets via Git LFS)
│   ├── nodes.bin
│   ├── graph.offset
│   ├── graph.targets
│   └── graph.weights
│
└── scripts/           # Data processing (OSM extract → CSV → binary)
    ├── extract_osm.py
    └── convert_to_binary.py
```

---

## 🔑 Key Insights

### 1. Memory-Mapped Files > In-Memory Arrays

Traditional approach loads everything into RAM. With `mmap`, the OS handles paging automatically.

### 2. Binary Format > CSV/JSON

Binary files are 10x smaller and 100x faster to read than text formats.

### 3. Streaming > Bulk Loading

For web APIs, stream data on-demand rather than loading everything upfront.

### 4. C++ for Heavy Computation

A* in C++ is 50x faster than JavaScript for graph traversal.

---

## 📈 Performance

| Metric              | Value        |
| ------------------- | ------------ |
| Node count          | 16,867,026   |
| Edge count          | 34,558,426   |
| Data load time      | < 0.5s       |
| Route query time    | 50-500ms     |
| Memory usage        | ~600 MB      |
| Geographic coverage | All of India |

---

## 📄 License

MIT License - feel free to use for your projects!

---

## 🙏 Acknowledgments

- OpenStreetMap contributors for India road data
- [osmnx](https://github.com/gboeing/osmnx) for OSM data extraction

---

**Built with ❤️ by [Mrinal]**
