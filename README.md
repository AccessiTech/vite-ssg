# @accessitech/vite-ssg

A framework agnostic Static Site Generator (SSG) using Vite.

Common server side rendering (SSR) like Next.js, Nuxt.js, and others are great, but they are tied to their respective, often proprietary, frameworks. This project aims to provide a framework agnostic SSG that can be used with any framework that can be rendered to HTML.

Serverless and static hosting options like GitHub Pages, GoogleSites, and others lack the ability to serve your multi-page app with route specific metadata. This project aims to provide a solution to that problem by generating static HTML files that are optimized for search engines.

This project is built on top of Vite, a fast build tool that provides a great developer experience. It leverages Vite's fast build times and SSR capabilities to generate static HTML files that are optimized for search engines.

## Features

- **Framework agnostic**: Works with any framework that can be rendered to HTML.
- **Fast**: Built on top of Vite, it leverages Vite's fast build times and Server Side Rendering (SSR).
- **SEO friendly**: Generates static HTML files that are optimized for search engines.
- **Easy to use**: Simple API and configuration.
- **Customizable**: Easily extendable with plugins and custom configurations.

### What the Script Does

1. **Fetches the RSS feed**: The script fetches the RSS feed from the specified URL and parses it to extract the items.
2. **Preloads the data**: The script preloads the data needed for rendering the app. This is done by dispatching the data to your store.
3. **Copies the build index.html**: The script copies the build index.html file at the destination directory, and uses that as a base to generate the static HTML files.
4. **Renders the app**: The script renders the app using the `render` function. This function takes a path as an argument and returns the rendered HTML string.
5. **Merges the metadata**: The script renders the metadata using the `renderMetadata` function, and merges it with existing metadata from the index.html file.
6. **Writes the static HTML files**: The script writes the resulting content to new static HTML files at the destination directory.

## Getting Started

To get started, you need to install the package and its dependencies. You can do this using npm or yarn.

### Installation

```bash
npm install -D @accessitech/vite-ssg tsx

# or

yarn add -D @accessitech/vite-ssg tsx
```

### TypeScript Source Integration (Advanced)

For TypeScript projects that want to work directly with the source TypeScript files (for better debugging, source maps, and development experience), this package exposes its TypeScript source files through the `exports.typescript` field.

Modern TypeScript tools and bundlers (like Vite, webpack 5+, etc.) will automatically prefer the TypeScript source when available. This allows you to:

- Get better source maps that point to the original TypeScript files
- Debug directly in the source TypeScript code
- Get full IntelliSense and type information
- Have your bundler handle the compilation optimally

To use JavaScript config files in ES module projects (which is recommended for compatibility), rename your config file:
```bash
# Instead of ssg.config.ts, use:
mv ssg.config.ts ssg.config.js
```

### Basic Usage

To use the package, you need to create a `ssg.config.ts` file in the root of your project. This file will contain the configuration for the SSG.

#### ssg.config.ts

```typescript
//  ssg.config.ts
import { ConfigProps, defineConfig } from "@accessitech/vite-ssg";

export const config: ConfigProps = defineConfig({
  // ...
});

```

#### src/server.tsx

The main script will use your server file specified by `config.ssrEntry` in the `ssg.config.ts` file. This file should export:

1. a `render` function that takes a path as an argument and returns the rendered HTML string.
2. a `renderMetadata` function that takes a data object as an argument and returns the rendered metadata string.
3. a `preload` function loads your data and dispatches it to your store.
4. a `fetchMetaData` function that takes a URL as an argument and returns the associated metadata and file content.
5. any other business logic you need to fetch and parse your metadata.

**IMPORTANT: ReactDOMServer is imported dynamically to avoid SSR issues with Vite.**

