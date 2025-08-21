// Import required dependencies for Vite SSR and file system operations
import { createServer, ServerOptions, UserConfig, ViteDevServer } from "vite";
import path from "node:path"; // Node.js path utilities for file/directory manipulation
import fs from "node:fs"; // Node.js file system operations
import { pathToFileURL } from "node:url"; // Convert file paths to URLs for dynamic imports
import { XMLParser } from "fast-xml-parser"; // XML parser for processing RSS feeds

// Type definition for Vite server configuration properties
// Extends Vite's UserConfig to inherit all standard Vite configuration options
export interface ViteServerProps extends UserConfig { }

// Main configuration interface that defines all SSG generation settings
export interface ConfigProps {
  urlSrc: string; // Path to RSS feed file for extracting dynamic URLs (e.g., blog posts)
  dest: string; // Output directory where generated static files will be written
  staticPaths: string[]; // Array of static routes to pre-render (e.g., ["/", "/about"])
  staticMetaData: string[]; // Corresponding metadata files for each static path
  productionUrlBase: string; // Base URL for the production site (for absolute URLs)
  pathsBuilder: (items: any[]) => string[]; // Function to build dynamic paths from RSS items
  viteServer: ViteServerProps; // Vite server configuration for SSR
  ssrEntry: string; // Entry point file for server-side rendering
  replaceIndexHtml?: boolean; // Whether to replace the original index.html with generated content
}

// Default configuration object for the SSG
// TODO: move this to a config file for better maintainability
export const CONFIG: ConfigProps = {
  // RSS feed source for extracting blog post URLs
  urlSrc: "public/rss.xml",
  // Output directory for generated static files
  dest: "docs",
  // Static routes that don't require dynamic data (homepage, blog index, etc.)
  staticPaths: ["/", "/blog"],
  // Metadata files corresponding to each static path (same array order)
  staticMetaData: ["src/App/meta.ts", "src/pages/Blog/meta.ts"],
  // Production base URL for generating absolute URLs in metadata
  productionUrlBase: "https://accessi.tech",
  // Function to transform RSS feed items into URL paths
  // Takes RSS items and extracts the filename to create blog post URLs
  pathsBuilder: (items) =>
    items.map((item) => {
      const { link } = item; // Extract link from RSS item
      const id = link.split("/").pop()?.replace(".md", "") || ""; // Get filename without .md extension
      return `/blog/${id}`; // TODO: make this configurable for different URL patterns
    }),
  // Comprehensive Vite server configuration for SSR
  viteServer: {
    // Set root directory to current working directory
    root: path.resolve(process.cwd()),
    // Framework-agnostic by default - users can add React/Vue/etc. plugins in their config
    plugins: [],
    // Server configuration for SSR mode
    server: { middlewareMode: true, port: 3000, ssr: true } as ServerOptions,
    // Custom app type to handle SSR manually
    appType: "custom",
    // SSR-specific configuration to handle Node.js environment
    ssr: {
      // Externalize packages that shouldn't be bundled during SSR
      // This prevents bundling issues and improves performance
      external: [
        // Node.js built-in modules - these are available in Node environment
        'fs', 'path', 'url', 'util', 'events', 'stream', 'buffer', 'crypto', 'os',
        // React core packages - have complex internal dependencies that cause bundling issues
        'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        // React ecosystem packages with complex internal structures
        'use-sync-external-store',
        'scheduler',
        // CommonJS packages that cause issues when bundled for SSR
        'hoist-non-react-statics',
        'react-redux',
        'invariant',
        'classnames',
        'uncontrollable',
        'react-bootstrap',
        'prop-types',
        'reduxjs-toolkit-persist',
        // CSS/SASS processing packages - handled separately during build
        'sass',
        'node-sass',
        'bootstrap',
      ],
      // Target Node.js environment for SSR
      target: 'node',
      // Resolve configuration for Node.js compatibility
      resolve: {
        // Conditions for resolving modules in Node.js environment
        conditions: ['node', 'import', 'module', 'default'],
        externalConditions: ['node'],
      },
    },
    // CSS modules configuration for component-scoped styling
    css: {
      modules: {
        // Generate unique class names: [component]__[className]___[hash]
        generateScopedName: "[name]__[local]___[hash:base64:5]",
      },
      // SCSS preprocessor configuration
      preprocessorOptions: {
        scss: {
          // Include paths for SCSS imports to resolve dependencies
          includePaths: [
            path.resolve(process.cwd(), 'src'), // Project source directory
            path.resolve(process.cwd(), 'node_modules'), // npm packages
            path.resolve(process.cwd()), // Project root
          ],
          // Silence SASS deprecation warnings for legacy API usage
          silenceDeprecations: ['legacy-js-api'],
        },
      },
    },
    // Module resolution configuration for cleaner imports
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'), // '@' points to src directory
        '~': path.resolve(process.cwd(), 'node_modules'), // '~' points to node_modules
        'src': path.resolve(process.cwd(), 'src'), // Direct src alias
      },
    },
    // Dependency optimization configuration
    optimizeDeps: {
      force: true, // Force re-optimization of dependencies on every build
      // Explicitly include React JSX runtime for proper optimization
      include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    // Global variable definitions for the browser environment
    define: {
      global: 'globalThis', // Polyfill 'global' with 'globalThis' for browser compatibility
      'process.env.NODE_ENV': '"development"', // Set development environment
    },
    // ESBuild configuration for JSX transformation
    esbuild: {
      jsx: 'automatic', // Use React 17+ automatic JSX transform
    },
  },
  // Entry point for server-side rendering (contains render function)
  ssrEntry: "src/server.tsx",
  // Spread command line arguments onto the config (allows CLI overrides)
  // TODO: Implement proper CLI argument parsing
  ...process.argv,
};

