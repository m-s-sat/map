import { execFile } from "child_process";
import path from "path";
import fs from "fs";

export default function runCpp(
    source: number,
    destination: number
): Promise<string> {

    return new Promise((resolve, reject) => {
        const isProduction = process.env.NODE_ENV === 'production';

        let cppPath: string;
        const prodPath = path.join(process.cwd(), 'cpp-engine/src/map_v2');
        const devPath = path.join(__dirname, "../../../cpp-engine/src/map.exe");

        if (fs.existsSync(prodPath)) {
            cppPath = prodPath;
        } else {
            cppPath = devPath;
        }

        const dataDir = isProduction
            ? path.join(process.cwd(), 'data')
            : path.join(__dirname, "../../../data");

        const nodesPath = path.join(dataDir, "nodes.txt");
        const edgesPath = path.join(dataDir, "edges.txt");

        execFile(
            cppPath,
            [nodesPath, edgesPath, source.toString(), destination.toString()],
            (error, stdout) => {

                if (error) {
                    reject(error);
                    return;
                }

                resolve(stdout);
            }
        );
    });
}
