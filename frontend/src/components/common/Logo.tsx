import { FC, useId } from 'react';

interface Props {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  wordmarkColor?: string;
  taglineColor?: string;
  className?: string;
}

export const Logo: FC<Props> = ({
  size = 40,
  showWordmark = true,
  showTagline = false,
  wordmarkColor = '#1f2937',
  taglineColor = '#6b7280',
  className,
}) => {
  const uid = useId();
  const bgId = `syt-bg-${uid}`;
  const shineId = `syt-shine-${uid}`;

  const m = size;
  const px = (n: number) => +(n * (m / 40)).toFixed(2);

  const fontSize = px(24);
  const taglineSize = px(7);
  const gap = px(12);
  const wordmarkW = showWordmark ? px(78) : 0;
  const totalW = m + (showWordmark ? gap + wordmarkW : 0);
  const totalH = showTagline ? m + px(8) : m;

  // Inner mark coordinates (the rounded square is m × m)
  const r = m * 0.225;          // corner radius
  const s = m * 0.6;            // 'S' font size inside mark
  const arrowStroke = m * 0.055;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={showWordmark ? 'SYT - Sell Your Things' : 'SYT'}
      className={className}
    >
      <defs>
        <linearGradient id={bgId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#ffa15c" />
          <stop offset="55%" stopColor="#ff6b35" />
          <stop offset="100%" stopColor="#cf3a08" />
        </linearGradient>
        <linearGradient id={shineId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Mark — rounded-square stage with brand gradient */}
      <g>
        <rect x={px(2)} y={px(2)} width={m - px(4)} height={m - px(4)} rx={r} fill={`url(#${bgId})`} />
        <rect x={px(2)} y={px(2)} width={m - px(4)} height={m - px(4)} rx={r} fill={`url(#${shineId})`} />

        {/* Up-right chevron (sell flow) */}
        <g
          stroke="#ffffff"
          strokeWidth={arrowStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.9"
        >
          <path d={`M ${m * 0.6} ${m * 0.28} L ${m * 0.74} ${m * 0.2} L ${m * 0.74} ${m * 0.34}`} />
        </g>

        {/* Bold S monogram */}
        <text
          x={m * 0.5}
          y={m * 0.75}
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight={900}
          fontSize={s}
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing={-m * 0.05}
        >
          S
        </text>

        {/* Down-left chevron (buy flow) */}
        <g
          stroke="#ffffff"
          strokeWidth={arrowStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.9"
        >
          <path d={`M ${m * 0.4} ${m * 0.72} L ${m * 0.26} ${m * 0.8} L ${m * 0.26} ${m * 0.66}`} />
        </g>
      </g>

      {/* Wordmark: S [arrow-Y] T */}
      {showWordmark && (
        <g transform={`translate(${m + gap},0)`}>
          <text
            x="0"
            y={m * 0.74}
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontWeight={900}
            fontSize={fontSize}
            fill={wordmarkColor}
            letterSpacing={-1}
          >
            S
          </text>
          <g
            transform={`translate(${px(20)},${px(10)})`}
            stroke="#ff6b35"
            strokeWidth={px(3.2)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d={`M ${px(1)} ${px(18)} L ${px(9)} ${px(2)} L ${px(17)} ${px(18)}`} />
            <path d={`M ${px(9)} ${px(2)} L ${px(9)} ${px(22)}`} />
          </g>
          <text
            x={px(46)}
            y={m * 0.74}
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontWeight={900}
            fontSize={fontSize}
            fill={wordmarkColor}
            letterSpacing={-1}
          >
            T
          </text>
        </g>
      )}

      {showTagline && showWordmark && (
        <text
          x={m + gap}
          y={m + px(6)}
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight={700}
          fontSize={taglineSize}
          fill={taglineColor}
          letterSpacing={2}
        >
          SELL YOUR THINGS
        </text>
      )}
    </svg>
  );
};
