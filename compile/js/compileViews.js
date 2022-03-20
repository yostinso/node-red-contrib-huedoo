"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv)).help("h").alias("h", "help").options({
    outDir: { type: "string", describe: "specify output folder", default: "." }
}).parseSync();
const folders = argv._.map((s) => `${s}`);
const outDir = argv.outDir;
function getHtmlPaths(folder) {
    return new Promise((resolve, reject) => {
        promises_1.default.readdir(folder, { withFileTypes: true }).then((files) => {
            const basePaths = [];
            files.forEach((dirent) => {
                let filePath = path_1.default.join(folder, dirent.name);
                if (dirent.isDirectory()) {
                    basePaths.push(getHtmlPaths(filePath));
                }
                else if (dirent.isFile() && dirent.name.endsWith(".html")) {
                    basePaths.push(filePath);
                }
            });
            resolve(Promise.all(basePaths).then((paths) => paths.flat()));
        });
    });
}
const INDENT = "  ";
function indent(content) {
    const lines = content.toString().split("\n").map((l) => INDENT + l);
    return Buffer.from(lines.join("\n"));
}
folders.forEach((folder) => {
    getHtmlPaths(folder).then((htmlPaths) => {
        const baseFiles = htmlPaths.filter((p) => !path_1.default.parse(p).name.includes("."));
        baseFiles.forEach((baseFile) => {
            const baseName = path_1.default.parse(baseFile).name;
            const related = htmlPaths.filter((p) => path_1.default.parse(p).name.startsWith(`${baseName}.`));
            const relatedByType = related.reduce((memo, p) => {
                const type = path_1.default.parse(p).name.split(".").pop();
                return {
                    ...memo,
                    [type]: p
                };
            }, {});
            const outFile = path_1.default.join(outDir, path_1.default.relative(folder, baseFile));
            // Generate combined file
            console.log(`Generating file ${outFile} from ${baseFile} and`, relatedByType);
            const dirName = path_1.default.parse(outFile).dir;
            (0, fs_1.mkdirSync)(path_1.default.parse(outFile).dir, { recursive: true });
            return promises_1.default.open(outFile, "w").then((fh) => {
                return new Promise((resolve, reject) => {
                    Object.entries(relatedByType).map(async ([type, subfile]) => {
                        await promises_1.default.readFile(subfile).then(async (content) => {
                            await fh.write(`<script type="text/x-red" data-${type}-name="${baseName}">\n`).then(() => {
                                return fh.write(indent(content));
                            }).then(() => {
                                return fh.write("\n</script>\n");
                            });
                        });
                        resolve(fh);
                    });
                });
            }).then(async (fh) => {
                await promises_1.default.readFile(baseFile).then(async (content) => {
                    fh.write(content);
                });
                return fh;
            });
        });
    });
});