// Factory function to create a merged configuration
// Allows users to override default settings while preserving sensible defaults
export const defineConfig = (config: ConfigProps): ConfigProps => {
  return {
    // Start with default CONFIG as base
    ...CONFIG,
    // Override with user-provided config
    ...config,
    // Merge viteServer config specially to preserve nested properties
    viteServer: {
      ...CONFIG.viteServer,
      ...(config.viteServer || {}),
      // Merge server config nested properties
      server: {
        ...CONFIG.viteServer.server,
        ...(config.viteServer?.server || {}),
      },
    },
  };
};

// Function to generate URLs for static site generation
// Extracts URLs from RSS feed and combines with static paths
// TODO: make this configurable for different feed formats
export async function genUrls(config: ConfigProps) {
  // Read the RSS feed file from the configured source
  const RSS = fs.readFileSync(
    path.resolve(process.cwd(), config.urlSrc),
    "utf-8"
  );

  // Parse XML content using fast-xml-parser
  const parser = new XMLParser();
  const rssOjb = parser.parse(RSS);

  // Handle both single and multiple RSS channels
  // Extract items from RSS feed, handling various RSS structures
  const items = rssOjb.rss.channel.lenth === 1 ?
    // Single channel case
    rssOjb.rss.channel.item?.length
      ? rssOjb.rss.channel.item  // Multiple items in single channel
      : [rssOjb.rss.channel.item] // Single item in single channel
    : // Multiple channels case
    rssOjb.rss.channel.map((channel: any) => {
      // Extract items from each channel and flatten
      return channel.item?.length ? channel.item : [channel.item];
    }).flat();

  // Combine static paths with dynamically generated paths from RSS items
  const urls = config.staticPaths?.concat(config.pathsBuilder(items)) || [];
  return { config, urls };
}


// Type definition for the static generation function parameters
export interface GenStaticProps {
  config: ConfigProps; // SSG configuration object
  urls: string[]; // Array of URLs to generate static pages for
}

