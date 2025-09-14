import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cssFile = path.join(__dirname, '../public/css/styles.css')

// Color mappings - old color to CSS variable
const colorMappings = {
  // Backgrounds
  '#ffffff': 'var(--bg-primary)',
  '#fff': 'var(--bg-primary)',
  'white': 'var(--bg-primary)',
  '#f8f9fa': 'var(--bg-secondary)',
  '#e9ecef': 'var(--bg-tertiary)',
  '#f3f4f6': 'var(--bg-secondary)',
  '#f1f3f5': 'var(--bg-tertiary)',

  // Text colors
  '#333': 'var(--text-primary)',
  '#333333': 'var(--text-primary)',
  '#212529': 'var(--text-primary)',
  '#374151': 'var(--text-primary)',
  '#495057': 'var(--text-secondary)',
  '#6c757d': 'var(--text-muted)',
  '#6b7280': 'var(--text-muted)',
  '#9ca3af': 'var(--text-muted)',
  '#666': 'var(--text-secondary)',

  // Brand colors
  '#6366f1': 'var(--primary)',
  '#4f46e5': 'var(--primary-hover)',
  '#10b981': 'var(--success)',
  '#f59e0b': 'var(--warning)',
  '#ef4444': 'var(--danger)',

  // Borders
  '#dee2e6': 'var(--border)',
  '#e5e7eb': 'var(--border)',
  '#d1d5db': 'var(--border)',

  // Specific for activity types
  '#10b981': 'var(--habit-color)',
  '#ef4444': 'var(--quit-color)'
}

// Read the CSS file
let css = fs.readFileSync(cssFile, 'utf8')

// Skip the CSS variables section at the top
const variablesEndIndex = css.indexOf('/* Reset and base styles */')
const beforeVariables = css.substring(0, variablesEndIndex)
let afterVariables = css.substring(variablesEndIndex)

// Replace colors with CSS variables (but not in the variables section itself)
for (const [oldColor, newVar] of Object.entries(colorMappings)) {
  // Create regex that matches the color but not when it's already a CSS variable
  const regex = new RegExp(`(?<!var\\(--[\\w-]*\\))\\b${oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  afterVariables = afterVariables.replace(regex, newVar)
}

// Combine back together
css = beforeVariables + afterVariables

// Write the updated CSS
fs.writeFileSync(cssFile, css, 'utf8')

console.log('✅ CSS variables updated successfully!')