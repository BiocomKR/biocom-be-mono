/**
 * API Key 응답 DTO
 * API Key 정보를 반환할 때 사용하는 DTO
 */
export class ApiKeyResponseDto {
    id: number;

    key: string;

    name: string;

    description: string | null;

    isActive: boolean;

    lastUsedAt: Date | null;

    createdAt: Date;

    updatedAt: Date;
}

/**
 * API Key 목록 응답 DTO
 * 보안을 위해 목록 조회 시에는 key 값을 일부만 노출
 */
export class ApiKeyListResponseDto {
    id: number;

    keyPreview: string;

    name: string;

    description: string | null;

    isActive: boolean;

    lastUsedAt: Date | null;

    createdAt: Date;
}