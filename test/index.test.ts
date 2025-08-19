import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { 
  defineConfig, 
  genUrls, 
  genStatic, 
  generate, 
  toBuildPath,
  CONFIG,
  type ConfigProps 
} from '../src/index'

// Mock modules
vi.mock('node:fs')
vi.mock('fast-xml-parser', () => ({
  XMLParser: vi.fn(() => ({
    parse: vi.fn()
  }))
}))
vi.mock('vite', () => ({
  createServer: vi.fn(() => Promise.resolve({
    ssrLoadModule: vi.fn(() => Promise.resolve({
      render: vi.fn(() => '<div>Test Content</div>'),
      renderMetadata: vi.fn(() => '<title>Test Title</title>'),
      preload: vi.fn(),
      fetchMetaData: vi.fn(() => ({ metaData: { title: 'Test' } }))
    })),
    close: vi.fn()
  }))
}))

const mockFs = vi.mocked(fs)

describe('defineConfig', () => {
  it('should merge config with defaults', () => {
    const customConfig = {
      dest: 'custom-dist',
      staticPaths: ['/custom'],
      viteServer: {
        server: { port: 4000 }
      }
    } as Partial<ConfigProps>

    const result = defineConfig(customConfig as ConfigProps)

    expect(result.dest).toBe('custom-dist')
    expect(result.staticPaths).toEqual(['/custom'])
    expect(result.viteServer.server?.port).toBe(4000)
    expect(result.viteServer.server?.middlewareMode).toBe(true) // inherited from CONFIG
  })

  it('should preserve default values when not overridden', () => {
    const customConfig = {
      dest: 'custom-dist'
    } as Partial<ConfigProps>

    const result = defineConfig(customConfig as ConfigProps)

    expect(result.urlSrc).toBe(CONFIG.urlSrc)
    expect(result.productionUrlBase).toBe(CONFIG.productionUrlBase)
    expect(result.viteServer.plugins).toBeDefined()
  })
})

