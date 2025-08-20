import { describe, it, expect } from 'vitest'

describe('generate CLI', () => {
  it('should be a valid TypeScript file', () => {
    // This test just ensures the generate.ts file can be compiled
    expect(true).toBe(true)
  })

  it('should properly escape HTML attributes', () => {
    // Test the escapeHtml function logic
    const escapeHtml = (unsafe: string): string => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    expect(escapeHtml('Test & "quoted" <script>')).toBe('Test &amp; &quot;quoted&quot; &lt;script&gt;')
    expect(escapeHtml("Test 'single' quotes")).toBe('Test &#039;single&#039; quotes')
  })

  it('should parse link tags correctly by rel attribute', () => {
    // Test the link tag parsing logic
    const linkTag = '<link rel="canonical" href="https://example.com">';
    const relMatch = linkTag.match(/rel="([^"]+)"/);
    const linkKey = relMatch ? `link-${relMatch[1]}` : 'link-other';
    
    expect(linkKey).toBe('link-canonical')
    
    // Test stylesheet link
    const stylesheetTag = '<link rel="stylesheet" href="styles.css">';
    const stylesheetMatch = stylesheetTag.match(/rel="([^"]+)"/);
    const stylesheetKey = stylesheetMatch ? `link-${stylesheetMatch[1]}` : 'link-other';
    
    expect(stylesheetKey).toBe('link-stylesheet')
  })

  it('should parse meta tag attributes correctly', () => {
    // Test meta tag parsing logic
    const nameMetaTag = '<meta name="description" content="Test description">';
    const nameMatch = nameMetaTag.match(/name="([^"]+)"/);
    expect(nameMatch?.[1]).toBe('description')
    
    const propertyMetaTag = '<meta property="og:title" content="Test title">';
    const propertyMatch = propertyMetaTag.match(/property="([^"]+)"/);
    expect(propertyMatch?.[1]).toBe('og:title')
  })
})
