/**
 * 파일 업로드 보안 설정
 */
export const UploadSecurityConfig = {
  // 허용된 이미지 MIME 타입과 확장자 매핑
  allowedMimeTypes: new Map([
    ['image/jpeg', ['.jpg', '.jpeg']],
    ['image/jpg', ['.jpg', '.jpeg']],
    ['image/png', ['.png']],
    ['image/gif', ['.gif']],
    ['image/webp', ['.webp']]
  ]),

  // 허용된 확장자 목록
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],

  // 위험한 확장자 블랙리스트
  dangerousExtensions: [
    'php', 'php3', 'php4', 'php5', 'php7', 'phtml',
    'exe', 'sh', 'bat', 'cmd', 'com', 'jar',
    'jsp', 'asp', 'aspx', 'py', 'pl', 'cgi',
    'js', 'vbs', 'wsf', 'ps1',
    'html', 'htm', 'xhtml', 'svg', 'xml',
    'htaccess', 'htpasswd'
  ],

  // 파일 크기 제한
  limits: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    minFileSize: 1, // 1 byte (빈 파일 방지)
    maxFileNameLength: 255,
    maxFieldNameSize: 100,
    maxFieldSize: 1024 * 1024, // 1MB
    maxFiles: 1 // 한 번에 하나의 파일만
  },

  // 매직 바이트 시그니처 (파일의 실제 타입 검증용)
  fileSignatures: new Map([
    ['jpg', [0xFF, 0xD8, 0xFF]],
    ['png', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    ['gif', [0x47, 0x49, 0x46]],
    ['webp', [0x52, 0x49, 0x46, 0x46]] // RIFF header for WebP
  ]),

  // 에러 메시지
  errorMessages: {
    fileNotFound: '파일이 업로드되지 않았습니다.',
    invalidFileType: '허용되지 않은 파일 형식입니다. 허용된 형식: JPG, JPEG, PNG, GIF, WebP',
    invalidExtension: '허용되지 않은 파일 확장자입니다.',
    fileSizeTooLarge: '파일 크기는 10MB를 초과할 수 없습니다.',
    fileSizeTooSmall: '빈 파일은 업로드할 수 없습니다.',
    fileNameTooLong: '파일명이 너무 깁니다. 255자 이하로 설정해주세요.',
    invalidFileName: '유효하지 않은 파일명입니다.',
    pathTraversal: '파일명에 경로 문자를 포함할 수 없습니다.',
    dangerousPattern: '보안상 위험한 파일명 패턴이 감지되었습니다.',
    mimeTypeMismatch: '파일 확장자와 MIME 타입이 일치하지 않습니다.',
    invalidSignature: '파일 내용이 선언된 형식과 일치하지 않습니다. 보안상의 이유로 업로드가 거부되었습니다.',
    doubleExtension: '이중 확장자는 허용되지 않습니다.',
  },

  // 안전한 파일명 패턴 (32자리 hex + 확장자)
  safeFileNamePattern: /^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp)$/i,
};