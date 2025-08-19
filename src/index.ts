import { createServer, ServerOptions, UserConfig, ViteDevServer } from "vite";
import reactPlugin from "@vitejs/plugin-react-swc";
import path from "node:path";
import fs from "node:fs";
import { XMLParser } from "fast-xml-parser";



export interface ViteServerProps extends UserConfig {}

export interface ConfigProps {
  urlSrc: string;
  dest: string;
  staticPaths: string[];
  staticMetaData: string[];
  productionUrlBase: string;
  pathsBuilder: (items: any[]) => string[];
  viteServer: ViteServerProps;
  ssrEntry: string;
  replaceIndexHtml?: boolean;
}

// todo: move this to a config file
export const CONFIG: ConfigProps = {
  urlSrc: "public/rss.xml",
  dest: "docs",
  staticPaths: ["/", "/blog"],
  staticMetaData: ["src/App/meta.ts", "src/pages/Blog/meta.ts"],
  productionUrlBase: "https://accessi.tech",
  pathsBuilder: (items) =>
    items.map((item) => {
      const { link } = item;
      const id = link.split("/").pop()?.replace(".md", "") || "";
      return `/blog/${id}`; // todo: make this configurable
    }),
  viteServer: {
    root: path.resolve(process.cwd()),
    plugins: [reactPlugin()],
    server: { middlewareMode: true, port: 3000, ssr: true } as ServerOptions,
    appType: "custom",
    ssr: {
      external: ['react', 'react-dom'],
      target: 'node',
    },
    css: {
      modules: {
        generateScopedName: "[name]__[local]___[hash:base64:5]",
      },
    },
    optimizeDeps: {
      include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': '"development"',
      module: '{ exports: {} }',
    },
    esbuild: {
      jsx: 'automatic',
    },
  },
  ssrEntry: "src/server.tsx",
  // spread the process args onto the config
  ...process.argv,
};

export const defineConfig = (config: ConfigProps):ConfigProps => {
  return {
    ...CONFIG,
    ...config,
    viteServer: {
      ...CONFIG.viteServer,
      ...(config.viteServer || {}),
      server: {
        ...CONFIG.viteServer.server,
        ...(config.viteServer?.server || {}),
      },
    },
  };
};

// todo: make this configurable
export async function genUrls(config: ConfigProps) {
  const RSS = fs.readFileSync(
    path.resolve(process.cwd(), config.urlSrc),
    "utf-8"
  );
  const parser = new XMLParser();
  const rssOjb = parser.parse(RSS);
  const items = rssOjb.rss.channel.lenth === 1 ? rssOjb.rss.channel.item?.length
    ? rssOjb.rss.channel.item
    : [rssOjb.rss.channel.item]
    
    : rssOjb.rss.channel.map((channel: any) => {
      return channel.item?.length ? channel.item : [channel.item];
    }).flat();

  const urls = config.staticPaths?.concat(config.pathsBuilder(items)) || [];
  return { config, urls };
}


export interface GenStaticProps {
  config: ConfigProps;
  urls: string[];
}

