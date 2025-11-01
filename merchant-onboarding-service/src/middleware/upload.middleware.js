import multer from 'multer';
import { ApiError } from './error.js';
import { StatusCodes } from 'http-status-codes';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    // Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid file type. Only ${allowedExtensions.join(', ')} images are allowed.`
      ), false);
    }
  } else {
    cb(new ApiError(
      StatusCodes.BAD_REQUEST,
      'File must be an image. Only image files are allowed.'
    ), false);
  }
};

// Configure multer
export const uploadImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware for single image upload
export const uploadSingleImage = (fieldName = 'image') => {
  return (req, res, next) => {
    const upload = uploadImage.single(fieldName);
    
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof ApiError) {
          return next(err);
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(
            StatusCodes.BAD_REQUEST,
            'File too large. Maximum file size is 5MB.'
          ));
        }
        return next(new ApiError(
          StatusCodes.BAD_REQUEST,
          `File upload error: ${err.message}`
        ));
      }
      
      if (!req.file) {
        return next(new ApiError(
          StatusCodes.BAD_REQUEST,
          'No image file provided. Please upload an image file.'
        ));
      }
      
      next();
    });
  };
};

// Validate image file magic numbers for additional security
export function validateImageFile(buffer) {
  // Check file magic numbers (first few bytes)
  const pngMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const jpegMagic = Buffer.from([0xFF, 0xD8, 0xFF]);
  const webpMagic = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
  const gifMagic = Buffer.from([0x47, 0x49, 0x46, 0x38]); // GIF8
  
  const fileHeader = buffer.slice(0, 12);
  
  const isValidPNG = fileHeader.slice(0, 8).equals(pngMagic);
  const isValidJPEG = fileHeader.slice(0, 3).equals(jpegMagic);
  const isValidWebP = fileHeader.slice(0, 4).equals(webpMagic) && 
                      fileHeader.slice(8, 12).equals(Buffer.from('WEBP'));
  const isValidGIF = fileHeader.slice(0, 4).equals(gifMagic);
  
  if (!isValidPNG && !isValidJPEG && !isValidWebP && !isValidGIF) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid image file. File must be a valid PNG, JPEG, WebP, or GIF image.'
    );
  }
  
  return true;
}

