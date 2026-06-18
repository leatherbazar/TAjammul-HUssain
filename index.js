/**
 * Firebase Cloud Functions entry point — Tataheer ERP
 * This file exports the Express app as a Cloud Function named "api".
 * Firebase Hosting rewrites /api/** to this function.
 * Static React files are served by Firebase Hosting CDN.
 */
import { onRequest } from 'firebase-functions/v2/https'
import { app } from './server.js'

export const api = onRequest(
  {
    region: 'asia-south1',   // Mumbai — closest to Pakistan
    memory: '512MiB',
    timeoutSeconds: 60,
    concurrency: 80,         // handle 80 simultaneous requests per instance
  },
  app,
)
