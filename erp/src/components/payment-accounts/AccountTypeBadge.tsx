import { Badge } from '@/components/ui/badge';
import { ACCOUNT_TYPE_LABELS } from './paymentAccountLabels';
import type { PaymentAccountType } from './paymentAccountTypes';

/**
 * Type badge. Colours follow the app tokens: solid espresso for the two
 * "primary money" accounts, terracotta for gateways, and the softer
 * linen/mist/pearl fills for everything else.
 */
const TYPE_CLASSES: Record<PaymentAccountType, string> = {
  CASH: 'bg-espresso text-pearl',
  BANK: 'bg-terracotta text-pearl',
  PAYMENT_GATEWAY: 'bg-sand text-espresso',
  COURIER: 'bg-linen text-espresso border border-mist',
  WALLET: 'bg-mist text-espresso',
  CREDIT_CARD: 'bg-pearl text-espresso border border-mist',
};

interface AccountTypeBadgeProps {
  type: PaymentAccountType;
  className?: string;
}

export function AccountTypeBadge({ type, className }: AccountTypeBadgeProps) {
  return (
    <Badge className={[TYPE_CLASSES[type], 'font-body', className].filter(Boolean).join(' ')}>
      {ACCOUNT_TYPE_LABELS[type]}
    </Badge>
  );
}
