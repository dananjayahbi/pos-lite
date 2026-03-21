export default function EmptyOrderHistory() {
  return (
    <div className="flex w-full items-center justify-center rounded-xl bg-linen p-8">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-48 w-48 items-center justify-center rounded-full bg-sand/30">
          <svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-mist"
          >
            {/* Receipt outline */}
            <path
              d="M28 12H68V76L64 72L60 76L56 72L52 76L48 72L44 76L40 72L36 76L32 72L28 76V12Z"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Line 1 */}
            <line
              x1="36"
              y1="28"
              x2="60"
              y2="28"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Line 2 */}
            <line
              x1="36"
              y1="40"
              x2="60"
              y2="40"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Divider */}
            <line
              x1="32"
              y1="50"
              x2="64"
              y2="50"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 3"
            />
            {/* Line 3 */}
            <line
              x1="36"
              y1="60"
              x2="56"
              y2="60"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-espresso">
          No sales recorded yet
        </h2>
        <p className="max-w-md text-sm text-mist">
          Once the first sale is completed on the POS terminal, it will appear
          here.
        </p>
      </div>
    </div>
  );
}
