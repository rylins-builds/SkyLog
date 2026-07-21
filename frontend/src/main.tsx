/**
 * SkyLog Application Entry Point
 *
 * This file is the JavaScript/TypeScript entry point for the Vite build.
 * It mounts the root React component (<App />) into the DOM element
 * with id="root" (defined in index.html) and applies global styles.
 *
 * React StrictMode is enabled during development to help detect
 * potential problems (side-effects in render, unsafe lifecycle methods,
 * etc.) but does not affect the production bundle.
 *
 * @module main
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getThemeMode } from './api/theme'

/**
 * Apply the persisted theme before rendering so there is no flash
 * of the wrong colour scheme.
 */
applyTheme(getThemeMode());

/**
 * Mount the root <App /> component inside React StrictMode.
 * StrictMode enables additional development checks (e.g. double-rendering
 * to detect side-effects) but does not affect the production build.
 *
 * The `!` non-null assertion is safe here because index.html is
 * guaranteed to have a `<div id="root">` element — Vite's default
 * template ensures this.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
