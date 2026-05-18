import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { preloadBibleData } from './lib/preloadBible'

// Kick off Bible data pre-warming immediately — before React even renders.
// This gives kjv.json the longest possible head-start so it is already in
// the service-worker CacheFirst runtime cache by the time the user opens
// the Bible reader, making it load instantly even when offline.
preloadBibleData()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
