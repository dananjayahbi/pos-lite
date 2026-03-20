'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Schemas ──────────────────────────────────────────────────────────────────

const storeDetailsSchema = z.object({
  storeName: z.string().min(2, 'Store name must be at least 2 characters').max(80),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, digits, and hyphens'),
  ownerEmail: z.string().email('Enter a valid email address'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters'),
  timezone: z.string().min(1, 'Select a timezone'),
  currency: z.string().min(1, 'Select a currency'),
});

type StoreDetailsValues = z.infer<typeof storeDetailsSchema>;

// ── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'Asia/Colombo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Auckland',
];

const CURRENCIES = ['LKR', 'USD', 'GBP', 'EUR', 'INR', 'AUD', 'SGD'];

const STEPS = ['Store Details', 'Plan Selection', 'Review & Confirm'] as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: string;
  features: string[];
  sortOrder: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TenantProvisioningWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<StoreDetailsValues & { planId: string }>({
    storeName: '',
    slug: '',
    ownerEmail: '',
    ownerPassword: '',
    timezone: 'Asia/Colombo',
    currency: 'LKR',
    planId: '',
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="font-display text-espresso text-3xl font-bold">
        Create New Tenant
      </h1>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const isActive = currentStep === step;
          const isCompleted = currentStep > step;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isCompleted
                      ? 'bg-espresso text-pearl'
                      : isActive
                        ? 'bg-espresso text-pearl'
                        : 'bg-mist text-espresso'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step}
                </div>
                <span
                  className={`text-sm font-medium ${isActive || isCompleted ? 'text-espresso' : 'text-espresso/50'}`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 ${isCompleted ? 'bg-espresso' : 'bg-mist'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <StepStoreDetails
          defaultValues={formData}
          onNext={(values) => {
            setFormData((prev) => ({ ...prev, ...values }));
            setCurrentStep(2);
          }}
        />
      )}
      {currentStep === 2 && (
        <StepPlanSelection
          selectedPlanId={formData.planId}
          onSelect={(planId) => setFormData((prev) => ({ ...prev, planId }))}
          onNext={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
        />
      )}
      {currentStep === 3 && (
        <StepReview
          formData={formData}
          onBack={() => setCurrentStep(2)}
          onSuccess={(tenantId) => {
            toast.success('Tenant created successfully');
            setTimeout(() => router.push(`/superadmin/tenants/${tenantId}`), 1500);
          }}
        />
      )}
    </div>
  );
}

// ── Step 1: Store Details ────────────────────────────────────────────────────

