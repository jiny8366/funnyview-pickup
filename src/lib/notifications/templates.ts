/**
 * 알림 유형별 메시지 템플릿.
 * 카카오 알림톡 templateId 는 비즈채널 콘솔에서 사전 등록 필요.
 * 변수는 채널 발송 시 치환됨.
 */

export type NotificationKind =
  | 'order_received'
  | 'order_shipped'
  | 'order_arrived'
  | 'pickup_ready'
  | 'pickup_completed'
  | 'low_stock'
  | 'order_cancelled'
  | 'pickup_no_show'
  | 'order_returned'
  | 'pickup_reminder';

export interface TemplateRendered {
  title: string;
  body: string;
  // 알림톡 옵션
  kakaoTemplateId?: string;
  kakaoVariables?: Record<string, string>;
}

export interface TemplateContext {
  orderNumber?: string;
  customerName?: string;
  storeName?: string;
  storeAddress?: string;
  amount?: number;
  itemSummary?: string;
  variantLabel?: string;
  availableQty?: number;
  reason?: string;
}

export function renderTemplate(
  kind: NotificationKind,
  ctx: TemplateContext,
): TemplateRendered {
  const orderNo = ctx.orderNumber ?? '';
  const name = ctx.customerName ?? '고객';
  const store = ctx.storeName ?? '';

  switch (kind) {
    case 'order_received':
      return {
        title: '신규 주문',
        body: `[Funnyview Pickup] 신규 주문 ${orderNo} 이(가) 접수되었습니다.`,
        kakaoTemplateId: process.env.KAKAO_TPL_ORDER_RECEIVED,
        kakaoVariables: { '#{orderNumber}': orderNo, '#{customerName}': name },
      };
    case 'order_shipped':
      return {
        title: '배송 시작',
        body: `${name}님, 주문 ${orderNo}이(가) 출고되었습니다. ${store}에서 픽업 가능합니다.`,
        kakaoTemplateId: process.env.KAKAO_TPL_ORDER_SHIPPED,
        kakaoVariables: {
          '#{orderNumber}': orderNo,
          '#{customerName}': name,
          '#{storeName}': store,
        },
      };
    case 'order_arrived':
      return {
        title: '가맹점 입고',
        body: `[${store}] 주문 ${orderNo} 입고되었습니다. 픽업 준비 후 도착알림을 보내주세요.`,
      };
    case 'pickup_ready':
      return {
        title: '픽업 가능',
        body: `${name}님, 주문 ${orderNo}이(가) ${store}에 도착했습니다. 픽업 가능합니다.${ctx.storeAddress ? `\n주소: ${ctx.storeAddress}` : ''}`,
        kakaoTemplateId: process.env.KAKAO_TPL_PICKUP_READY,
        kakaoVariables: {
          '#{orderNumber}': orderNo,
          '#{customerName}': name,
          '#{storeName}': store,
          '#{storeAddress}': ctx.storeAddress ?? '',
        },
      };
    case 'pickup_completed':
      return {
        title: '픽업 완료',
        body: `${name}님, 주문 ${orderNo} 픽업이 완료되었습니다. 이용해주셔서 감사합니다.`,
        kakaoTemplateId: process.env.KAKAO_TPL_PICKUP_COMPLETED,
        kakaoVariables: {
          '#{orderNumber}': orderNo,
          '#{customerName}': name,
        },
      };
    case 'low_stock':
      return {
        title: '저재고 알람',
        body: `[Funnyview Pickup] ${ctx.variantLabel ?? 'SKU'} 가용재고 ${ctx.availableQty ?? 0} — 입고가 필요합니다.`,
      };
    case 'order_cancelled':
      return {
        title: '주문 취소',
        body: `${name}님, 주문 ${orderNo}이(가) 취소되었습니다.${ctx.reason ? `\n사유: ${ctx.reason}` : ''}`,
        kakaoTemplateId: process.env.KAKAO_TPL_ORDER_CANCELLED,
        kakaoVariables: { '#{orderNumber}': orderNo, '#{customerName}': name },
      };
    case 'pickup_no_show':
      return {
        title: '픽업 미수령',
        body: `${name}님, 주문 ${orderNo}이(가) 미수령 처리되었습니다.${store ? ` ${store}에 문의해 주세요.` : ''}`,
      };
    case 'order_returned':
      return {
        title: '반품 처리',
        body: `${name}님, 주문 ${orderNo}이(가) 반품 처리되었습니다.${ctx.reason ? `\n사유: ${ctx.reason}` : ''}\n선결제 환불은 ${store || '매장'}에 문의해 주세요.`,
      };
    case 'pickup_reminder':
      return {
        title: '픽업 안내',
        body: `${name}님, 주문 ${orderNo}이(가) ${store}에서 픽업을 기다리고 있습니다. 가급적 빠른 시일 내 픽업해 주세요.${ctx.storeAddress ? `\n주소: ${ctx.storeAddress}` : ''}`,
        kakaoTemplateId: process.env.KAKAO_TPL_PICKUP_REMINDER,
        kakaoVariables: {
          '#{orderNumber}': orderNo,
          '#{customerName}': name,
          '#{storeName}': store,
        },
      };
  }
}
