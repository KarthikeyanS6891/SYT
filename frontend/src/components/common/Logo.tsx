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
  const glossId = `syt-gloss-${uid}`;

  const m = size;
  const px = (n: number) => +(n * (m / 40)).toFixed(2);

  const fontSize = px(26);
  const taglineSize = px(7);
  const gap = px(14);
  const wordmarkW = showWordmark ? px(72) : 0;
  const totalW = m + (showWordmark ? gap + wordmarkW : 0);
  const totalH = showTagline ? m + px(8) : m;

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
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffa15c" />
          <stop offset="60%" stopColor="#ff6b35" />
          <stop offset="100%" stopColor="#d63c0a" />
        </linearGradient>
        <radialGradient id={glossId} cx="30%" cy="20%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Mark */}
      <g transform={`translate(${px(2)},${px(2)})`}>
        {(() => {
          const u = m - px(4);
          const tagPath = `M${u * 0.625} 0 L${u} ${u * 0.375} V${u * 0.83} c0 ${u * 0.07} -${u * 0.055} ${u * 0.13} -${u * 0.13} ${u * 0.13} H${u * 0.13} c-${u * 0.07} 0 -${u * 0.13} -${u * 0.055} -${u * 0.13} -${u * 0.13} V${u * 0.13} c0 -${u * 0.07} ${u * 0.055} -${u * 0.13} ${u * 0.13} -${u * 0.13} Z`;
          return (
            <>
              <path d={tagPath} fill={`url(#${bgId})`} />
              <path d={tagPath} fill={`url(#${glossId})`} />

              {/* Tag hole / sparkle */}
              <circle cx={u * 0.81} cy={u * 0.2} r={u * 0.054} fill="#ffffff" />
              <circle cx={u * 0.81} cy={u * 0.2} r={u * 0.02} fill="#ff6b35" />

              {/* Eyes */}
              <ellipse cx={u * 0.36} cy={u * 0.51} rx={u * 0.07} ry={u * 0.078} fill="#ffffff" />
              <ellipse cx={u * 0.66} cy={u * 0.51} rx={u * 0.07} ry={u * 0.078} fill="#ffffff" />
              <circle cx={u * 0.38} cy={u * 0.5} r={u * 0.027} fill="#1f2937" />
              <circle cx={u * 0.68} cy={u * 0.5} r={u * 0.027} fill="#1f2937" />

              {/* Smile */}
              <path
                d={`M${u * 0.25} ${u * 0.68} Q${u * 0.52} ${u * 0.91} ${u * 0.78} ${u * 0.68}`}
                stroke="#ffffff"
                strokeWidth={u * 0.062}
                strokeLinecap="round"
                fill="none"
              />
              {/* Upward swoosh tail */}
              <path
                d={`M${u * 0.75} ${u * 0.67} L${u * 0.84} ${u * 0.6} L${u * 0.81} ${u * 0.72}`}
                stroke="#ffffff"
                strokeWidth={u * 0.062}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </>
          );
        })()}
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
            transform={`translate(${px(20)},${px(8)})`}
            stroke="#ff6b35"
            strokeWidth={px(3.4)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d={`M${px(2)} ${px(20)} L${px(10)} ${px(4)} L${px(18)} ${px(20)}`} />
            <path d={`M${px(10)} ${px(4)} L${px(10)} ${px(24)}`} />
            <path d={`M${px(6)} ${px(9)} L${px(10)} ${px(4)} L${px(14)} ${px(9)}`} />
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
          fontWeight={600}
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
