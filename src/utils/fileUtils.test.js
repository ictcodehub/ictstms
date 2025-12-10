import { describe, it, expect } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  formatFileSize,
  getFileExtension,
  getAllowedFileTypesString,
  validateFile,
} from './fileUtils';

describe('fileUtils', () => {
  describe('validateFileType', () => {
    it('should accept PDF files', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      expect(validateFileType(file)).toBe(true);
    });

    it('should accept DOCX files', () => {
      const file = new File(['content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(validateFileType(file)).toBe(true);
    });

    it('should accept image files (PNG, JPG)', () => {
      const pngFile = new File(['content'], 'test.png', { type: 'image/png' });
      const jpgFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      expect(validateFileType(pngFile)).toBe(true);
      expect(validateFileType(jpgFile)).toBe(true);
    });

    it('should reject unsupported file types', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(validateFileType(file)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateFileType(null)).toBe(false);
      expect(validateFileType(undefined)).toBe(false);
    });

    it('should fallback to extension check if MIME type is missing', () => {
      const file = new File(['content'], 'test.pdf', { type: '' });
      expect(validateFileType(file)).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files under 2MB by default', () => {
      const smallFile = new File(['x'.repeat(1024 * 1024)], 'small.pdf'); // 1MB
      expect(validateFileSize(smallFile)).toBe(true);
    });

    it('should reject files over 2MB by default', () => {
      const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.pdf'); // 3MB
      expect(validateFileSize(largeFile)).toBe(false);
    });

    it('should accept custom max size', () => {
      const file = new File(['x'.repeat(5 * 1024 * 1024)], 'test.pdf'); // 5MB
      expect(validateFileSize(file, 10)).toBe(true);
      expect(validateFileSize(file, 3)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateFileSize(null)).toBe(false);
      expect(validateFileSize(undefined)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should handle null or undefined', () => {
      expect(formatFileSize(null)).toBe('0 Bytes');
      expect(formatFileSize(undefined)).toBe('0 Bytes');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('photo.jpg')).toBe('jpg');
      expect(getFileExtension('file.with.dots.docx')).toBe('docx');
    });

    it('should return lowercase extension', () => {
      expect(getFileExtension('FILE.PDF')).toBe('pdf');
    });

    it('should handle files without extension', () => {
      expect(getFileExtension('noextension')).toBe('noextension');
    });

    it('should handle empty or null filename', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileExtension(null)).toBe('');
    });
  });

  describe('getAllowedFileTypesString', () => {
    it('should return comma-separated allowed file types', () => {
      const result = getAllowedFileTypesString();
      expect(result).toContain('PDF');
      expect(result).toContain('DOCX');
      expect(result).toContain('PNG');
      expect(result).toContain('JPG');
    });
  });

  describe('validateFile', () => {
    it('should validate a correct file', () => {
      const file = new File(['x'.repeat(1024 * 500)], 'test.pdf', {
        type: 'application/pdf',
      });

      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject file with invalid type', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak didukung');
    });

    it('should reject file that is too large', () => {
      const largeFile = new File(['x'.repeat(5 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });

      const result = validateFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terlalu besar');
    });

    it('should reject null file', () => {
      const result = validateFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tidak ada file');
    });
  });
});