export async function genStatic({ config, urls }: GenStaticProps) {
  // create the Vite server with enhanced configuration
  const serverConfig = {
    ...config.viteServer,
    ssr: {
      ...config.viteServer.ssr,
    },
  };
  
  const vite: ViteDevServer = await createServer(serverConfig).catch(
    (err) => {
      console.error(err);
      throw new Error(err);
    }
  );
  console.log("Vite server created");

  // generate the static pages
  const vitePromises = urls.map(async (url: string, index: number) => {
    // load the server entry for the page
    console.log("Loading Vite module for", url, "...");
    const { render, renderMetadata, preload, fetchMetaData } = await vite
      .ssrLoadModule(path.resolve(process.cwd(), config.ssrEntry))
      .catch((err) => {
        console.error(err);
        throw new Error(err);
      });
    // console.log("Vite loaded module  for ", url);

    if (preload && !config.staticPaths.includes(url)) {
      await preload(url);
      // console.log("Preloaded data for", url);
    }

    // load the index.html and render the App
    const toBuildPath = (pathPart: string) => path.join(config.dest, pathPart);
    const indexHtmlContent = fs
      .readFileSync(toBuildPath("index.html"))
      .toString();

    const urlHtmlMarkup = await render(url);
    if (!urlHtmlMarkup) {
      const errorStr = `No content rendered for ${url}`;
      console.error(errorStr);
      throw new Error(errorStr);
    }

    // update the index.html with the rendered markup
    let urlHtmlContent = indexHtmlContent.replace(
      '<div id="root"></div>',
      `<div id="root">${urlHtmlMarkup}</div>`
    );

    // if ssg:noscript is present, populate the <noscript> tag
    const ssgNoScriptIndex = urlHtmlContent.indexOf("<!-- ssg:noscript -->");
    if (ssgNoScriptIndex !== -1) {
      urlHtmlContent = urlHtmlContent.replace(
        "<!-- ssg:noscript -->",
        urlHtmlMarkup
      );
    }

    // get the page metadata
    let metadata: any;
    const isStatic = typeof config.staticMetaData[index] !== "undefined";
    if (isStatic) {
      // load the metadata from the static ts file
      const metadataPath = path.resolve(
        process.cwd(),
        config.staticMetaData[index]
      );
      try {
        metadata = require(metadataPath).default;
      } catch (error) {
        console.warn(`Could not load metadata from ${metadataPath}:`, error);
        metadata = {};
      }
    } else {
      // load the metadata from the provided file
      if (fetchMetaData) {
        metadata = (await fetchMetaData(url)).metaData;
      } else {
        metadata = {};
        console.warn("No fetchMetaData function provided");
      }
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
    const metadataString = (await renderMetadata(metadata))
      .replace("<div>", "")
      .replace("</div>", "");

    // parse the metadata string into a library
    const metaTagStrings = metadataString.replace(/></g, ">^<").split("^");
    const metaTagLib = metaTagStrings.reduce((acc:{[key:string]:string}, metaTag:string) => {
      if (!metaTag) return acc;
      const tagType = (metaTag.match(/<(\w+)/) || [])[1];
      if (tagType === "title") {
        return { ...acc, title: metaTag };
      }
      if (tagType === "link") {
        return { ...acc, canonical: metaTag };
      }
      const tagProperty = (metaTag.match(/(\w+)=/) || [])[1];
      const tagPropertyValue = (metaTag.match(/"([^"]+)"/) || [])[1];
      if (!tagProperty || !tagPropertyValue) return acc;
      return { ...acc, [tagPropertyValue]: metaTag };
    }, {});

    // Merge new metadata tags onto existing head metadata
    const newHeadStrings: string[] = [];
    for (const line of headStrings) {
      if (line.includes("<title>")) {
        newHeadStrings.push(metaTagLib.title);
      } else if (line.includes(`<link rel="canonical"`)) {
        newHeadStrings.push(metaTagLib.canonical);
      } else if (line.includes("<meta")) {
        const tagProperty = (line.match(/(\w+)=/) || [])[1];
        const tagPropertyValue = (line.match(/"([^"]+)"/) || [])[1];
        if (!tagProperty || !tagPropertyValue) {
          newHeadStrings.push(line);
          continue;
        }
        const newTag = metaTagLib[tagPropertyValue];
        newHeadStrings.push(newTag || line);
      } else {
        newHeadStrings.push(line);
      }
    }

    // determine which meta tags are not in newHeadStrings and add them to the end
    const unusedMetaTags = Object.keys(metaTagLib).filter(
      (key) => !newHeadStrings.join("").includes(key)
    );
    for (const key of unusedMetaTags) {
      newHeadStrings.push(metaTagLib[key]);
    }

    // rejoin the head strings and the rest of the html content
    const newHeadString = newHeadStrings.join("\n");
    const urlHtmlContentWithMetadata = `${newHeadString}${urlHtmlContent.slice(
      headEndIndex
    )}`;

    // write the new html content to the build directory
    // if subdirectory doesn't exist, create it
    const subDir = path.dirname(url);
    const subDirPath = path.join(config.dest, subDir);
    if (!fs.existsSync(subDirPath)) {
      fs.mkdirSync(subDirPath, { recursive: true });
    }
    // write the html file to the build directory
    fs.writeFileSync(toBuildPath(url + ".html"), urlHtmlContentWithMetadata);

    console.log(`Static page generated for ${url}`);
  });

  // Execute all the promises and close the Vite server
  await Promise.all(vitePromises)
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
    fs.renameSync(toBuildPath("index.html", config), toBuildPath("_.html", config));
    fs.renameSync(toBuildPath(".html", config), toBuildPath("index.html", config));
  }
}

export const toBuildPath = (file: string, config:ConfigProps) =>
  path.resolve(process.cwd(), config.dest, file);

export const generate = async (config?: ConfigProps) => {
  // check if the config file exists
  const configPathTs = path.resolve(process.cwd(), "ssg.config.ts");
  const configPathJs = path.resolve(process.cwd(), "ssg.config.js");
  const configPathJson = path.resolve(process.cwd(), "ssg.config.json");
  const configTsExists = fs.existsSync(configPathTs);
  const configJsExists = fs.existsSync(configPathJs);
  const configJsonExists = fs.existsSync(configPathJson);
  let configuration = config || CONFIG;

  if (configTsExists) {
    try {
      configuration = require(configPathTs).config;
    } catch (error) {
      console.warn(`Could not load config from ${configPathTs}:`, error);
      configuration = config || CONFIG;
    }
  } else if (configJsExists) {
    try {
      configuration = require(configPathJs).config;
    } catch (error) {
      console.warn(`Could not load config from ${configPathJs}:`, error);
      configuration = config || CONFIG;
    }
  } else if (configJsonExists) {
    const configJson = fs.readFileSync(configPathJson, "utf-8");
    configuration = JSON.parse(configJson);
  }
  
  if (!configuration) {
    console.error("No configuration found");
    process.exit(1);
  }

  try {
    const urlsData = await genUrls(configuration);
    await genStatic(urlsData);
  } catch (err) {
    console.error("Error generating static pages: ", err);
    process.exit(1);
  }
};

export default generate;
