import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";

class CppEngineService {
    private process: ChildProcessWithoutNullStreams | null = null;
    private queue: { resolve: (value: any) => void; reject: (reason: any) => void }[] = [];
    private isReady: boolean = false;
    private buffer: string = "";
    private disabled: boolean = false;
    private starting: boolean = false;

    constructor() {
        this.startProcess();
    }

    private startProcess() {
        if (this.disabled || this.starting || this.process) return;

        this.starting = true;
        const isProduction = process.env.NODE_ENV === 'production';

        const prodPath = path.join(process.cwd(), 'cpp-engine/src/map_v2');
        const devPath = path.join(__dirname, "../../../cpp-engine/src/map_v2.exe");

        let cppPath = isProduction ? prodPath : devPath;
        if (!fs.existsSync(cppPath)) {
            cppPath = isProduction ? devPath : prodPath;
        }

        if (!fs.existsSync(cppPath)) {
            console.log("C++ binary not found, routing disabled");
            this.disabled = true;
            this.starting = false;
            return;
        }

        const dataDir = isProduction
            ? path.join(process.cwd(), 'data') + '/'
            : path.join(__dirname, "../../../data") + '/';

        console.log("Starting C++ engine:", cppPath);
        console.log("Data directory:", dataDir);

        try {
            this.process = spawn(cppPath, [dataDir], { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (e) {
            console.error("Failed to start C++ engine:", e);
            this.disabled = true;
            this.starting = false;
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
                        const distance = parseFloat(parts[0]);
                        const nodePath = parts.slice(1).map(Number);
                        request.resolve({ distance, path: nodePath });
                    } else {
                        request.resolve(null);
                    }
                }
            }
        });

        this.process.stderr.on("data", (data) => {
            const msg = data.toString();
            console.log("[CPP-LOG]:", msg.trim());
            if (msg.includes("Ready for queries")) {
                this.isReady = true;
                this.starting = false;
                console.log("C++ routing engine ready!");
            }
        });

        this.process.on("close", (code) => {
            console.log("C++ process exited with code", code);
            this.isReady = false;
            this.process = null;
            this.starting = false;
        });
    }

    public async query(source: number, destination: number): Promise<{ distance: number, path: number[] } | null> {
        if (this.disabled) return null;

        if (!this.process || !this.isReady) {
            await new Promise(r => setTimeout(r, 5000));
            if (!this.isReady) return null;
        }

        return new Promise((resolve) => {
            this.queue.push({ resolve, reject: () => resolve(null) });
            this.process?.stdin?.write(`${source} ${destination}\n`);
            setTimeout(() => resolve(null), 30000);
        });
    }
}

export default new CppEngineService();
