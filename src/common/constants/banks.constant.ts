/**
 * 한국 은행 코드 목록 (토스페이먼츠 기준)
 * @see https://docs.tosspayments.com/codes/org-codes
 */

export interface Bank {
  code: string;
  name: string;
}

export const BANKS: Bank[] = [
  // 시중은행
  { code: '06', name: 'KB국민은행' },
  { code: '88', name: '신한은행' },
  { code: '20', name: '우리은행' },
  { code: '81', name: '하나은행' },
  { code: '03', name: 'IBK기업은행' },
  { code: '11', name: 'NH농협은행' },
  { code: '23', name: 'SC제일은행' },
  { code: '27', name: '씨티은행' },
  { code: '02', name: '한국산업은행' },

  // 인터넷은행
  { code: '90', name: '카카오뱅크' },
  { code: '89', name: '케이뱅크' },
  { code: '92', name: '토스뱅크' },

  // 지방은행
  { code: '31', name: 'iM뱅크' },
  { code: '32', name: '부산은행' },
  { code: '34', name: '광주은행' },
  { code: '35', name: '제주은행' },
  { code: '37', name: '전북은행' },
  { code: '39', name: '경남은행' },

  // 특수은행 및 기타
  { code: '07', name: 'Sh수협은행' },
  { code: '12', name: '단위농협' },
  { code: '45', name: '새마을금고' },
  { code: '48', name: '신협' },
  { code: '50', name: '저축은행' },
  { code: '64', name: '산림조합' },
  { code: '71', name: '우체국' },
];

/**
 * 은행코드로 은행명 조회
 */
export function getBankNameByCode(code: string): string | null {
  const bank = BANKS.find((b) => b.code === code);
  return bank?.name ?? null;
}
