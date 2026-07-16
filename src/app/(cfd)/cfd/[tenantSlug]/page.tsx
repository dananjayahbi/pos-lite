'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CartItem {
  id: string;
  productName: string;
  quantity: number;
  lineTotal: number;
}

interface CartState {
  status: 'ACTIVE' | 'COMPLETE';
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalPaid: number;
  changeDue: number;
  promotions: string[];
  customerName: string | undefined;
}

/* ------------------------------------------------------------------ */
/*  Idle screen                                                        */
/* ------------------------------------------------------------------ */

function IdleView({ storeName }: { storeName: string }) {
  const [clock, setClock] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    intervalRef.current = setInterval(() => setClock(new Date()), 1_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const timeStr = clock.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="font-heading text-5xl text-espresso">{storeName}</h1>
        <p className="text-xl text-terracotta">Welcome</p>
        <p className="font-mono text-3xl text-sand">{timeStr}</p>
      </div>
      <div className="h-1.5 w-full bg-espresso" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active screen                                                      */
/* ------------------------------------------------------------------ */

function ActiveView({ cart }: { cart: CartState }) {
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Items list — 65% */}
      <div className="flex-65 overflow-y-auto p-6">
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between border-b border-mist pb-3"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-lg text-sand">×{item.quantity}</span>
                <span className="text-base text-espresso">{item.productName}</span>
              </div>
              <span className="font-mono text-base text-espresso">{fmt(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals panel — 35% */}
      <div className="flex flex-35 items-center justify-center bg-linen p-6">
        <Card className="w-full border-sand bg-linen">
          <CardContent className="space-y-4 p-6">
            <div className="flex justify-between text-base text-espresso">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(cart.subtotal)}</span>
            </div>

            {cart.discount > 0 && (
              <div className="flex justify-between text-base text-terracotta">
                <span>Discounts</span>
                <span className="font-mono">-{fmt(cart.discount)}</span>
              </div>
            )}

            <div className="border-t border-mist pt-4">
              <div className="flex items-end justify-between">
                <span className="text-lg font-semibold text-espresso">Total</span>
                <span className="font-mono text-4xl text-espresso">{fmt(cart.total)}</span>
              </div>
            </div>

            {cart.promotions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {cart.promotions.map((promo) => (
                  <Badge key={promo} variant="outline" className="border-terracotta text-terracotta">
                    {promo}
                  </Badge>
                ))}
              </div>
            )}

            {cart.customerName != null && (
              <p className="pt-2 text-sm text-sand">Customer: {cart.customerName}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Complete screen                                                    */
/* ------------------------------------------------------------------ */

function CompleteView({
  cart,
  onReset,
}: {
  cart: CartState;
  onReset: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    timerRef.current = setTimeout(onReset, 8_000);
    return () => clearTimeout(timerRef.current);
  }, [onReset]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <CheckCircle2 className="h-28 w-28 text-terracotta" />
      <h1 className="font-heading text-5xl text-espresso">Thank You!</h1>
      <p className="font-mono text-4xl text-espresso">{fmt(cart.totalPaid)}</p>
      {cart.changeDue > 0 && (
        <p className="text-xl text-terracotta">Change: {fmt(cart.changeDue)}</p>
      )}
      <p className="text-lg text-sand">Have a wonderful day!</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CFD page                                                      */
/* ------------------------------------------------------------------ */

export default function CfdPage() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;

  const [cartState, setCartState] = useState<CartState | null>(null);

  /* SSE subscription */
  useEffect(() => {
    const es = new EventSource(`/api/cfd/stream?tenantSlug=${tenantSlug}`);
    es.onmessage = (event: MessageEvent) => {
      const data: CartState = JSON.parse(event.data as string);
      setCartState(data);
    };
    es.onerror = () => console.warn('[CFD] SSE connection error, reconnecting...');
    return () => es.close();
  }, [tenantSlug]);

  const handleReset = () => setCartState(null);

  /* Derive display name from slug */
  const storeName = tenantSlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  /* State resolution */
  const isIdle = cartState === null || cartState.items.length === 0;
  const isComplete = cartState?.status === 'COMPLETE';

  return (
    <div className="h-full w-full bg-linen">
      {isComplete && cartState != null ? (
        <CompleteView cart={cartState} onReset={handleReset} />
      ) : isIdle ? (
        <IdleView storeName={storeName} />
      ) : (
        <ActiveView cart={cartState!} />
      )}
    </div>
  );
}
