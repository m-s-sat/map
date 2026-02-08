import { execFile } from "child_process";
import path from "path";

export default function runCpp(
    source: number,
    destination: number
): Promise<string> {

    return new Promise((resolve, reject) => {
        const isProduction = process.env.NODE_ENV === 'production';
        let cppPath: string;
        let nodesPath: string;
        let edgesPath: string;

        if (isProduction) {
            cppPath = path.join(process.cwd(), 'cpp-engine/src/map_v2');
            nodesPath = path.join(process.cwd(), 'data/nodes.txt');
            edgesPath = path.join(process.cwd(), 'data/edges.txt');
        } else {
            cppPath = path.join(__dirname, "../../../cpp-engine/src/map.exe");
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
