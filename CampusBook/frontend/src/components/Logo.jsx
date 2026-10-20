import './Logo.css';

export default function Logo({ light = false }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3.5v5M22 3.5v5" />
          <rect x="3.5" y="6" width="25" height="22.5" rx="4.5" />
          <path d="M3.5 12.5h25" />
          <path d="M10.5 20l3.8 3.8 7.2-7.6" />
        </g>
      </svg>
      <span className="logo-text">Campus<strong>Book</strong></span>
    </span>
  );
}