describe('genUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse RSS and generate URLs', async () => {
    const mockRssXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Test Post 1</title>
            <link>https://example.com/blog/test-post-1.md</link>
          </item>
          <item>
            <title>Test Post 2</title>
            <link>https://example.com/blog/test-post-2.md</link>
          </item>
        </channel>
      </rss>
    `

    mockFs.readFileSync.mockReturnValue(mockRssXml)
    
    // Mock the XMLParser properly
    const { XMLParser } = await import('fast-xml-parser')
    const mockParserInstance = {
      parse: vi.fn().mockReturnValue({
        rss: {
          channel: {
            lenth: 1,
            item: [
              { title: 'Test Post 1', link: 'https://example.com/blog/test-post-1.md' },
              { title: 'Test Post 2', link: 'https://example.com/blog/test-post-2.md' }
            ]
          }
        }
      })
    }
    vi.mocked(XMLParser).mockImplementation(() => mockParserInstance as any)

    const config = {
      ...CONFIG,
      staticPaths: ['/home', '/about'],
      pathsBuilder: (items: any[]) => items.map(item => `/blog/${item.link.split('/').pop()?.replace('.md', '')}`)
    }

    const result = await genUrls(config)

    expect(result.urls).toEqual([
      '/home',
      '/about',
      '/blog/test-post-1',
      '/blog/test-post-2'
    ])
  })

  it('should handle single RSS item', async () => {
    const mockRssXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Single Post</title>
            <link>https://example.com/blog/single-post.md</link>
          </item>
        </channel>
      </rss>
    `

    mockFs.readFileSync.mockReturnValue(mockRssXml)
    
    const { XMLParser } = await import('fast-xml-parser')
    const mockParserInstance = {
      parse: vi.fn().mockReturnValue({
        rss: {
          channel: {
            lenth: 1,
            item: { title: 'Single Post', link: 'https://example.com/blog/single-post.md' }
          }
        }
      })
    }
    vi.mocked(XMLParser).mockImplementation(() => mockParserInstance as any)

    const config = {
      ...CONFIG,
      staticPaths: ['/'],
      pathsBuilder: (items: any[]) => items.map(item => `/blog/${item.link.split('/').pop()?.replace('.md', '')}`)
    }

    const result = await genUrls(config)

    expect(result.urls).toEqual([
      '/',
      '/blog/single-post'
    ])
  })

  it('should handle empty staticPaths', async () => {
    const mockRssXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Test Post</title>
            <link>https://example.com/blog/test-post.md</link>
          </item>
        </channel>
      </rss>
    `

    mockFs.readFileSync.mockReturnValue(mockRssXml)
    
    const { XMLParser } = await import('fast-xml-parser')
    const mockParserInstance = {
      parse: vi.fn().mockReturnValue({
        rss: {
          channel: {
            lenth: 1,
            item: { title: 'Test Post', link: 'https://example.com/blog/test-post.md' }
          }
        }
      })
    }
    vi.mocked(XMLParser).mockImplementation(() => mockParserInstance as any)

    const config = {
      ...CONFIG,
      staticPaths: [],
      pathsBuilder: (items: any[]) => items.map(item => `/blog/${item.link.split('/').pop()?.replace('.md', '')}`)
    }

    const result = await genUrls(config)

    expect(result.urls).toEqual(['/blog/test-post'])
  })
})

describe('toBuildPath', () => {
  it('should create correct build path', () => {
    const config = { ...CONFIG, dest: 'dist' }
    const result = toBuildPath('index.html', config)
    
    expect(result).toBe(path.resolve(process.cwd(), 'dist', 'index.html'))
  })

  it('should handle nested paths', () => {
    const config = { ...CONFIG, dest: 'build' }
    const result = toBuildPath('blog/post.html', config)
    
    expect(result).toBe(path.resolve(process.cwd(), 'build', 'blog/post.html'))
  })
})

describe('genStatic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.readFileSync.mockReturnValue('<html><head></head><body><div id="root"></div></body></html>')
    mockFs.writeFileSync.mockImplementation(() => {})
    mockFs.existsSync.mockReturnValue(true)
    mockFs.mkdirSync.mockImplementation(() => undefined)
    
    // Mock dynamic import for metadata files
    vi.doMock(path.resolve(process.cwd(), 'src/meta.ts'), () => ({
      default: {
        title: 'Mock Meta Title',
        description: 'Mock Description'
      }
    }))
  })

  it('should generate static pages for all URLs', async () => {
    const config = {
      ...CONFIG,
      dest: 'dist',
      staticPaths: ['/'],
      staticMetaData: ['src/meta.ts']
    }

    const urls = ['/']

    await genStatic({ config, urls })

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('dist/.html'),
      expect.stringContaining('<div id="root"><div>Test Content</div></div>')
    )
  })

  it('should create directories for nested paths', async () => {
    const config = {
      ...CONFIG,
      dest: 'dist',
      staticPaths: ['/blog/post'],
      staticMetaData: ['src/meta.ts']
    }

    const urls = ['/blog/post']
    mockFs.existsSync.mockReturnValue(false)

    await genStatic({ config, urls })

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('dist/blog'),
      { recursive: true }
    )
  })

  it('should handle replaceIndexHtml option', async () => {
    const config = {
      ...CONFIG,
      dest: 'dist',
      staticPaths: ['/'],
      staticMetaData: ['src/meta.ts'],
      replaceIndexHtml: true
    }

    const urls = ['/']
    mockFs.renameSync.mockImplementation(() => {})

    await genStatic({ config, urls })

    expect(mockFs.renameSync).toHaveBeenCalledTimes(2)
  })
})

describe('generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.existsSync.mockReturnValue(false)
    mockFs.mkdirSync.mockImplementation(() => undefined)
    mockFs.writeFileSync.mockImplementation(() => {})
    
    // Mock process.exit to prevent actual exit
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit called with code ${code}`)
    })
    
    // Mock dynamic imports for metadata files
    vi.doMock(path.resolve(process.cwd(), 'src/App/meta.ts'), () => ({
      default: { title: 'Mock App Title' }
    }))
    vi.doMock(path.resolve(process.cwd(), 'src/pages/Blog/meta.ts'), () => ({
      default: { title: 'Mock Blog Title' }
    }))
  })

  it('should use default config when no config file exists', async () => {
    const mockRssXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Test Post</title>
            <link>https://example.com/blog/test.md</link>
          </item>
        </channel>
      </rss>
    `

    mockFs.readFileSync.mockReturnValue(mockRssXml)
    
    const { XMLParser } = await import('fast-xml-parser')
    const mockParserInstance = {
      parse: vi.fn().mockReturnValue({
        rss: {
          channel: {
            lenth: 1,
            item: { title: 'Test Post', link: 'https://example.com/blog/test.md' }
          }
        }
      })
    }
    vi.mocked(XMLParser).mockImplementation(() => mockParserInstance as any)

    await expect(generate()).resolves.not.toThrow()
  })

  it('should handle errors properly', async () => {
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('File read error')
    })

    await expect(generate()).rejects.toThrow('process.exit called with code 1')
  })
})