// Main function to generate static pages from dynamic React SSR
export async function genStatic({ config, urls }: GenStaticProps) {
  // Helper function to escape HTML attributes to prevent XSS
  const escapeHtml = (unsafe: string): string => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Create a Vite plugin to provide browser globals in SSR environment
  // This is necessary because SSR runs in Node.js which lacks browser APIs
  const ssrGlobalsPlugin = {
    name: 'ssr-globals',
    configureServer() {
      // Mock DOM element factory for libraries that expect DOM APIs (like react-helmet)
      const mockElement = () => ({
        setAttribute: () => { }, // Mock setAttribute method
        getAttribute: () => null, // Mock getAttribute method
        appendChild: () => { }, // Mock appendChild method
        removeChild: () => { }, // Mock removeChild method
        querySelectorAll: () => [], // Mock querySelectorAll method
        querySelector: () => null, // Mock querySelector method
        tagName: 'DIV', // Default tag name
        innerHTML: '', // Default innerHTML
        textContent: '' // Default textContent
      });

      // Create mock window object if it doesn't exist (SSR environment)
      if (typeof globalThis.window === 'undefined') {
        (globalThis as any).window = {
          addEventListener: () => { }, // Mock event listener methods
          removeEventListener: () => { },
          document: {
            addEventListener: () => { },
            removeEventListener: () => { },
            createElement: mockElement, // Use our mock element factory
            getElementsByTagName: () => [], // Mock DOM query methods
            querySelectorAll: () => [],
            querySelector: () => null,
            head: {
              querySelectorAll: () => [],
              querySelector: () => null,
              appendChild: () => { },
              removeChild: () => { }
            },
            body: {}, // Mock body element
            documentElement: {} // Mock document element
          }
        };
      }

      // Create mock document object if it doesn't exist
      if (typeof globalThis.document === 'undefined') {
        (globalThis as any).document = {
          addEventListener: () => { },
          removeEventListener: () => { },
          createElement: mockElement,
          getElementsByTagName: () => [],
          querySelectorAll: () => [],
          querySelector: () => null,
          head: {
            querySelectorAll: () => [],
            querySelector: () => null,
            appendChild: () => { },
            removeChild: () => { }
          },
          body: {},
          documentElement: {}
        };
      }
      if (typeof globalThis.document === 'undefined') {
        (globalThis as any).document = {
          addEventListener: () => { },
          removeEventListener: () => { },
          createElement: mockElement,
          getElementsByTagName: () => [],
          querySelectorAll: () => [],
          querySelector: () => null,
          head: {
            querySelectorAll: () => [],
            querySelector: () => null,
            appendChild: () => { },
            removeChild: () => { }
          },
          body: {}, // Mock body element
          documentElement: {} // Mock document element
        };
      }

      // Create mock document object if it doesn't exist
      if (typeof globalThis.document === 'undefined') {
        (globalThis as any).document = {
          addEventListener: () => { },
          removeEventListener: () => { },
          createElement: mockElement,
          getElementsByTagName: () => [],
          querySelectorAll: () => [],
          querySelector: () => null,
          head: {
            querySelectorAll: () => [],
            querySelector: () => null,
            appendChild: () => { },
            removeChild: () => { }
          },
          body: {}, // Mock body element
          documentElement: {} // Mock document element
        };
      }

      // Create mock navigator object for browser compatibility
      if (typeof globalThis.navigator === 'undefined') {
        (globalThis as any).navigator = {};
      }

      // Create mock location object for routing compatibility
      if (typeof globalThis.location === 'undefined') {
        (globalThis as any).location = {};
      }
    }
  };

  // Plugin to completely disable CSS imports during SSR
  // This prevents CSS processing issues that can cause SSR to fail
  const ssrCssMockPlugin = {
    name: 'ssr-css-disable',
    enforce: 'pre' as const, // Run before Vite's built-in CSS plugin to intercept CSS imports
    resolveId(id: string, importer?: string) {
      // Check if the import is a CSS-related file by examining the file path
      // This catches both direct CSS imports and CSS files imported through other modules
      if (id.includes('.scss') || id.includes('.css') || id.includes('.sass') || id.includes('.less') || id.includes('.styl') ||
        id.endsWith('.scss') || id.endsWith('.css') || id.endsWith('.sass') || id.endsWith('.less') || id.endsWith('.styl')) {
        // Return a virtual module ID that we'll handle in the load hook
        return '\0virtual:css-disabled';
      }
      return null; // Let other plugins handle non-CSS imports
    },
    load(id: string) {
      // Provide an empty module for our virtual CSS files
      // This prevents CSS processing during SSR while maintaining module compatibility
      if (id === '\0virtual:css-disabled') {
        return 'export default {};'; // Return empty object as default export
      }
      return null; // Let other plugins handle non-virtual modules
    },
  };

  // Create enhanced Vite server configuration by merging user config with necessary SSR settings
  const serverConfig = {
    // Spread the user's Vite configuration as base
    ...config.viteServer,
    // Enhanced SSR configuration for better compatibility
    ssr: {
      // Inherit existing SSR configuration from user
      ...config.viteServer.ssr,
      // Completely externalize CSS/SCSS packages to prevent SSR processing issues
      // CSS should only be processed during the client build, not SSR
      external: [
        'sass', // SASS compiler
        'node-sass', // Legacy SASS compiler
        'sass-loader', // Webpack SASS loader
        'postcss', // CSS post-processor
        'autoprefixer', // CSS autoprefixer plugin
        // Include any existing external packages from user configuration
        ...(Array.isArray(config.viteServer.ssr?.external) ? config.viteServer.ssr.external : [])
      ],
      // Preserve existing noExternal configuration from user
      noExternal: Array.isArray(config.viteServer.ssr?.noExternal) ? config.viteServer.ssr.noExternal : []
    },
    // Plugin configuration with our custom SSR plugins
    plugins: [
      ssrCssMockPlugin, // CSS disable plugin must come first to intercept all CSS imports
      // Include user's existing plugins
      ...(config.viteServer.plugins || []),
      ssrGlobalsPlugin // Browser globals plugin comes last to provide fallbacks
    ],
  };

  // Create the Vite development server for SSR
  // This server will be used to render React components to HTML strings
  const vite: ViteDevServer = await createServer(serverConfig).catch(
    (err) => {
      console.error(err);
      throw new Error(err);
    }
  );
  console.log("Vite server created");

  // Load the SSR module once for all pages to improve performance
  // The SSR entry point should export: render, preload, and fetchMetaData functions
  console.log("Loading Vite module...");
  const { render, preload, fetchMetaData } = await vite
    .ssrLoadModule(path.resolve(process.cwd(), config.ssrEntry))
    .catch((err) => {
      console.error("Failed to load SSR module:", err);
      throw new Error(err);
    });
  console.log("Vite module loaded successfully");

  // Pre-load all unique static metadata files once to avoid race conditions
  // This cache prevents multiple concurrent reads of the same metadata file
  const metadataCache: { [filePath: string]: any } = {};
  // Get unique metadata files, filtering out any null/undefined values
  const uniqueMetadataFiles = [...new Set(config.staticMetaData.filter(Boolean))];

  // Load each metadata file into the cache
  for (const metadataFile of uniqueMetadataFiles) {
    const metadataPath = path.resolve(process.cwd(), metadataFile);
    try {
      // Force cache invalidation by adding timestamp to import URL
      // This ensures we get fresh metadata on each build
      const metadataFileUrl = pathToFileURL(metadataPath).href + '?t=' + Date.now();
      const metadataModule = await import(metadataFileUrl);
      // Store either the default export or the entire module
      metadataCache[metadataFile] = metadataModule.default || metadataModule;
      // console.log(`Loaded static metadata from ${metadataFile}:`, metadataCache[metadataFile]);
    } catch (error) {
      console.warn(`Could not load metadata from ${metadataPath}:`, error);
      // Use empty object as fallback if metadata file can't be loaded
      metadataCache[metadataFile] = {};
    }
  }

  // generate the static pages
  const vitePromises = urls.map(async (url: string, index: number) => {
    // console.log("Generating page for", url, "...");

    if (preload && !config.staticPaths.includes(url)) {
      await preload(url);
      // console.log("Preloaded data for", url);
    }
    // get the page metadata first
    let metadata: any;

    const isStatic = config.staticPaths.includes(url);

    if (isStatic) {
      // For static paths like "/", "/blog", use static metadata files
      const staticIndex = config.staticPaths.indexOf(url);
      if (staticIndex !== -1 && config.staticMetaData[staticIndex]) {
        const metadataFile = config.staticMetaData[staticIndex];
        metadata = metadataCache[metadataFile] || {};
      } else {
        // Fallback to default metadata for static paths without metadata files
        metadata = {};
      }
    } else {
      // For dynamic paths (blog posts, wcag pages), use fetchMetaData
      if (fetchMetaData) {
        try {
          const result = await fetchMetaData(url);
          
          // Handle different possible return structures from fetchMetaData
          if (result && typeof result === 'object') {
            if (result.metaData) {
              metadata = result.metaData;
            } else if (result.metadata) {
              metadata = result.metadata;
            } else {
              // If result doesn't have metaData or metadata property, use the result itself
              metadata = result;
            }
          } else {
            metadata = {};
          }
        } catch (error) {
          console.error(`Failed to fetch metadata for ${url}:`, error);
          if (error instanceof Error) {
            console.error(`Error details:`, error.message, error.stack);
          }
          metadata = {};
        }
      } else {
        console.warn(`No fetchMetaData function available for dynamic path ${url}`);
        metadata = {};
      }
    }

    // load the index.html and render the App
    const toBuildPath = (pathPart: string) => path.join(config.dest, pathPart);
    const indexHtmlContent = fs
      .readFileSync(toBuildPath("index.html"))
      .toString();

    const urlHtmlMarkup = await render(url, metadata);
    if (!urlHtmlMarkup) {
      const errorStr = `No content rendered for ${url}`;
      console.error(errorStr);
      throw new Error(errorStr);
    }

    // Extract metadata div from the rendered markup before injecting into page
    const metadataMatch = urlHtmlMarkup.match(/<div data-testid="metadata">([\s\S]*?)<\/div>/);
    const extractedMetadata = metadataMatch ? metadataMatch[1] : '';

    // Remove the metadata div from the markup to avoid it appearing in page content
    // Use global flag to remove all instances and make the regex more robust
    const cleanedUrlHtmlMarkup = urlHtmlMarkup.replace(/<div[^>]*data-testid="metadata"[^>]*>[\s\S]*?<\/div>/g, '');

    // update the index.html with the rendered markup (without metadata div)
    let urlHtmlContent = indexHtmlContent.replace(
      '<div id="root"></div>',
      `<div id="root">${cleanedUrlHtmlMarkup}</div>`
    );

    // if ssg:noscript is present, populate the <noscript> tag
    const ssgNoScriptIndex = urlHtmlContent.indexOf("<!-- ssg:noscript -->");
    if (ssgNoScriptIndex !== -1) {
      urlHtmlContent = urlHtmlContent.replace(
        "<!-- ssg:noscript -->",
        cleanedUrlHtmlMarkup  // Use cleaned markup here too
      );
    }

    // define the existing head content of index.html
    const headEnd = "</head>";
    const headEndIndex = urlHtmlContent.indexOf(headEnd);
    const headString = urlHtmlContent.slice(0, headEndIndex);

    // Parse HTML tags from head section using a robust regex pattern
    // This regex captures all <title>, <meta>, <link>, <script>, and <style> tags, including single-line and multi-line, and self-closing tags
    const headStrings: string[] = [];
  // This regex matches any <title>, <meta>, <link>, <script>, or <style> tag, including self-closing, multi-line, and single-line tags at the end of head
  const tagRegex = /<(title|meta|link|script|style)\b[\s\S]*?(?:\/>|>.*?<\/\1>|>)/gi;
    let match;
    // Extract all <title>, <meta>, <link>, <script>, and <style> tags from the <head> section using a robust regex.
    // This loop ensures that all relevant tags (including multi-line and self-closing) are captured for later deduplication and merging.
    // The extracted tags are pushed into headStrings for further processing.
    while ((match = tagRegex.exec(headString)) !== null) {
      headStrings.push(match[0]);
    }

    // Generate metadata string from the metadata object
    // This converts the structured metadata into HTML meta tags
    let metadataString = '';

    // Use the metadata object directly to build standardized metadata tags
    if (metadata) {
      // Array to collect all generated meta tags
      const metaTags = [];

      // Generate title tag if title is provided
      if (metadata.title) {
        metaTags.push(`<title>${escapeHtml(metadata.title)}</title>`);
      }

      // Generate description meta tags for SEO and social media
      if (metadata.description) {
        const escapedDescription = escapeHtml(metadata.description);
        metaTags.push(`<meta name="description" content="${escapedDescription}">`); // SEO description
        metaTags.push(`<meta property="og:description" content="${escapedDescription}">`); // Open Graph (Facebook)
        metaTags.push(`<meta name="twitter:description" content="${escapedDescription}">`); // Twitter Card
      }
      // Generate title meta tags for social media platforms
      if (metadata.title) {
        const escapedTitle = escapeHtml(metadata.title);
        metaTags.push(`<meta property="og:title" content="${escapedTitle}">`); // Open Graph title (Facebook, LinkedIn)
        metaTags.push(`<meta name="twitter:title" content="${escapedTitle}">`); // Twitter Card title
      }

      // Handle both 'url' and 'canonical' fields for canonical URLs
      // This provides flexibility in metadata object structure
      const canonicalUrl = metadata.url || metadata.canonical;
      if (canonicalUrl) {
        // Ensure canonical URL is absolute for proper SEO and social sharing
        // Convert relative URLs to absolute URLs using the production base
        const absoluteCanonical = canonicalUrl.startsWith('http')
          ? canonicalUrl // Already absolute
          : `${config.productionUrlBase}${canonicalUrl.startsWith('/') ? canonicalUrl : `/${canonicalUrl}`}`;

        // Generate canonical link tag and social media URL tags
        const escapedCanonical = escapeHtml(absoluteCanonical);
        metaTags.push(`<link rel="canonical" href="${escapedCanonical}">`); // SEO canonical URL
        metaTags.push(`<meta property="og:url" content="${escapedCanonical}">`); // Open Graph URL
        metaTags.push(`<meta name="twitter:url" content="${escapedCanonical}">`); // Twitter Card URL
      }

      // Handle image metadata for social media previews
      if (metadata.image) {
        // Ensure image URL is absolute for proper social media display
        // Convert relative image paths to absolute URLs
        const absoluteImageUrl = metadata.image.startsWith('http')
          ? metadata.image // Already absolute URL
          : `${config.productionUrlBase}${metadata.image.startsWith('/') ? metadata.image : `/assets/images/${metadata.image}`}`;

        // Generate social media image tags
        const escapedImageUrl = escapeHtml(absoluteImageUrl);
        metaTags.push(`<meta property="og:image" content="${escapedImageUrl}">`); // Open Graph image
        metaTags.push(`<meta name="twitter:image" content="${escapedImageUrl}">`); // Twitter Card image
      }

      // Generate alt text for social media images (accessibility and fallback)
      if (metadata.imageAlt) {
        const escapedImageAlt = escapeHtml(metadata.imageAlt);
        metaTags.push(`<meta property="og:image:alt" content="${escapedImageAlt}">`); // Open Graph image alt text
        metaTags.push(`<meta name="twitter:image:alt" content="${escapedImageAlt}">`); // Twitter Card image alt text
      }

      // Generate Open Graph content type (article, website, etc.)
      if (metadata.type) {
        const escapedType = escapeHtml(metadata.type);
        metaTags.push(`<meta property="og:type" content="${escapedType}">`); // Open Graph content type
      }

      // Generate site name metadata for branding
      if (metadata.siteName) {
        const escapedSiteName = escapeHtml(metadata.siteName);
        metaTags.push(`<meta property="og:site_name" content="${escapedSiteName}">`); // Open Graph site name
        metaTags.push(`<meta name="twitter:site" content="${escapedSiteName}">`); // Twitter site handle
      }

      // Generate Twitter creator attribution
      if (metadata.twitterCreator) {
        const escapedTwitterCreator = escapeHtml(metadata.twitterCreator);
        metaTags.push(`<meta name="twitter:creator" content="${escapedTwitterCreator}">`); // Twitter creator handle
      }

      // Generate Twitter Card type with fallback to large image format
      if (metadata.twitterCard || metadata.twitterCreator) {
        const escapedTwitterCard = escapeHtml(metadata.twitterCard || 'summary_large_image');
        metaTags.push(`<meta name="twitter:card" content="${escapedTwitterCard}">`); // Twitter Card format
      }

      // Join all generated meta tags into a single string with newlines
      metadataString = metaTags.join('\n');
    } else if (extractedMetadata) {
      // Fallback: use extracted metadata from SSR if structured metadata object is not available
      // This handles cases where metadata comes from rendered components instead of config files
      metadataString = extractedMetadata;
    }

    // Parse the metadata string into a structured library for intelligent merging
    // This converts the HTML string back into a searchable object for deduplication
    // Split metadata string by lines and extract individual HTML tags
    const metaTagStrings = metadataString
      .split('\n') // Split into individual lines
      .map(line => line.trim()) // Remove whitespace from each line
      .filter(line => line && (line.includes('<title>') || line.includes('<meta') || line.includes('<link'))); // Only keep relevant HTML tags

    // Convert metadata strings into a searchable object library
    // This enables intelligent deduplication and merging of metadata
    const metaTagLib = metaTagStrings.reduce((acc: { [key: string]: string }, metaTag: string) => {
      if (!metaTag.trim()) return acc; // Skip empty lines

      // Extract the HTML tag type (title, meta, link, etc.)
      const tagType = (metaTag.match(/<(\w+)/) || [])[1];

      if (tagType === "title") {
        // Store title tags with a special 'title' key
        return { ...acc, title: metaTag.trim() };
      }

      if (tagType === "link") {
        // Handle different types of link tags properly
        const relMatch = metaTag.match(/rel="([^"]+)"/);
        if (relMatch) {
          const relValue = relMatch[1];
          // Use rel attribute value as the key for proper deduplication
          return { ...acc, [`link-${relValue}`]: metaTag.trim() };
        }
        // Fallback for link tags without rel attribute
        return { ...acc, 'link-other': metaTag.trim() };
      }

      // Handle meta tags by extracting their 'name' or 'property' attribute values
      // These attributes identify the specific type of metadata (e.g., "description", "og:title")
      const nameMatch = metaTag.match(/name="([^"]+)"/); // Standard meta tags use 'name'
      const propertyMatch = metaTag.match(/property="([^"]+)"/); // Open Graph tags use 'property'
      const tagPropertyValue = nameMatch ? nameMatch[1] : (propertyMatch ? propertyMatch[1] : null);

      if (tagPropertyValue) {
        // Store the meta tag using its identifier as the key for easy lookup
        // This allows us to find and replace specific metadata types
        return { ...acc, [tagPropertyValue]: metaTag.trim() };
      }
      return acc; // Skip tags without identifiable attributes
    }, {}); // Initialize as empty object

    // Create a comprehensive approach to metadata merging with AGGRESSIVE deduplication
    // This ensures NO duplicates by completely rebuilding the head section
    const newHeadStrings: string[] = [];
    const addedMetadataKeys = new Set<string>();

    // First, add all non-metadata tags (scripts, styles, other tags)
    for (const line of headStrings) {
      const isTitle = line.includes("<title>");
      const isMeta = line.includes("<meta") && (line.includes('name="') || line.includes('property="'));
      const isLink = line.includes("<link rel=");
      // Use a robust regex to match rel="stylesheet" anywhere in the tag, case-insensitive
      const isStylesheet = isLink && /rel\s*=\s*"stylesheet"/i.test(line);
      const isPreload = isLink && /rel\s*=\s*"preload"/i.test(line);
      const isIcon = isLink && /rel\s*=\s*"icon"/i.test(line);
      const isManifest = isLink && /rel\s*=\s*"manifest"/i.test(line);
      if (!isTitle && !isMeta && !isLink) {
        newHeadStrings.push(line);
      } else if (isStylesheet) {
        // Always preserve ALL stylesheet links, do not deduplicate
        console.log(`[vite-ssg] Preserving <link rel=\"stylesheet\"> tag:`, line);
        newHeadStrings.push(line);
      } else if (isPreload || isIcon || isManifest) {
        newHeadStrings.push(line);
      }
    }

    // Create a comprehensive list of all possible metadata keys to prevent ANY duplicates
    const allPossibleMetaKeys = new Set([
      'description', 'og:description', 'twitter:description',
      'og:title', 'twitter:title',
      'og:url', 'twitter:url',
      'og:image', 'twitter:image',
      'og:image:alt', 'twitter:image:alt',
      'og:type', 'og:site_name', 'twitter:site',
      'twitter:creator', 'twitter:card',
      'viewport', 'theme-color', 'charset'
    ]);

    // Add title first - ONLY from new metadata if available
    if (metaTagLib.title) {
      newHeadStrings.push(metaTagLib.title);
      addedMetadataKeys.add('title');
    }

    // Add ALL meta tags from the new metadata FIRST (prioritize new over old)
    for (const [key, value] of Object.entries(metaTagLib)) {
      if (key !== 'title' && !key.startsWith('link-') && value && value.trim()) {
        newHeadStrings.push(value);
        addedMetadataKeys.add(key);
      }
    }

    // Add ALL link tags from the new metadata FIRST (prioritize new over old)
    for (const [key, value] of Object.entries(metaTagLib)) {
      if (key.startsWith('link-') && value && value.trim()) {
        newHeadStrings.push(value);
        addedMetadataKeys.add(key);
      }
    }

    // Finally, add ONLY original metadata that wasn't replaced AND isn't a known duplicate
    for (const line of headStrings) {
      if (line.includes("<title>")) {
        // Skip all original title tags - we already added the new one or there is none
        continue;
      } else if (line.includes("<meta") && (line.includes('name="') || line.includes('property="'))) {
        const nameMatch = line.match(/name="([^"]+)"/);
        const propertyMatch = line.match(/property="([^"]+)"/);
        const tagPropertyValue = nameMatch ? nameMatch[1] : (propertyMatch ? propertyMatch[1] : null);
        // Only add if we haven't added this metadata key AND it's not a known duplicate-prone key
        if (tagPropertyValue && 
            !addedMetadataKeys.has(tagPropertyValue) && 
            !allPossibleMetaKeys.has(tagPropertyValue)) {
          newHeadStrings.push(line);
          addedMetadataKeys.add(tagPropertyValue);
        }
      } else if (line.includes("<link rel=")) {
        // Always preserve all <link rel="stylesheet"> tags (already handled above)
        const isStylesheet = /rel\s*=\s*"stylesheet"/i.test(line);
        if (isStylesheet) {
          continue;
        }
        const relMatch = line.match(/rel="([^"]+)"/);
        const relValue = relMatch ? relMatch[1] : '';
        const linkKey = relMatch ? `link-${relMatch[1]}` : 'link-other';
        // Only add if we haven't added this link type (for canonical and other metadata links)
        if (!addedMetadataKeys.has(linkKey)) {
          newHeadStrings.push(line);
          addedMetadataKeys.add(linkKey);
        }
      }
    }

    // Reconstruct the complete HTML with merged metadata
    // Extract everything up to and including the <head> tag
    const headOpenTag = urlHtmlContent.slice(0, urlHtmlContent.indexOf('<head>') + 6);
    // Build the new head section with merged metadata
    const newHeadString = headOpenTag + '\n' + newHeadStrings.filter(line => line.trim()).join('\n') + '\n';
    // Combine with the rest of the HTML (from </head> onwards)
    const urlHtmlContentWithMetadata = `${newHeadString}${urlHtmlContent.slice(
      headEndIndex
    )}`;

    // Write the generated HTML file to the build directory
    // Create subdirectory structure if it doesn't exist (for nested routes like /blog/post-name)
    const subDir = path.dirname(url);
    const subDirPath = path.join(config.dest, subDir);
    if (!fs.existsSync(subDirPath)) {
      fs.mkdirSync(subDirPath, { recursive: true }); // Recursively create nested directories
    }
    // Write the final HTML file with complete metadata
    fs.writeFileSync(toBuildPath(url + ".html"), urlHtmlContentWithMetadata);
  });

  // Execute all page generation promises concurrently and clean up
  await Promise.all(vitePromises)
    .then(() => {
      console.log("All static pages generated"); // Success message
      return vite.close(); // Close the Vite server to free resources
    })
    .catch((e) => {
      console.error("Error generating static pages: ", e); // Log any errors during generation
      throw new Error(e); // Re-throw to stop the build process
    });

  // Optional: Replace the main index.html with generated content
  // This is useful when you want the root path to serve generated content instead of the Vite template
  if (config.replaceIndexHtml) {
    // Backup the original index.html as _.html
    fs.renameSync(toBuildPath("index.html", config), toBuildPath("_.html", config));
    // Rename the generated .html (root path) to index.html
    fs.renameSync(toBuildPath(".html", config), toBuildPath("index.html", config));
  }
}

