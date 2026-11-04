import Link from "next/link";

export function Header() {
  return (
    <header className="brand-header">
      <Link aria-label="SalesSimp home" className="brand" href="/">
        <span aria-hidden="true" className="brand-icon">
          <svg
            fill="none"
            height="24"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 8.5h14l1.2 11H3.8L5 8.5Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <path
              d="M8.5 9V6.8a3.5 3.5 0 0 1 7 0V9M8.5 13h7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>
        <span>SalesSimp</span>
      </Link>
      <p className="brand-tagline">Sales, made simple.</p>
    </header>
  );
}
