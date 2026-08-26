import { cn } from '@/lib/utils';

type PageMaxWidth = 'full' | 'sm' | 'md' | 'lg' | 'xl' | '7xl';

const MAX_WIDTH_CLASSES: Record<PageMaxWidth, string> = {
  full: '',
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Constrains the content width and centers it. Defaults to full-width with padding. */
  maxWidth?: PageMaxWidth;
}

/**
 * Standard padded page wrapper for `(store)` pages. Keeps content off the edge of the
 * scrollable main region while an optional max-width centers narrower forms/cards.
 */
export function PageContainer({ children, className, maxWidth = 'full' }: PageContainerProps) {
  const isConstrained = maxWidth !== 'full';
  return (
    <div
      className={cn(
        'px-4 py-8 sm:px-6 lg:px-8',
        isConstrained && 'mx-auto w-full',
        MAX_WIDTH_CLASSES[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}
