import { mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv)).help("h").alias("h", "help").options({
    outDir: { type: "string", describe: "specify output folder", default: "." }
}).parseSync();

const folders = argv._.map((s) => `${s}`);
const outDir = argv.outDir;


function getHtmlPaths(folder: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(folder, { withFileTypes: true }).then((files) => {
            const basePaths: (Promise<string[]> | string)[] = [];
            files.forEach((dirent) => {
                let filePath = path.join(folder, dirent.name);
                if (dirent.isDirectory()) {
                    basePaths.push(getHtmlPaths(filePath));
                } else if (dirent.isFile() && dirent.name.endsWith(".html")) {
                    basePaths.push(filePath);
                }
            });
            resolve(Promise.all(basePaths).then((paths) => paths.flat()));
        });
    });
}

const INDENT = "  " as const;
function indent(content: Buffer): Buffer {
    const lines = content.toString().split("\n").map((l) => INDENT + l);
    return Buffer.from(lines.join("\n"));
}

folders.forEach((folder) => {
    getHtmlPaths(folder).then((htmlPaths) => {
        const baseFiles = htmlPaths.filter((p) => !path.parse(p).name.includes("."));
        baseFiles.forEach((baseFile) => {
            const baseName = path.parse(baseFile).name;
            const related = htmlPaths.filter((p) => path.parse(p).name.startsWith(`${baseName}.`));
            
            const relatedByType = related.reduce((memo, p) => {
                const type = path.parse(p).name.split(".").pop() as string;
                return {
                    ...memo,
                    [type]: p
                }
            }, {} as { [type: string]: string });

            const outFile = path.join(
                outDir,
                path.relative(folder, baseFile)
            );

            // Generate combined file
            console.log(`Generating file ${outFile} from ${baseFile} and`, relatedByType);
            mkdirSync(path.parse(outFile).dir, { recursive: true });
            return fs.open(outFile, "w").then((fh) => {
                return new Promise<fs.FileHandle>((resolve, reject) => {
                    Object.entries(relatedByType).map(async ([type, subfile]) => {
                        await fs.readFile(subfile).then(async (content) => {
                            await fh.write(`<script type="text/x-red" data-${type}-name="${baseName}">\n`).then(() => {
                                return fh.write(indent(content));
                            }).then(() => {
                                return fh.write("\n</script>\n");
                            });
                        });
                        resolve(fh);
                    });
                })
            }).then(async (fh) => {
                await fs.readFile(baseFile).then(async (content) => {
                    fh.write(content)
                });
                return fh;
            })
        })
    })
})