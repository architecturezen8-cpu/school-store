type CrestProps = { className?: string };

export default function CrestLogo({ className = "h-8 w-8" }: CrestProps) {
  return (
    <svg
      viewBox="0 0 100 112"
      fill="none"
      className={className}
      role="img"
      aria-label="St. Thomas' College Matale crest"
    >
      <path
        d="M50 4 L92 18 V58 C92 80 74 98 50 108 C26 98 8 80 8 58 V18 Z"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M50 12 L85 23.5 V57.5 C85 76 69.5 91.5 50 100 C30.5 91.5 15 76 15 57.5 V23.5 Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />
      <text
        x="50"
        y="33"
        textAnchor="middle"
        fontSize="9"
        letterSpacing="3"
        fill="currentColor"
        fontFamily="Georgia, serif"
      >
        1873
      </text>
      <line
        x1="28"
        y1="39"
        x2="72"
        y2="39"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <text
        x="50"
        y="63"
        textAnchor="middle"
        fontSize="21"
        fontWeight="600"
        fill="currentColor"
        fontFamily="Georgia, serif"
      >
        STC
      </text>
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontSize="7"
        letterSpacing="2.5"
        fill="currentColor"
        fontFamily="Georgia, serif"
      >
        MATALE
      </text>
      <line
        x1="34"
        y1="83"
        x2="66"
        y2="83"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <text
        x="50"
        y="91"
        textAnchor="middle"
        fontSize="5.5"
        letterSpacing="1.4"
        fill="currentColor"
        fontFamily="Georgia, serif"
      >
        ANIMO ET FIDE
      </text>
    </svg>
  );
}
