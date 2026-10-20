import { VercelApiRequest, VercelApiResponse } from './_helpers/types.js';
import { getDb } from './_helpers/firebaseAdmin.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * EM YÊU TIẾNG VIỆT - AUDIO STREAMING SERVICE
 * Streams lesson audio files on Vercel Production.
 * Supports:
 * 1. Dynamic audio chunks stored in Cloud Firestore (collection: audioStorage)
 * 2. Static audio files pre-packaged in web/public/audio/uploads/
 * 3. HTTP 206 Partial Content (Range requests) for Safari/iOS compatibility
 */
export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Range'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }

  const { id, file } = req.query;
  const rawId = (typeof id === 'string' ? id : (typeof file === 'string' ? file.replace(/\.wav$/i, '') : '')).trim();
  const targetId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  if (!targetId) {
    res.status(400).json({ success: false, message: 'Thiếu định danh file âm thanh hợp lệ (id hoặc file).' });
    return;
  }

  try {
    const db = getDb();
    const fileDoc = await db.collection('audioStorage').doc(targetId).get();

    if (fileDoc.exists) {
      const fData = fileDoc.data()!;
      const chunksSnap = await fileDoc.ref.collection('chunks').orderBy('chunkIndex', 'asc').get();

      if (!chunksSnap.empty) {
        // Validate chunk completeness
        if (fData.chunkCount && chunksSnap.size < fData.chunkCount) {
          throw new Error(`Tệp âm thanh chưa ghi đủ dữ liệu (${chunksSnap.size}/${fData.chunkCount} phần).`);
        }

        let fullBase64 = '';
        chunksSnap.forEach((cDoc) => {
          fullBase64 += cDoc.data().data || '';
        });

        const audioBuffer = Buffer.from(fullBase64, 'base64');
        const mimeType = fData.mimeType || 'audio/wav';

        // Check for Range request (HTTP 206)
        const range = typeof req.headers['range'] === 'string' ? req.headers['range'] : undefined;
        if (range && range.startsWith('bytes=')) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : audioBuffer.length - 1;

          if (start < audioBuffer.length && end < audioBuffer.length && start <= end) {
            const chunksize = end - start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${audioBuffer.length}`);
            res.setHeader('Content-Length', String(chunksize));
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.send(audioBuffer.subarray(start, end + 1));
            return;
          }
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', String(audioBuffer.length));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200).send(audioBuffer);
        return;
      }
    }

    // Fallback: Check local web public directory if bundled
    const candidates = [
      path.resolve(process.cwd(), 'web/public/audio/uploads', `${targetId}.wav`),
      path.resolve(process.cwd(), 'web/public/audio/uploads', typeof file === 'string' ? file : `${targetId}.wav`),
      path.resolve(process.cwd(), 'public/audio/uploads', `${targetId}.wav`)
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        const buffer = fs.readFileSync(p);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200).send(buffer);
        return;
      }
    }

    res.status(404).json({
      success: false,
      message: `Không tìm thấy file âm thanh "${targetId}".`
    });
  } catch (err: any) {
    console.error('[API Audio Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi phát âm thanh: ' + (err.message || 'Lỗi máy chủ.')
    });
  }
}