// Utility function to build file paths within the destination directory
// Resolves relative paths to absolute paths within the build output folder
export const toBuildPath = (file: string, config: ConfigProps) =>
  path.resolve(process.cwd(), config.dest, file);

// Main generation function that orchestrates the entire SSG process
// This is the primary entry point for the static site generation
export const generate = async (config?: ConfigProps) => {
  // Configuration file discovery and loading
  // Check for config files in order of preference: TypeScript, JavaScript, JSON
  const configPathTs = path.resolve(process.cwd(), "ssg.config.ts");
  const configPathJs = path.resolve(process.cwd(), "ssg.config.js");
  const configPathJson = path.resolve(process.cwd(), "ssg.config.json");
  const configTsExists = fs.existsSync(configPathTs);
  const configJsExists = fs.existsSync(configPathJs);
  const configJsonExists = fs.existsSync(configPathJson);
  let configuration = config || CONFIG; // Use provided config or default

  if (configTsExists) {
    // TypeScript config files require special handling in ES module projects
    console.warn(`Found ssg.config.ts in an ES module project.`);
    console.warn(`TypeScript config files are not directly supported in ES module projects.`);
    console.warn(`Please rename ssg.config.ts to ssg.config.js or add "type": "commonjs" to your package.json.`);
    configuration = config || CONFIG; // Fall back to default config
  } else if (configJsExists) {
    try {
      // Load JavaScript config using dynamic import for ES module compatibility
      const configFileUrl = pathToFileURL(configPathJs).href;
      const configModule = await import(configFileUrl);
      // Try multiple export patterns: named export, default.config, or default export
      configuration = configModule.config || configModule.default?.config || configModule.default;
    } catch (error) {
      console.warn(`Could not load config from ${configPathJs}:`, error);
      configuration = config || CONFIG; // Fall back to default if loading fails
    }
  } else if (configJsonExists) {
    // Load JSON config file (simplest format)
    const configJson = fs.readFileSync(configPathJson, "utf-8");
    configuration = JSON.parse(configJson);
  }

  // Validate that we have a valid configuration
  if (!configuration) {
    console.error("No configuration found");
    process.exit(1); // Exit with error code
  }

  try {
    // Execute the two-phase generation process
    const urlsData = await genUrls(configuration); // Phase 1: Generate URL list from RSS feed
    await genStatic(urlsData); // Phase 2: Generate static HTML files
  } catch (err) {
    console.error("Error generating static pages: ", err);
    process.exit(1); // Exit with error code if generation fails
  }
};

// Export the generate function as the default export
// This allows the module to be imported and used directly
export default generate;
