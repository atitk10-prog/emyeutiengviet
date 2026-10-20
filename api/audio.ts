import { VercelApiRequest, VercelApiResponse } from './helpers/types.js';
import { getDb } from './helpers/firebaseAdmin.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * EM YÊU TIẾNG VIỆT - AUDIO STREAMING SERVICE
 * Streams lesson audio files on Vercel Production.
 * Supports:
 * 1. Dynamic audio chunks stored in Cloud Firestore (collection: audioStorage)
 * 2. Static audio files pre-packaged in web/public/audio/uploads/
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
  const targetId = (typeof id === 'string' ? id : (typeof file === 'string' ? file.replace(/\.wav$/i, '') : '')).trim();

  if (!targetId) {
    res.status(400).json({ success: false, message: 'Thiếu định danh file âm thanh (id hoặc file).' });
    return;
  }

  try {
    const db = getDb();
    const fileDoc = await db.collection('audioStorage').doc(targetId).get();

    if (fileDoc.exists) {
      const fData = fileDoc.data()!;
      const chunksSnap = await fileDoc.ref.collection('chunks').orderBy('chunkIndex', 'asc').get();

      if (!chunksSnap.empty) {
        let fullBase64 = '';
        chunksSnap.forEach((cDoc) => {
          fullBase64 += cDoc.data().data || '';
        });

        const audioBuffer = Buffer.from(fullBase64, 'base64');
        const mimeType = fData.mimeType || 'audio/wav';

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
      path.resolve(__dirname, '../web/public/audio/uploads', `${targetId}.wav`)
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
