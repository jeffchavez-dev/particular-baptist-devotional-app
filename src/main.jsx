import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Bible data files (kjv.json, abab.json, etc.) are precached by the service
// worker during PWA installation — no runtime preloading required.
// The app shell and all Bible data are served from cache on every open.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
