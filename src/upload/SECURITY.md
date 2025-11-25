# Upload Security Documentation

## Overview
This document describes the security measures implemented in the file upload system to prevent various attack vectors.

## Security Measures

### 1. File Type Validation (Multi-Layer)

#### MIME Type Whitelist
- Only allows specific image MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
- Validated at both Multer middleware and service layer

#### File Extension Validation
- Whitelist approach: Only `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` extensions allowed
- Case-insensitive validation
- Extension must match the declared MIME type

#### Magic Byte Verification
- Reads actual file content to verify file signatures
- Checks magic bytes/file headers:
  - JPEG: `0xFF 0xD8 0xFF`
  - PNG: `0x89 0x50 0x4E 0x47`
  - GIF: `0x47 0x49 0x46`
  - WebP: `RIFF` header with `WEBP` identifier
- Prevents disguised files (e.g., PHP files renamed to .jpg)

### 2. Filename Security

#### Dangerous Pattern Detection
- Blocks double extensions (e.g., `.jpg.php`, `.png.exe`)
- Maintains blacklist of dangerous extensions:
  - Script files: `php`, `jsp`, `asp`, `py`, `pl`, `cgi`
  - Executables: `exe`, `sh`, `bat`, `cmd`, `jar`
  - Web files: `html`, `js`, `svg`, `xml`
  - Config files: `htaccess`, `htpasswd`

#### Path Traversal Prevention
- Validates filenames don't contain path separators (`/`, `\`)
- Blocks relative path indicators (`..`)
- Uses `basename()` to extract filename only
- Validates resolved paths stay within upload directory

#### Null Byte Prevention
- Blocks filenames containing null bytes (`\0`)
- Prevents null byte injection attacks

#### Safe Filename Generation
- Generates cryptographically random filenames using `crypto.randomBytes(16)`
- Format: `32-character-hex-string.extension`
- Original filename stored in database only

### 3. File Size Limits

- Maximum file size: 10MB
- Minimum file size: 1 byte (prevents empty files)
- Configured at both Multer and service levels

### 4. Upload Restrictions

- Single file upload only (no batch uploads)
- Field name size limited to 100 characters
- Field size limited to 1MB

### 5. Storage Security

- Files stored with random names, not original names
- Upload directory outside web root recommended
- File permissions should be set appropriately (644)

## Attack Scenarios Prevented

### 1. PHP/Script Upload Attacks
**Attack**: Uploading `malicious.php` renamed to `malicious.jpg`
**Prevention**: 
- Magic byte verification detects PHP content
- File rejected even with image extension

### 2. Double Extension Attacks
**Attack**: Uploading `image.jpg.php` hoping server executes PHP
**Prevention**: 
- Double extension detection
- Dangerous extension blacklist

### 3. Path Traversal Attacks
**Attack**: Filename like `../../../etc/passwd`
**Prevention**: 
- Path characters blocked
- Basename extraction
- Realpath validation

### 4. MIME Type Spoofing
**Attack**: Setting `image/jpeg` MIME type for non-image file
**Prevention**: 
- MIME type must match extension
- Magic byte verification ensures actual content matches

### 5. Null Byte Injection
**Attack**: Filename like `image.jpg\0.php`
**Prevention**: 
- Null byte detection and rejection

## Configuration

All security settings are centralized in `upload.security.config.ts`:

```typescript
// Allowed MIME types and extensions
allowedMimeTypes: Map<string, string[]>

// File size limits
limits: {
  maxFileSize: 10MB
  minFileSize: 1 byte
}

// Dangerous extensions blacklist
dangerousExtensions: string[]

// File signatures for verification
fileSignatures: Map<string, number[]>
```

## Best Practices

1. **Never trust user input**: Always validate both filename and content
2. **Use defense in depth**: Multiple validation layers
3. **Fail securely**: Reject suspicious files rather than trying to sanitize
4. **Log security events**: Track rejected uploads for monitoring
5. **Regular updates**: Keep security patterns and blacklists updated

## Testing

Run security tests:
```bash
npm test upload.service.spec.ts
```

The test suite includes:
- Double extension detection
- MIME type mismatch detection
- Path traversal prevention
- File signature verification
- Size limit enforcement

## Future Enhancements

1. **Virus Scanning**: Integrate with ClamAV or similar
2. **Image Processing**: Re-encode images to remove embedded scripts
3. **Rate Limiting**: Prevent upload flooding
4. **Watermarking**: Add watermarks to uploaded images
5. **CDN Integration**: Serve files through CDN with proper headers