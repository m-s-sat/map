import { execFile } from "child_process";
import path from "path";

export default function runCpp(
    source: number,
    destination: number
): Promise<string> {

    return new Promise((resolve, reject) => {
        const isProduction = process.env.NODE_ENV === 'production';
        const fs = require('fs');

        let cppPath: string;
        let nodesPath: string;
        let edgesPath: string;

        const prodPath = path.join(process.cwd(), 'cpp-engine/src/map_v2');
        const devPath = path.join(__dirname, "../../../cpp-engine/src/map.exe");

        if (fs.existsSync(prodPath)) {
            cppPath = prodPath;
            nodesPath = path.join(process.cwd(), 'data/nodes.txt');
            edgesPath = path.join(process.cwd(), 'data/edges.txt');
        } else {
            cppPath = devPath;
            nodesPath = path.join(__dirname, "../../../data/nodes.txt");
            edgesPath = path.join(__dirname, "../../../data/edges.txt");
        }

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
