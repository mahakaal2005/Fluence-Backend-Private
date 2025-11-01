import { initializeFirebase } from './firebase.service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload image to Firebase Storage
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The desired file name
 * @param {string} folder - The folder path in Firebase Storage (e.g., 'merchant-profiles')
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export async function uploadImageToFirebase(fileBuffer, fileName, folder = 'merchant-profiles') {
  try {
    const admin = initializeFirebase();
    const bucket = admin.storage().bucket();
    
    // Generate unique filename
    const uniqueFileName = `${folder}/${uuidv4()}-${fileName}`;
    
    // Create file reference
    const file = bucket.file(uniqueFileName);
    
    // Upload file
    const stream = file.createWriteStream({
      metadata: {
        contentType: `image/${getFileExtension(fileName)}`,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      },
      public: true, // Make file publicly accessible
      validation: 'md5'
    });
    
    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(new Error(`Failed to upload image: ${error.message}`));
      });
      
      stream.on('finish', async () => {
        try {
          // Make file publicly accessible
          await file.makePublic();
          
          // Get public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
          resolve(publicUrl);
        } catch (error) {
          console.error('Error making file public:', error);
          reject(new Error(`Failed to get public URL: ${error.message}`));
        }
      });
      
      stream.end(fileBuffer);
    });
  } catch (error) {
    console.error('Firebase Storage service error:', error);
    throw new Error(`Failed to upload image to Firebase Storage: ${error.message}`);
  }
}

/**
 * Delete image from Firebase Storage
 * @param {string} imageUrl - The public URL of the image to delete
 * @returns {Promise<void>}
 */
export async function deleteImageFromFirebase(imageUrl) {
  try {
    if (!imageUrl) {
      return; // No image to delete
    }
    
    const admin = initializeFirebase();
    const bucket = admin.storage().bucket();
    
    // Extract file path from URL
    // URL format: https://storage.googleapis.com/{bucket-name}/{path/to/file.jpg}
    // or: https://firebasestorage.googleapis.com/v0/b/{bucket-name}/o/{encoded-path}?alt=media
    
    let filePath = null;
    
    // Handle storage.googleapis.com URLs
    if (imageUrl.includes('storage.googleapis.com')) {
      const urlParts = imageUrl.split('storage.googleapis.com/');
      if (urlParts.length === 2) {
        const pathAfterDomain = urlParts[1];
        // Remove bucket name from the start
        const bucketName = bucket.name;
        if (pathAfterDomain.startsWith(bucketName + '/')) {
          filePath = pathAfterDomain.substring(bucketName.length + 1);
        } else {
          // Try to find bucket name in the path
          const pathParts = pathAfterDomain.split('/');
          const bucketIndex = pathParts.findIndex(part => part === bucketName || part.startsWith(bucketName));
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            filePath = pathParts.slice(bucketIndex + 1).join('/');
          }
        }
      }
    }
    // Handle firebasestorage.googleapis.com URLs
    else if (imageUrl.includes('firebasestorage.googleapis.com')) {
      // Extract from firebase storage URL format
      const match = imageUrl.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        filePath = decodeURIComponent(match[1]);
      }
    }
    
    if (!filePath) {
      console.warn('Could not extract file path from URL:', imageUrl);
      return;
    }
    
    const file = bucket.file(filePath);
    
    // Check if file exists and delete
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log('Deleted image from Firebase Storage:', filePath);
    } else {
      console.warn('Image not found in Firebase Storage:', filePath);
    }
  } catch (error) {
    // Log error but don't throw - deletion failures shouldn't break the flow
    console.error('Error deleting image from Firebase Storage:', error);
  }
}

/**
 * Extract file extension from filename
 * @param {string} fileName - The file name
 * @returns {string} - The file extension (without dot)
 */
function getFileExtension(fileName) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg';
}

