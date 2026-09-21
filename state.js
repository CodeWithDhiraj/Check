import { put, list, del } from '@vercel/blob';

const BLOB_PATHNAME = 'profit-rank-data.json';

export default async function handler(req, res) {
  // CORS & Cache control headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify Vercel Blob token is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'BLOB_READ_WRITE_TOKEN_MISSING',
      message: 'Vercel Blob storage is not connected or BLOB_READ_WRITE_TOKEN is missing in environment variables. Connect Blob in the Vercel Dashboard under Storage.'
    });
  }

  /* --------------------------------------------------------------------------
     GET: Load app state from Vercel Blob
     -------------------------------------------------------------------------- */
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
      const targetBlob = blobs.find(b => b.pathname === BLOB_PATHNAME) || blobs[0];

      if (!targetBlob) {
        return res.status(200).json({
          exists: false,
          data: null,
          message: 'No cloud state found yet. First-time initialization needed.'
        });
      }

      // Fetch fresh JSON content directly with cache-busting timestamp
      const response = await fetch(`${targetBlob.url}?t=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to read blob contents: HTTP ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({
        exists: true,
        data,
        url: targetBlob.url,
        lastUpdated: targetBlob.uploadedAt
      });
    } catch (err) {
      console.error('Error fetching state from Vercel Blob:', err);
      return res.status(500).json({
        error: 'BLOB_READ_FAILED',
        message: err.message || 'Error reading data from Vercel Blob'
      });
    }
  }

  /* --------------------------------------------------------------------------
     POST: Persist app state into Vercel Blob
     -------------------------------------------------------------------------- */
  if (req.method === 'POST') {
    try {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch (e) {
          return res.status(400).json({ error: 'INVALID_JSON', message: 'Payload must be valid JSON' });
        }
      }

      if (!bodyData || typeof bodyData !== 'object') {
        return res.status(400).json({ error: 'EMPTY_PAYLOAD', message: 'No valid data provided to save' });
      }

      const jsonString = JSON.stringify(bodyData, null, 2);

      const blob = await put(BLOB_PATHNAME, jsonString, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json'
      });

      return res.status(200).json({
        success: true,
        url: blob.url,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error writing state to Vercel Blob:', err);
      return res.status(500).json({
        error: 'BLOB_WRITE_FAILED',
        message: err.message || 'Error saving data to Vercel Blob'
      });
    }
  }

  /* --------------------------------------------------------------------------
     DELETE: Remove stored state blob from Vercel Blob
     -------------------------------------------------------------------------- */
  if (req.method === 'DELETE') {
    try {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
      const targetBlob = blobs.find(b => b.pathname === BLOB_PATHNAME) || blobs[0];

      if (targetBlob) {
        await del(targetBlob.url);
      }

      return res.status(200).json({
        success: true,
        message: 'Cloud state blob deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting state from Vercel Blob:', err);
      return res.status(500).json({
        error: 'BLOB_DELETE_FAILED',
        message: err.message || 'Error deleting data from Vercel Blob'
      });
    }
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` });
}
