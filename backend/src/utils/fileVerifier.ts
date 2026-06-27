import path from 'path';

interface VerificationResult {
  isValid: boolean;
  detectedMime: string;
  error?: string;
}

// Map common magic bytes (signatures) to MIME types
const MAGIC_NUMBERS: { signature: number[]; mask?: number[]; mime: string }[] = [
  { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: 'image/png' },
  { signature: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg' },
  { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: 'image/gif' },
  { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: 'image/gif' },
  { signature: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
  { signature: [0x50, 0x4B, 0x03, 0x04], mime: 'application/zip' }, // also docx, xlsx, etc.
  { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], mime: 'application/x-rar-compressed' },
  { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00], mime: 'application/x-rar-compressed' },
  { signature: [0x4F, 0x67, 0x67, 0x53], mime: 'audio/ogg' },
  { signature: [0x1A, 0x45, 0xDF, 0xA3], mime: 'video/webm' }, // or audio/webm, mkv
  { signature: [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11], mime: 'video/x-ms-asf' },
  { signature: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav' }, // WAV/AVI: starts with RIFF, but we check offset 8 for WAVE/AVI
];

// Dangerous magic bytes/headers
const BLOCKED_SIGNATURES = [
  { signature: [0x4D, 0x5A], mime: 'application/x-msdownload', desc: 'Windows Executable (EXE/DLL/SYS)' },
  { signature: [0x7F, 0x45, 0x4C, 0x46], mime: 'application/x-elf', desc: 'Linux Executable (ELF)' },
  { signature: [0xCA, 0xFE, 0xBA, 0xBE], mime: 'application/java-vm', desc: 'Java Class File' },
  { signature: [0x23, 0x21], mime: 'text/x-shellscript', desc: 'Shell script (#! / Shebang)' }
];

export const verifyFileContent = (
  buffer: Buffer,
  declaredName: string,
  declaredMime: string
): VerificationResult => {
  const extension = path.extname(declaredName).toLowerCase();
  
  // 1. Scan for blocked executables in the magic bytes
  for (const blocked of BLOCKED_SIGNATURES) {
    if (buffer.length >= blocked.signature.length) {
      const match = blocked.signature.every((byte, idx) => buffer[idx] === byte);
      if (match) {
        return {
          isValid: false,
          detectedMime: blocked.mime,
          error: `Security violation: File is identified as a dangerous format (${blocked.desc})`
        };
      }
    }
  }

  // 2. Reject executable extensions to be double-safe
  const dangerousExtensions = [
    '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.bin', '.com', '.msi', 
    '.scr', '.vbs', '.pif', '.cpl', '.gadget', '.jar', '.wsf', '.hta'
  ];
  if (dangerousExtensions.includes(extension)) {
    return {
      isValid: false,
      detectedMime: 'application/octet-stream',
      error: `Security violation: Extension '${extension}' is blocked for security reasons.`
    };
  }

  // 3. Detect file MIME type via Magic Bytes
  let detectedMime = '';
  for (const magic of MAGIC_NUMBERS) {
    if (buffer.length >= magic.signature.length) {
      const match = magic.signature.every((byte, idx) => buffer[idx] === byte);
      if (match) {
        // Special case for RIFF container (WAV or AVI)
        if (magic.mime === 'audio/wav') {
          const riffType = buffer.toString('ascii', 8, 12);
          if (riffType === 'WAVE') {
            detectedMime = 'audio/wav';
          } else if (riffType === 'AVI ') {
            detectedMime = 'video/x-msvideo';
          } else {
            detectedMime = 'application/octet-stream';
          }
        } else {
          detectedMime = magic.mime;
        }
        break;
      }
    }
  }

  // If we can't determine MIME from magic bytes, check if it's text
  if (!detectedMime) {
    // If it's a text/JSON/markdown file, we can inspect if it's printable UTF-8 text
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.css', '.csv'];
    if (textExtensions.includes(extension)) {
      // Basic check for plain-text safety (e.g. no embedded scripts if we want to be strict,
      // but let's at least check that it behaves like text and doesn't contain null bytes)
      const isText = buffer.slice(0, 1024).every(byte => byte === 0x09 || byte === 0x0A || byte === 0x0D || (byte >= 0x20 && byte <= 0x7E) || byte >= 0x80);
      if (isText) {
        detectedMime = 'text/plain';
      }
    }
  }

  // 4. Validate MIME and Extension matches
  // If we detected a specific MIME, make sure it matches the declared MIME and extension family
  if (detectedMime) {
    // Check if there is a severe mismatch
    const detectedGroup = detectedMime.split('/')[0];
    const declaredGroup = declaredMime.split('/')[0];

    // e.g. If magic bytes indicate ZIP but the user claims it's PNG
    if (detectedGroup !== declaredGroup && detectedMime !== 'application/zip') {
      return {
        isValid: false,
        detectedMime,
        error: `MIME type spoofing detected: File magic bytes indicate '${detectedMime}', but declared type is '${declaredMime}'.`
      };
    }
  }

  // 5. Additional sanitization check: check for script injection in SVGs or HTML/XML tags
  // If declared/detected type is text or image/svg, scan for script tags or HTML
  if (
    declaredMime.includes('svg') ||
    declaredMime.includes('html') ||
    extension === '.svg' ||
    extension === '.html'
  ) {
    const content = buffer.toString('utf-8').toLowerCase();
    if (
      content.includes('<script') ||
      content.includes('javascript:') ||
      content.includes('onload=') ||
      content.includes('onerror=')
    ) {
      return {
        isValid: false,
        detectedMime: 'text/html',
        error: 'Security violation: Malicious script tags or event handlers detected in document/image.'
      };
    }
  }

  return {
    isValid: true,
    detectedMime: detectedMime || declaredMime || 'application/octet-stream'
  };
};
