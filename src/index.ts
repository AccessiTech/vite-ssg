import { createServer, ServerOptions, UserConfig, ViteDevServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { XMLParser } from "fast-xml-parser";



export interface ViteServerProps extends UserConfig { }

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
    plugins: [], // Framework-agnostic by default, user can add their framework plugin in config
    server: { middlewareMode: true, port: 3000, ssr: true } as ServerOptions,
    appType: "custom",
    ssr: {
      external: [
        // Node.js built-ins
        'fs', 'path', 'url', 'util', 'events', 'stream', 'buffer', 'crypto', 'os',
        // React core - these have complex internal dependencies
        'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        // Other problematic packages with complex internal structures
        'use-sync-external-store',
        'scheduler',
        // CommonJS packages that cause issues when bundled
        'hoist-non-react-statics',
        'react-redux',
        'invariant',
        'classnames',
        'uncontrollable',
        'react-bootstrap',
        'prop-types',
        'reduxjs-toolkit-persist',
        // CSS/SASS processing packages
        'sass',
        'node-sass',
        'bootstrap',
      ],
      target: 'node',
      resolve: {
        conditions: ['node', 'import', 'module', 'default'],
        externalConditions: ['node'],
      },
    },
    css: {
      modules: {
        generateScopedName: "[name]__[local]___[hash:base64:5]",
      },
      preprocessorOptions: {
        scss: {
          includePaths: [
            path.resolve(process.cwd(), 'src'),
            path.resolve(process.cwd(), 'node_modules'),
            path.resolve(process.cwd()),
          ],
          silenceDeprecations: ['legacy-js-api'],
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        '~': path.resolve(process.cwd(), 'node_modules'),
        'src': path.resolve(process.cwd(), 'src'),
      },
    },
    optimizeDeps: {
      force: true, // Force re-optimization of dependencies
      include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': '"development"',
    },
    esbuild: {
      jsx: 'automatic',
    },
  },
  ssrEntry: "src/server.tsx",
  // spread the process args onto the config
  ...process.argv,
};

export const defineConfig = (config: ConfigProps): ConfigProps => {
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
  // create a plugin to provide browser globals in SSR
  const ssrGlobalsPlugin = {
    name: 'ssr-globals',
    configureServer() {
      // Mock DOM element for react-helmet
      const mockElement = () => ({
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        removeChild: () => {},
        querySelectorAll: () => [],
        querySelector: () => null,
        tagName: 'DIV',
        innerHTML: '',
        textContent: ''
      });

      if (typeof globalThis.window === 'undefined') {
        (globalThis as any).window = {
          addEventListener: () => {},
          removeEventListener: () => {},
          document: {
            addEventListener: () => {},
            removeEventListener: () => {},
            createElement: mockElement,
            getElementsByTagName: () => [],
            querySelectorAll: () => [],
            querySelector: () => null,
            head: {
              querySelectorAll: () => [],
              querySelector: () => null,
              appendChild: () => {},
              removeChild: () => {}
            },
            body: {},
            documentElement: {}
          }
        };
      }
      if (typeof globalThis.document === 'undefined') {
        (globalThis as any).document = {
          addEventListener: () => {},
          removeEventListener: () => {},
          createElement: mockElement,
          getElementsByTagName: () => [],
          querySelectorAll: () => [],
          querySelector: () => null,
          head: {
            querySelectorAll: () => [],
            querySelector: () => null,
            appendChild: () => {},
            removeChild: () => {}
          },
          body: {},
          documentElement: {}
        };
      }
      if (typeof globalThis.navigator === 'undefined') {
        (globalThis as any).navigator = {};
      }
      if (typeof globalThis.location === 'undefined') {
        (globalThis as any).location = {};
      }
    }
  };

  // Plugin to completely disable CSS imports during SSR
  const ssrCssMockPlugin = {
    name: 'ssr-css-disable',
    enforce: 'pre' as const, // Run before Vite's built-in CSS plugin
    resolveId(id: string, importer?: string) {
      // Check both the id and if it's a CSS-like file
      if (id.includes('.scss') || id.includes('.css') || id.includes('.sass') || id.includes('.less') || id.includes('.styl') ||
          id.endsWith('.scss') || id.endsWith('.css') || id.endsWith('.sass') || id.endsWith('.less') || id.endsWith('.styl')) {
        return '\0virtual:css-disabled';
      }
      return null;
    },
    load(id: string) {
      // Return empty module for the virtual CSS file
      if (id === '\0virtual:css-disabled') {
        return 'export default {};';
      }
      return null;
    },
  };

  // create the Vite server with enhanced configuration
  const serverConfig = {
    ...config.viteServer,
    ssr: {
      ...config.viteServer.ssr,
      // Completely externalize CSS/SCSS to prevent processing during SSR
      external: [
        'sass',
        'node-sass',
        'sass-loader',
        'postcss',
        'autoprefixer',
        ...(Array.isArray(config.viteServer.ssr?.external) ? config.viteServer.ssr.external : [])
      ],
      noExternal: Array.isArray(config.viteServer.ssr?.noExternal) ? config.viteServer.ssr.noExternal : []
    },
    plugins: [
      ssrCssMockPlugin, // Put CSS disable first to intercept all CSS imports
      ...(config.viteServer.plugins || []),
      ssrGlobalsPlugin
    ],
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
        const metadataFileUrl = pathToFileURL(metadataPath).href;
        const metadataModule = await import(metadataFileUrl);
        metadata = metadataModule.default || metadataModule;
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
    const metaTagLib = metaTagStrings.reduce((acc: { [key: string]: string }, metaTag: string) => {
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

export const toBuildPath = (file: string, config: ConfigProps) =>
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
    console.warn(`Found ssg.config.ts in an ES module project.`);
    console.warn(`TypeScript config files are not directly supported in ES module projects.`);
    console.warn(`Please rename ssg.config.ts to ssg.config.js or add "type": "commonjs" to your package.json.`);
    configuration = config || CONFIG;
  } else if (configJsExists) {
    try {
      // For JavaScript config files, use dynamic import for ES modules
      const configFileUrl = pathToFileURL(configPathJs).href;
      const configModule = await import(configFileUrl);
      configuration = configModule.config || configModule.default?.config || configModule.default;
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
