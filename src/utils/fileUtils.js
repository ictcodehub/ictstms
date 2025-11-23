// No Firebase Storage imports needed for Base64 conversion
// import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
// import { storage } from '../lib/firebase';

// Allowed file types
const ALLOWED_FILE_TYPES = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/jpg': ['.jpg'],
};

// Reduced max size for Firestore Base64 storage (2MB recommended)
const MAX_FILE_SIZE_MB = 2;

/**
 * Validate if file type is allowed
 * @param {File} file - File object to validate
 * @returns {boolean} - True if file type is allowed
 */
export const validateFileType = (file) => {
    if (!file) return false;

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Check MIME type
    if (ALLOWED_FILE_TYPES[fileType]) {
        return true;
    }

    // Fallback: check file extension
    const extension = '.' + fileName.split('.').pop();
    return Object.values(ALLOWED_FILE_TYPES).some(exts => exts.includes(extension));
};

/**
 * Validate if file size is within limit
 * @param {File} file - File object to validate
 * @param {number} maxSizeMB - Maximum file size in MB (default: 2MB for Firestore)
 * @returns {boolean} - True if file size is valid
 */
export const validateFileSize = (file, maxSizeMB = MAX_FILE_SIZE_MB) => {
    if (!file) return false;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
};

/**
 * Format file size from bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size (e.g., "2.5 MB")
 */
export const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file extension from filename
 * @param {string} filename - Name of the file
 * @returns {string} - File extension (e.g., "pdf")
 */
export const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
};

/**
 * Get allowed file types as string for display
 * @returns {string} - Comma-separated list of allowed extensions
 */
export const getAllowedFileTypesString = () => {
    const extensions = new Set();
    Object.values(ALLOWED_FILE_TYPES).forEach(exts => {
        exts.forEach(ext => extensions.add(ext.toUpperCase()));
    });
    return Array.from(extensions).join(', ');
};

/**
 * Convert file to Base64 string
 * @param {File} file - File to convert
 * @returns {Promise<string>} - Base64 string of the file
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Process file for Firestore storage (convert to Base64)
 * @param {File} file - File to process
 * @param {function} onProgress - Callback function for progress updates (0-100)
 * @returns {Promise<Object>} - Object with Base64 data and metadata
 */
export const processFileForFirestore = async (file, onProgress) => {
    if (!file) {
        throw new Error('No file provided');
    }

    // Validate file
    if (!validateFileType(file)) {
        throw new Error(`Tipe file tidak didukung. Hanya ${getAllowedFileTypesString()}`);
    }

    if (!validateFileSize(file)) {
        throw new Error(`File terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB`);
    }

    // Simulate progress for UX
    if (onProgress) onProgress(10);

    try {
        // Convert to Base64
        const base64Data = await fileToBase64(file);

        if (onProgress) onProgress(90);

        const result = {
            fileData: base64Data,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
        };

        if (onProgress) onProgress(100);

        return result;
    } catch (error) {
        throw new Error('Gagal memproses file: ' + error.message);
    }
};

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateFile = (file) => {
    if (!file) {
        return { valid: false, error: 'Tidak ada file yang dipilih' };
    }

    if (!validateFileType(file)) {
        return {
            valid: false,
            error: `Tipe file tidak didukung. Hanya ${getAllowedFileTypesString()}`
        };
    }

    if (!validateFileSize(file)) {
        return {
            valid: false,
            error: `File terlalu besar. Maksimal ${MAX_FILE_SIZE_MB}MB (ukuran file: ${formatFileSize(file.size)})`
        };
    }

    return { valid: true, error: null };
};
