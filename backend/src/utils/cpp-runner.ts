import { execFile } from "child_process";
import path from "path";

export default function runCpp(
    source: number,
    destination: number
): Promise<string> {

    return new Promise((resolve, reject) => {

        const cppPath = path.join(
            __dirname,
            "../../../cpp-engine/src/map.exe"
        );

        const nodesPath = path.join(__dirname, "../../../data/nodes.txt");
        const edgesPath = path.join(__dirname, "../../../data/edges.txt");

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
