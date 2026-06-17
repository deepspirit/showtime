import express, { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 30 // Support up to 30 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Stitch images endpoint
router.post('/stitch', upload.array('images', 30), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length < 2) {
      res.status(400).json({ error: 'At least 2 images are required for stitching' });
      return;
    }

    if (files.length > 30) {
      res.status(400).json({ error: 'Maximum 30 images allowed' });
      return;
    }

    console.log(`Processing ${files.length} images for stitching...`);

    // Process and stitch images
    const processedImages = await Promise.all(
      files.map(async (file, index) => {
        const image = sharp(file.buffer);
        const metadata = await image.metadata();
        
        console.log(`Image ${index + 1}: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
        
        return {
          buffer: file.buffer,
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format
        };
      })
    );

    // Find maximum width for consistent stitching
    const maxWidth = Math.max(...processedImages.map(img => img.width));
    
    // Create composites array for Sharp
    const composites = [];
    let currentY = 0;

    for (const img of processedImages) {
      // Resize image to max width if needed (maintains aspect ratio for height)
      const resizeOptions: sharp.ResizeOptions = {
        width: maxWidth,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      };

      const resizedBuffer = await sharp(img.buffer)
        .resize(resizeOptions)
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

    // Create final stitched image
    const finalImage = await sharp({
      create: {
        width: maxWidth,
        height: currentY,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite(composites)
      .png({ quality: 100, compressionLevel: 0 }) // Lossless PNG
      .toBuffer();

    // Save to file
    const outputFilename = `stitched_${uuidv4()}.png`;
    const outputPath = path.join(uploadsDir, outputFilename);
    await fs.promises.writeFile(outputPath, finalImage);

    console.log(`Stitched image saved to ${outputPath}`);

    // Return the file path for download
    res.json({
      success: true,
      filename: outputFilename,
      path: `/api/download/${outputFilename}`,
      stats: {
        totalImages: files.length,
        outputWidth: maxWidth,
        outputHeight: currentY,
        format: 'PNG (lossless)'
      }
    });
  } catch (error) {
    console.error('Error stitching images:', error);
    res.status(500).json({ 
      error: 'Failed to stitch images',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download stitched image
router.get('/download/:filename', async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Clean up old files (call this periodically)
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const files = await fs.promises.readdir(uploadsDir);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.mtimeMs < oneHourAgo) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    }

    res.json({ deletedCount, message: `Cleaned up ${deletedCount} old files` });
  } catch (error) {
    console.error('Error cleaning up files:', error);
    res.status(500).json({ error: 'Failed to clean up files' });
  }
});

export default router;
