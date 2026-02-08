import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

class CppEngineService {
    private process: ChildProcessWithoutNullStreams | null = null;
    private queue: { resolve: (value: any) => void; reject: (reason: any) => void }[] = [];
    private isReady: boolean = false;
    private buffer: string = "";
    private restartAttempts: number = 0;
    private maxRestarts: number = 3;
    private disabled: boolean = false;

    constructor() {
        this.startProcess();
    }

    private startProcess() {
        if (this.disabled) {
            console.log("C++ engine is disabled due to repeated failures");
            return;
        }

        const fs = require('fs');
        const isProduction = process.env.NODE_ENV === 'production';

        let cppPath: string;

        const prodPath = path.join(process.cwd(), 'cpp-engine/src/map_v2');
        const devPath = path.join(__dirname, "../../../cpp-engine/src/map_v2.exe");

        if (fs.existsSync(prodPath)) {
            console.log("Using production C++ path");
            cppPath = prodPath;
        } else {
            console.log("Using development C++ path");
            cppPath = devPath;
        }

        const dataDir = isProduction
            ? path.join(process.cwd(), 'data') + path.sep
            : path.join(__dirname, "../../../data") + path.sep;

        console.log("Spawning C++ engine:", cppPath, "with data from", dataDir);

        try {
            this.process = spawn(cppPath, [dataDir], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (e) {
            console.error("Failed to spawn C++ engine:", e);
            this.disabled = true;
            return;
        }

        this.process.stdout.on("data", (data) => {
            this.buffer += data.toString();

            const lines = this.buffer.split("\n");
            this.buffer = lines.pop() || "";

            for (const line of lines) {
                const request = this.queue.shift();
                if (request) {
                    if (line.trim()) {
                        const parts = line.trim().split(" ");
                        if (parts.length > 0) {
                            const distance = parseFloat(parts[0]);
                            const nodePath = parts.slice(1).map(Number);
                            request.resolve({ distance, path: nodePath });
                        } else {
                            request.resolve(null);
                        }
                    } else {
                        request.resolve(null);
                    }
                }
            }
        });

        this.process.stderr.on("data", (data) => {
            const msg = data.toString();
            console.log("[CPP-LOG]:", msg);
            if (msg.includes("Ready for queries")) {
                this.isReady = true;
                this.restartAttempts = 0;
            }
        });

        this.process.on("error", (err) => {
            console.error("C++ process error:", err);
        });

        this.process.on("close", (code) => {
            console.log(`C++ process exited with code ${code}`);
            this.isReady = false;
            this.process = null;

            while (this.queue.length > 0) {
                const req = this.queue.shift();
                if (req) req.resolve(null);
            }

            this.restartAttempts++;
            if (this.restartAttempts >= this.maxRestarts) {
                console.log(`C++ engine disabled after ${this.maxRestarts} failed restart attempts. Routing unavailable.`);
                this.disabled = true;
            } else {
                console.log(`Restarting C++ engine (attempt ${this.restartAttempts}/${this.maxRestarts})...`);
                setTimeout(() => this.startProcess(), 3000);
            }
        });
    }

    public async query(source: number, destination: number): Promise<{ distance: number, path: number[] } | null> {
        if (this.disabled) {
            return null;
        }

        if (!this.process) {
            this.startProcess();
            if (this.disabled) return null;
        }

        if (!this.isReady) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (!this.isReady) return null;
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
            if (this.process?.stdin) {
                this.process.stdin.write(`${source} ${destination}\n`);
            } else {
                resolve(null);
            }
        });
    }
}

export default new CppEngineService();
