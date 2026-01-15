/**
 * ProductFile -> images 배열 변환 유틸리티
 *
 * DB 구조: Product -> ProductFile -> File
 * 앱 기대 구조: Product -> images[{ imageUrl, imageType }]
 */

interface ProductFileWithFile {
  id?: number;
  file: {
    filePath: string;
  };
  imageType?: string;
  sortOrder?: number;
  altText?: string;
}

interface ProductImage {
  id?: number;
  imageUrl: string;
  imageType?: string;
  sortOrder?: number;
  altText?: string;
}

/**
 * productFiles 배열을 images 배열로 변환
 */
export function transformProductFiles(productFiles: ProductFileWithFile[]): ProductImage[] {
  if (!productFiles || productFiles.length === 0) {
    return [];
  }

  return productFiles.map(pf => ({
    ...(pf.id && { id: pf.id }),
    imageUrl: pf.file.filePath,
    ...(pf.imageType && { imageType: pf.imageType }),
    ...(pf.sortOrder !== undefined && { sortOrder: pf.sortOrder }),
    ...(pf.altText && { altText: pf.altText }),
  }));
}

/**
 * product 객체의 productFiles를 images로 변환하여 새 객체 반환
 * productFiles 필드는 제거됨
 */
export function transformProductWithImages<T extends { productFiles?: ProductFileWithFile[] }>(
  product: T
): Omit<T, 'productFiles'> & { images: ProductImage[] } {
  const { productFiles, ...rest } = product;
  return {
    ...rest,
    images: transformProductFiles(productFiles || []),
  };
}
