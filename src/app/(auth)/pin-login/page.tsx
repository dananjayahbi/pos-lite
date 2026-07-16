'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession } from 'next-auth/react';
import PinEntryModal from '@/components/shared/PinEntryModal';
import { Input } from '@/components/ui/input';
import { getDefaultRouteForRole } from '@/lib/utils/default-route';

export default function PinLoginPage() {
  return (
    <Suspense fallback={<div className="w-full px-4" />}>
      <PinLoginPageContent />
    </Suspense>
  );
}

function PinLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => email || 'Staff account', [email]);

  const handleSuccess = async () => {
    const session = await getSession();
    router.push(getDefaultRouteForRole(session?.user.role));
  };

  return (
    <div className="w-full px-4">
      <div className="mx-auto mb-4 w-full max-w-[400px] text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-md bg-espresso" />
        <h1 className="font-display text-3xl text-espresso">VelvetPOS</h1>
        <p className="mt-1 text-sm text-terracotta">Quick PIN sign-in</p>
      </div>

      <div className="mx-auto mb-4 w-full max-w-[400px]">
        <label className="mb-1 block text-sm text-espresso" htmlFor="pin-email">
          Email address
        </label>
        <Input
          id="pin-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          placeholder="staff@store.com"
          className="focus-visible:ring-sand"
        />
      </div>

      {!email ? (
        <div className="mx-auto w-full max-w-[400px] rounded-md border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          Enter your email to continue with PIN sign-in.
        </div>
      ) : (
        <PinEntryModal
          onSuccess={handleSuccess}
          userDisplayName={displayName}
          userEmail={email}
        />
      )}

      {error ? <p className="mt-4 text-center text-sm text-danger">{error}</p> : null}
    </div>
  );
}
