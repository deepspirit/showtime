import { Plugin } from 'vite';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 30
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function imageStitchPlugin(): Plugin {
  return {
    name: 'image-stitch-api',
    configureServer(server) {
      // Health check
      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'ok' }));
      });

      // Stitch images endpoint
      server.middlewares.use('/api/stitch', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (req.method === 'OPTIONS') {
          Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
          res.statusCode = 204;
          res.end();
          return;
        }

        Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
        res.setHeader('Content-Type', 'application/json');

        upload.array('images', 30)(req, res, async (err) => {
          if (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }

          const files = (req as any).files as Express.Multer.File[];
          if (!files || files.length < 2) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'At least 2 images are required' }));
            return;
          }

          try {
            console.log(`[stitch] Processing ${files.length} images...`);

            const processedImages = await Promise.all(
              files.map(async (file) => {
                const metadata = await sharp(file.buffer).metadata();
                return {
                  buffer: file.buffer,
                  width: metadata.width || 0,
                  height: metadata.height || 0,
                };
              })
            );

            const maxWidth = Math.max(...processedImages.map(img => img.width));

            const composites: any[] = [];
            let currentY = 0;

            for (const img of processedImages) {
              const resizedBuffer = await sharp(img.buffer)
                .resize({
                  width: maxWidth,
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .toBuffer();

              const resizedMetadata = await sharp(resizedBuffer).metadata();
              const resizedHeight = resizedMetadata.height || 0;

              composites.push({
                input: resizedBuffer,
                left: 0,
                top: currentY
              });

              currentY += resizedHeight;
            }

            const finalImage = await sharp({
              create: {
                width: maxWidth,
                height: currentY,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
              }
            })
              .composite(composites)
              .png({ quality: 100, compressionLevel: 0 })
              .toBuffer();

            const outputFilename = `stitched_${uuidv4()}.png`;
            const outputPath = path.join(uploadsDir, outputFilename);
            await fs.promises.writeFile(outputPath, finalImage);

            console.log(`[stitch] Saved: ${outputFilename} (${maxWidth}x${currentY})`);

            res.end(JSON.stringify({
              success: true,
              filename: outputFilename,
              path: `/api/download/${outputFilename}`,
              stats: {
                totalImages: files.length,
                outputWidth: maxWidth,
                outputHeight: currentY,
                format: 'PNG (lossless)'
              }
            }));
          } catch (error) {
            console.error('[stitch] Error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({
              success: false,
              error: 'Failed to stitch images',
              details: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
        });
      });

      // Download endpoint
      server.middlewares.use('/api/download', (req, res, next) => {
        const url = req.url || '';
        const filename = url.split('?')[0].replace(/^\//, '');

        if (!filename) {
          return next();
        }

        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        fs.createReadStream(filePath).pipe(res);
      });
    }
  };
}