```typescript
// src/server.tsx
import App from './App/App';
import { YourDataProps, YourMetadataComponent } from './Your/MetaData/Component';

export const preload = async (data:any) => {
  // fetch data needed for rendering
  // customize as needed to populate your store
  store.dispatch({ type: 'YOUR_ACTION', payload: data });
};

export const render = async (path:string):string => {
  // customize as needed to render your app
  const ReactDOMServer = (await import('react-dom/server')).default;
  return ReactDOMServer.renderToString(<App path={path} />);
};

export const renderMetadata = async (data:YourDataProps):string => {
  // customize as needed to render your metadata
  const ReactDOMServer = (await import('react-dom/server')).default;
  return ReactDOMServer.renderToString(<YourMetadataComponent {...data} />);
};

export const fetchMetaData = async (url:string):
  Promise<{ metaData: { [key: string]: string }, fileContent: string }>
=> {
  // fetch your metadata from the url
  const fileContent:string = await businessLogicToGetFileContent(url);
  const metaData: {[key:string]: string} = await businessLogicToParseMetaData(fileContent);
  return { metaData, fileContent };
};
```

#### package.json

Add a script to your `package.json` file to run the SSG. This script will use the `tsx` command to run the `generate` function from the package.

```json
{
  ...
  "scripts": {
    ...
    "ssg": "tsx ./node_modules/@accessitech/vite-ssg/generate"
  }
  ...
}
```

### Running the SSG

To run the SSG, you can use the following command:

```bash
npm run ssg

# or

yarn ssg
```

## Configuration

Configuration can be done in a `ssg.config.ts`, `ssg.config.js`, or `ssg.config.json` file, or by passing a `ConfigProps` object directly to the `generate` function. Configuration files should export a `ConfigProps` object.

```typescript
// @accessitech/vite-ssg/index.ts
import { UserConfig, ServerOptions } from "vite";
...

// ViteServerProps is a subset of UserConfig from Vite
export interface ViteServerProps extends UserConfig {}

// ConfigProps is the configuration API for @accessitech/vite-ssg
export interface ConfigProps {
  // The entry server file containing the render function
  // Note: Don't include the leading slash
  ssrEntry: string;

  // The source URL for the RSS feed
  // Note: Don't include the leading
  urlSrc: string;

  // The destination directory for the generated static files
  // This should be your build folder
  // Note: Don't include the leading or trailing slash
  dest: string;

  // The paths that don't require preloading data
  // Note: DO use the leading slash
  // and DO NOT use the trailing slash
  // e.g. "/blog" instead of "blog" or "/blog/"
  staticPaths: string[];

  // The metadata associated with the static paths
  // Note: DO use the leading slash
  // and DO NOT use the trailing slash
  staticMetaData: string[];
  
  // A function that takes an array of items and returns an array of paths
  // Note: DO use the leading slash
  // and DO NOT use the trailing slash
  pathsBuilder: (items: any[]) => string[];

  // The base URL for the production environment
  // Note: don't include the trailing slash
  productionUrlBase: string;

  // The Vite server configuration
  viteServer: ViteServerProps;

  // Whether to replace the index.html file in the destination directory
  // with the generated static index.html file
  replaceIndexHtml?: boolean;
}

// The default configuration file
export const CONFIG: ConfigProps = {
  ssrEntry: "src/server.tsx",
  urlSrc: "public/rss.xml",
  dest: "docs",
  staticPaths: ["/", "/blog"],
  staticMetaData: ["src/App/meta.ts", "src/pages/Blog/meta.ts"],
  productionUrlBase: "https://accessi.tech",
  pathsBuilder: (items) =>
    items.map((item) => {
      const { link } = item;
      const id = link.split("/").pop()?.replace(".md", "") || "";
      return `/blog/${id}`;
    }),
  viteServer: {
    root: path.resolve(process.cwd()),
    plugins: [reactPlugin()], // Add your Vite plugins here
    server: { middlewareMode: true, port: 3000, ssr: true } as ServerOptions,
    appType: "custom",
  },
};
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
