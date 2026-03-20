import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/chat': '/.netlify/functions/chat',
      '/exam-solve': '/.netlify/functions/exam-solve',
      '/process-document': '/.netlify/functions/process-document',
      '/process-document-background': '/.netlify/functions/process-document-background',
      '/list-files': '/.netlify/functions/list-files',
      '/get-upload-url': '/.netlify/functions/get-upload-url',
      '/warm': '/.netlify/functions/warm',
      '/pyq-intelligence': '/.netlify/functions/pyq-intelligence',
    }
  }
})
