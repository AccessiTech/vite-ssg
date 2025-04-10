"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = exports.toBuildPath = exports.genEntry = exports.CONFIG = exports.getMetaData = void 0;
exports.genUrls = genUrls;
exports.genStatic = genStatic;
const vite_1 = require("vite");
const plugin_react_swc_1 = __importDefault(require("@vitejs/plugin-react-swc"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const fast_xml_parser_1 = require("fast-xml-parser");
const getMetaData = (text) => {
    const metaData = {};
    const lines = text.split("\n");
    lines.forEach((line) => {
        var _a, _b;
        const key = (_a = line.split(":")[0]) === null || _a === void 0 ? void 0 : _a.replace("<!--", "").trim();
        const value = (_b = line.split(":")[1]) === null || _b === void 0 ? void 0 : _b.replace("-->", "").trim();
        if (key && value) {
            metaData[key] = value;
        }
    });
    return metaData;
};
exports.getMetaData = getMetaData;
// todo: move this to a config file
exports.CONFIG = Object.assign({ urlSrc: "public/rss.xml", dest: "docs", staticPaths: ["/", "/blog"], staticMetaData: ["src/App/meta.ts", "src/pages/Blog/meta.ts"], productionUrlBase: "https://accessi.tech", pathsBuilder: (items) => items.map((item) => {
        var _a;
        const { link } = item;
        const id = ((_a = link.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(".md", "")) || "";
        return `/blog/${id}`; // todo: make this configurable
    }), viteServer: {
        root: node_path_1.default.resolve(process.cwd()),
        plugins: [(0, plugin_react_swc_1.default)()],
        server: { middlewareMode: true, port: 3000, ssr: true },
        appType: "custom",
    }, ssrEntry: "src/server.tsx" }, process.argv);
// todo: make this configurable
function genUrls(config) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const RSS = node_fs_1.default.readFileSync(node_path_1.default.resolve(process.cwd(), config.urlSrc), "utf-8");
        const parser = new fast_xml_parser_1.XMLParser();
        const rssOjb = parser.parse(RSS);
        const items = ((_a = rssOjb.rss.channel.item) === null || _a === void 0 ? void 0 : _a.length)
            ? rssOjb.rss.channel.item
            : [rssOjb.rss.channel.item];
        const urls = ((_b = config.staticPaths) === null || _b === void 0 ? void 0 : _b.concat(config.pathsBuilder(items))) || [];
        return { config, urls };
    });
}
const genEntry = (url) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = ((_a = url.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(".md", "")) || "";
    const fileContent = node_fs_1.default.readFileSync(node_path_1.default.resolve(process.cwd(), "public/data/blog", `${id}.md`), { encoding: "utf-8" });
    const metaData = (0, exports.getMetaData)(fileContent);
    const content = Object.keys(metaData).length
        ? fileContent.substring(fileContent.indexOf("-->") + 3, fileContent.length)
        : fileContent;
    const description = metaData["description"] || "";
    const image = metaData["image"] || "";
    const image_alt = metaData["image_alt"] || "";
    const title = metaData["title"] || content.split("\n")[0].replace("# ", "");
    const date = metaData["date"] || "";
    return {
        loaded: true,
        id,
        title,
        content,
        date,
        description,
        image,
        image_alt,
    };
});
exports.genEntry = genEntry;
function genStatic(_a) {
    return __awaiter(this, arguments, void 0, function* ({ config, urls }) {
        // pre-load the blog entries
        // todo - make this configurable
        const blogEntries = yield Promise.all(urls
            .filter((url) => !config.staticPaths.includes(url))
            .map(exports.genEntry));
        console.log("Blog entries loaded");
        // create the Vite server
        const vite = yield (0, vite_1.createServer)(config.viteServer).catch((err) => {
            console.error(err);
            throw new Error(err);
        });
        console.log("Vite server created");
        // generate the static pages
        const vitePromises = urls.map((url, index) => __awaiter(this, void 0, void 0, function* () {
            // load the server entry for the page
            console.log("Loading Vite module for", url, "...");
            const { render, renderMetadata, dispatchEntry } = yield vite
                .ssrLoadModule(node_path_1.default.resolve(process.cwd(), config.ssrEntry))
                .catch((err) => {
                console.error(err);
                throw new Error(err);
            });
            console.log("Vite loaded module  for ", url);
            // todo - make this configurable
            // dispatch the blog entries to the store
            for (const entry of blogEntries) {
                yield dispatchEntry(entry);
            }
            console.log("Blog entries dispatched to store");
            // load the index.html and render the App
            const toBuildPath = (pathPart) => node_path_1.default.join(config.dest, pathPart);
            const indexHtmlContent = node_fs_1.default
                .readFileSync(toBuildPath("index.html"))
                .toString();
            const urlHtmlMarkup = yield render(url);
            if (!urlHtmlMarkup) {
                const errorStr = `No content rendered for ${url}`;
                console.error(errorStr);
                throw new Error(errorStr);
            }
            // update the index.html with the rendered markup
            let urlHtmlContent = indexHtmlContent.replace('<div id="root"></div>', `<div id="root">${urlHtmlMarkup}</div>`);
            // if ssg:noscript is present, populate the <noscript> tag
            const ssgNoScriptIndex = urlHtmlContent.indexOf("<!-- ssg:noscript -->");
            if (ssgNoScriptIndex !== -1) {
                urlHtmlContent = urlHtmlContent.replace("<!-- ssg:noscript -->", urlHtmlMarkup);
            }
            // get the page metadata
            let metadata;
            const isStatic = typeof config.staticMetaData[index] !== "undefined";
            if (isStatic) {
                // load the metadata from the static ts file
                const metadataPath = node_path_1.default.resolve(process.cwd(), config.staticMetaData[index]);
                metadata = (yield Promise.resolve(`${metadataPath}`).then(s => __importStar(require(s)))).default;
            }
            else {
                // load the metadata from the blog post markdown file
                const fileContent = node_fs_1.default.readFileSync(node_path_1.default.resolve(process.cwd(), "public/data/blog", `${url.split("/").pop()}.md`), { encoding: "utf-8" });
                metadata = (0, exports.getMetaData)(fileContent);
                metadata.canonical = `${config.productionUrlBase}${url}`;
            }
            // define the existing head content of index.html
            const headEnd = "</head>";
            const headEndIndex = urlHtmlContent.indexOf(headEnd);
            const headString = urlHtmlContent.slice(0, headEndIndex).replace(/\n/g, "");
            const headStrings = headString
                .replace(/(?<=>)\s+(?=<)/g, "")
                .replace(/></g, ">^<")
                .split("^");
            // render the metadata to a string
            const metadataString = (yield renderMetadata(metadata))
                .replace("<div>", "")
                .replace("</div>", "");
            // parse the metadata string into a library
            const metaTagStrings = metadataString.replace(/></g, ">^<").split("^");
            const metaTagLib = metaTagStrings.reduce((acc, metaTag) => {
                if (!metaTag)
                    return acc;
                const tagType = (metaTag.match(/<(\w+)/) || [])[1];
                if (tagType === "title") {
                    return Object.assign(Object.assign({}, acc), { title: metaTag });
                }
                if (tagType === "link") {
                    return Object.assign(Object.assign({}, acc), { canonical: metaTag });
                }
                const tagProperty = (metaTag.match(/(\w+)=/) || [])[1];
                const tagPropertyValue = (metaTag.match(/"([^"]+)"/) || [])[1];
                if (!tagProperty || !tagPropertyValue)
                    return acc;
                return Object.assign(Object.assign({}, acc), { [tagPropertyValue]: metaTag });
            }, {});
            // Merge new metadata tags onto existing head metadata
            const newHeadStrings = [];
            for (const line of headStrings) {
                if (line.includes("<title>")) {
                    newHeadStrings.push(metaTagLib.title);
                }
                else if (line.includes(`<link rel="canonical"`)) {
                    newHeadStrings.push(metaTagLib.canonical);
                }
                else if (line.includes("<meta")) {
                    const tagProperty = (line.match(/(\w+)=/) || [])[1];
                    const tagPropertyValue = (line.match(/"([^"]+)"/) || [])[1];
                    if (!tagProperty || !tagPropertyValue) {
                        newHeadStrings.push(line);
                        continue;
                    }
                    const newTag = metaTagLib[tagPropertyValue];
                    newHeadStrings.push(newTag || line);
                }
                else {
                    newHeadStrings.push(line);
                }
            }
            // determine which meta tags are not in newHeadStrings and add them to the end
            const unusedMetaTags = Object.keys(metaTagLib).filter((key) => !newHeadStrings.join("").includes(key));
            for (const key of unusedMetaTags) {
                newHeadStrings.push(metaTagLib[key]);
            }
            // rejoin the head strings and the rest of the html content
            const newHeadString = newHeadStrings.join("\n");
            const urlHtmlContentWithMetadata = `${newHeadString}${urlHtmlContent.slice(headEndIndex)}`;
            // write the new html content to the build directory
            // if subdirectory doesn't exist, create it
            const subDir = node_path_1.default.dirname(url);
            const subDirPath = node_path_1.default.join(config.dest, subDir);
            if (!node_fs_1.default.existsSync(subDirPath)) {
                node_fs_1.default.mkdirSync(subDirPath, { recursive: true });
            }
            // write the html file to the build directory
            node_fs_1.default.writeFileSync(toBuildPath(url + ".html"), urlHtmlContentWithMetadata);
            console.log(`Static page generated for ${url}`);
        }));
        // Execute all the promises and close the Vite server
        yield Promise.all(vitePromises)
            .then(() => {
            console.log("All static pages generated");
            return vite.close();
        })
            .catch((e) => {
            console.error("Error generating static pages: ", e);
            throw new Error(e);
        });
        if (config.replaceIndexHtml) {
            // remove original index.html file and rename .html to index.html
            node_fs_1.default.renameSync((0, exports.toBuildPath)("index.html", config), (0, exports.toBuildPath)("_.html", config));
            node_fs_1.default.renameSync((0, exports.toBuildPath)(".html", config), (0, exports.toBuildPath)("index.html", config));
        }
    });
}
const toBuildPath = (file, config) => node_path_1.default.resolve(process.cwd(), config.dest, file);
exports.toBuildPath = toBuildPath;
const generate = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const configPathTs = node_path_1.default.resolve(process.cwd(), "ssg.config.ts");
    const configPathJs = node_path_1.default.resolve(process.cwd(), "ssg.config.js");
    // check if the config file exists
    const configTsExists = node_fs_1.default.existsSync(configPathTs);
    const configJsExists = node_fs_1.default.existsSync(configPathJs);
    let configuration = config || exports.CONFIG;
    if (configTsExists) {
        configuration = yield Promise.resolve(`${configPathTs}`).then(s => __importStar(require(s)));
        console.log("Configuration loaded from ts: ", configuration);
    }
    else if (configJsExists) {
        configuration = (yield Promise.resolve(`${configPathJs}`).then(s => __importStar(require(s))));
        console.log("Configuration loaded from js: ", configuration);
    }
    if (!configuration) {
        console.error("No configuration found");
        process.exit(1);
    }
    try {
        const urlsData = yield genUrls(configuration);
        yield genStatic(urlsData);
    }
    catch (err) {
        console.error("Error generating static pages: ", err);
        process.exit(1);
    }
});
exports.generate = generate;
exports.default = exports.generate;
//# sourceMappingURL=index.js.map