function StepStoreDetails({
  defaultValues,
  onNext,
}: {
  defaultValues: StoreDetailsValues;
  onNext: (values: StoreDetailsValues) => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<StoreDetailsValues>({
    defaultValues,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle',
  );
  const slugTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const slugValue = watch('slug');

  const checkSlug = useCallback(async (slug: string) => {
    if (slug.length < 3) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    try {
      const res = await fetch(
        `/api/superadmin/tenants/check-slug?slug=${encodeURIComponent(slug)}`,
      );
      const data = await res.json();
      setSlugStatus(data.available ? 'available' : 'taken');
    } catch {
      setSlugStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (slugValue && slugValue.length >= 3) {
      slugTimerRef.current = setTimeout(() => checkSlug(slugValue), 500);
    } else {
      setSlugStatus('idle');
    }
    return () => {
      if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    };
  }, [slugValue, checkSlug]);

  function onSubmit(data: StoreDetailsValues) {
    const result = storeDetailsSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof StoreDetailsValues | undefined;
        if (field) {
          setError(field, { message: issue.message });
        }
      }
      return;
    }
    onNext(result.data);
  }

  useEffect(() => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (slugValue && slugValue.length >= 3) {
      slugTimerRef.current = setTimeout(() => checkSlug(slugValue), 500);
    } else {
      setSlugStatus('idle');
    }
    return () => {
      if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    };
  }, [slugValue, checkSlug]);

  return (
    <Card className="border-sand bg-linen">
      <CardHeader>
        <CardTitle className="font-display text-espresso">Store Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Store Name */}
          <div className="space-y-1">
            <label className="text-espresso text-sm font-medium">Store Name</label>
            <Input
              {...register('storeName')}
              placeholder="My Awesome Store"
              className="border-sand"
            />
            {errors.storeName && (
              <p className="text-terracotta text-sm">{errors.storeName.message}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1">
            <label className="text-espresso text-sm font-medium">Slug</label>
            <div className="relative">
              <Input
                {...register('slug', {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const transformed = e.target.value.toLowerCase().replace(/\s+/g, '-');
                    setValue('slug', transformed, { shouldValidate: true });
                  },
                })}
                placeholder="my-awesome-store"
                className="border-sand pr-9"
              />
              <div className="absolute top-1/2 right-3 -translate-y-1/2">
                {slugStatus === 'checking' && (
                  <Loader2 className="text-espresso/50 h-4 w-4 animate-spin" />
                )}
                {slugStatus === 'available' && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                {slugStatus === 'taken' && <X className="text-terracotta h-4 w-4" />}
              </div>
            </div>
            {errors.slug && (
              <p className="text-terracotta text-sm">{errors.slug.message}</p>
            )}
            {slugStatus === 'taken' && (
              <p className="text-terracotta text-sm">This slug is already taken</p>
            )}
          </div>

          {/* Owner Email */}
          <div className="space-y-1">
            <label className="text-espresso text-sm font-medium">Owner Email</label>
            <Input
              {...register('ownerEmail')}
              type="email"
              placeholder="owner@example.com"
              className="border-sand"
            />
            {errors.ownerEmail && (
              <p className="text-terracotta text-sm">{errors.ownerEmail.message}</p>
            )}
          </div>

          {/* Owner Password */}
          <div className="space-y-1">
            <label className="text-espresso text-sm font-medium">Owner Password</label>
            <div className="relative">
              <Input
                {...register('ownerPassword')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                className="border-sand pr-9"
              />
              <button
                type="button"
                className="text-espresso/50 hover:text-espresso absolute top-1/2 right-3 -translate-y-1/2"
                onClick={() => setShowPassword((p) => !p)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.ownerPassword && (
              <p className="text-terracotta text-sm">{errors.ownerPassword.message}</p>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-1">
            <label className="text-espresso text-sm font-medium">Timezone</label>
            <Select
              defaultValue={defaultValues.timezone}
              onValueChange={(v) => setValue('timezone', v, { shouldValidate: true })}
            >
              <SelectTrigger className="border-sand">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timezone && (
              <p className="text-terracotta text-sm">{errors.timezone.message}</p>
            )}
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <label className="text-espresso text-sm font-medium">Currency</label>
            <Select
              defaultValue={defaultValues.currency}
              onValueChange={(v) => setValue('currency', v, { shouldValidate: true })}
            >
              <SelectTrigger className="border-sand">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currency && (
              <p className="text-terracotta text-sm">{errors.currency.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="bg-espresso text-pearl hover:bg-espresso/90">
              Next Step <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Step 2: Plan Selection ───────────────────────────────────────────────────

function StepPlanSelection({
  selectedPlanId,
  onSelect,
  onNext,
  onBack,
}: {
  selectedPlanId: string;
  onSelect: (planId: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/superadmin/plans');
        const data = await res.json();
        setPlans(data);
      } catch {
        toast.error('Failed to load plans');
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  function formatPrice(price: string) {
    return `Rs. ${Number(price).toLocaleString('en-LK')}/month`;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="text-espresso h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <Card
              key={plan.id}
              className={`bg-linen cursor-pointer transition-colors ${
                isSelected ? 'border-espresso border-2' : 'border-sand'
              }`}
              onClick={() => onSelect(plan.id)}
            >
              <CardHeader className="relative">
                <CardTitle className="font-display text-espresso">{plan.name}</CardTitle>
                {isSelected && (
                  <div className="bg-espresso text-pearl absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-espresso text-xl font-bold">
                  {formatPrice(plan.priceMonthly)}
                </p>
                <p className="text-espresso/70 text-sm">{plan.description}</p>
                <ul className="space-y-1">
                  {(Array.isArray(plan.features) ? plan.features : []).map(
                    (feature, idx) => (
                      <li key={idx} className="text-espresso/80 flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                        {feature}
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-sand" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          className="bg-espresso text-pearl hover:bg-espresso/90"
          disabled={!selectedPlanId}
          onClick={onNext}
        >
          Next Step <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Review & Confirm ────────────────────────────────────────────────

function StepReview({
  formData,
  onBack,
  onSuccess,
}: {
  formData: StoreDetailsValues & { planId: string };
  onBack: () => void;
  onSuccess: (tenantId: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const rows: { label: string; value: string }[] = [
    { label: 'Store Name', value: formData.storeName },
    { label: 'Slug', value: formData.slug },
    { label: 'Owner Email', value: formData.ownerEmail },
    { label: 'Owner Password', value: '••••••••' },
    { label: 'Timezone', value: formData.timezone },
    { label: 'Currency', value: formData.currency },
  ];

  async function handleCreate() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to create tenant');
        return;
      }

      const { id } = await res.json();
      onSuccess(id);
    } catch {
      toast.error('Failed to create tenant');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-sand bg-linen">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Review & Confirm</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-sand divide-y">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex justify-between py-3">
                <dt className="text-espresso/70 text-sm font-medium">{label}</dt>
                <dd className="text-espresso text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" className="border-sand" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          className="bg-espresso text-pearl hover:bg-espresso/90"
          disabled={submitting}
          onClick={handleCreate}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Tenant
        </Button>
      </div>
    </div>
  );
}
