import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

class CppEngineService {
    private process: ChildProcessWithoutNullStreams | null = null;
    private queue: { resolve: (value: any) => void; reject: (reason: any) => void }[] = [];
    private isReady: boolean = false;

    private buffer: string = "";

    constructor() {
        this.startProcess();
    }

    private startProcess() {
        const cppPath = path.join(__dirname, "../../../cpp-engine/src/map_v2.exe");
        const dataDir = path.join(__dirname, "../../../data") + path.sep;

        console.log("Spawning C++ engine:", cppPath, "with data from", dataDir);
        this.process = spawn(cppPath, [dataDir]);

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
                            const path = parts.slice(1).map(Number);
                            request.resolve({ distance, path });
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
            }
        });

        this.process.on("close", (code) => {
            console.log(`C++ process exited with code ${code}`);
            this.isReady = false;
            this.process = null;
        });
    }

    public async query(source: number, destination: number): Promise<{ distance: number, path: number[] } | null> {
        if (!this.process) {
            this.startProcess();
        }
        if (!this.isReady) {
            await new Promise(resolve => setTimeout(resolve, 1000));

        }

        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
            if (this.process?.stdin) {
                this.process.stdin.write(`${source} ${destination}\n`);
            } else {
                reject("Process not started");
            }
        });
    }
}

export default new CppEngineService();
