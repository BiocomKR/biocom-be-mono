// /**
//  * 관리자 API 성공 응답 기본 DTO
//  */
// export class ManagementSuccessResponseDto {
//     success: boolean;
// 
//     message: string;
// 
//     timestamp?: Date;
// }
// 
// /**
//  * 관리자 API 목록 조회 페이지네이션 응답 DTO
//  */
// export class ManagementPaginatedResponseDto<T = any> {
//     items: T[];
// 
//     total: number;
// 
//     page: number;
// 
//     limit: number;
// 
//     totalPages: number;
// }
// 
// /**
//  * 배송 목록 항목 DTO
//  */
// export class ShippingListItemDto {
//     id: number;
// 
//     orderNumber: string;
// 
//     customerName: string;
// 
//     customerEmail: string;
// 
//     recipientName: string;
// 
//     recipientPhone: string;
// 
//     courierCode: string;
// 
//     courierName: string;
// 
//     trackingNumber: string;
// 
//     status: string;
// 
//     shippingFee: number;
// 
//     shippedAt: Date | null;
// 
//     deliveredAt: Date | null;
// 
//     createdAt: Date;
// }
// 
// /**
//  * 환불 목록 항목 DTO
//  */
// export class RefundListItemDto {
//     id: number;
// 
//     orderNumber: string;
// 
//     customerName: string;
// 
//     customerEmail: string;
// 
//     customerMobile: string;
// 
//     refundType: string;
// 
//     status: string;
// 
//     refundAmount: number;
// 
//     reason: string;
// 
//     reasonDetail: string | null;
// 
//     paymentMethod: string | null;
// 
//     pgProvider: string;
// 
//     requestedAt: Date;
// 
//     completedAt: Date | null;
// 
//     rejectedAt: Date | null;
// }
// 
// /**
//  * 배송 운송장 등록 응답 DTO
//  */
// export class RegisterTrackingResponseDto extends ManagementSuccessResponseDto {
//     trackingNumber: string;
// }
// 
// /**
//  * 환불 승인 응답 DTO
//  */
// export class ApproveRefundResponseDto extends ManagementSuccessResponseDto {
//     refundId: number;
// }
// 
// /**
//  * 환불 거절 응답 DTO
//  */
// export class RejectRefundResponseDto extends ManagementSuccessResponseDto {
//     refundId: number;
// 
//     reason: string;
// }
// 
// /**
//  * 배송 일괄 처리 결과 DTO
//  */
// export class BatchShippingResultDto {
//     total: number;
// 
//     success: number;
// 
//     failed: number;
// 
//     results: Array<{
//     orderNumber: string;
//     success: boolean;
//     error?: string;
//   }>;
// }
// 
// /**
//  * 환불 일괄 처리 결과 DTO
//  */
// export class BatchRefundResultDto {
//     total: number;
// 
//     success: number;
// 
//     failed: number;
// 
//     results: Array<{
//     refundId: number;
//     success: boolean;
//     error?: string;
//   }>;
// }
// 
// /**
//  * 관리자 API 인증 실패 응답 DTO (401)
//  */
// export class ManagementUnauthorizedResponseDto {
//     success: boolean;
// 
//     statusCode: number;
// 
//     message: string;
// 
//     error: string;
// 
//     path: string;
// 
//     timestamp: string;
// }
