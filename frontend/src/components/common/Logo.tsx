import { FC } from 'react';

interface Props {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  className?: string;
}

export const Logo: FC<Props> = ({
  size = 32,
  showWordmark = true,
  wordmarkColor = '#1f2937',
  className,
}) => {
  const markSize = size;
  const fontSize = size * 0.69;
  const gap = size * 0.32;
  const wordmarkApprox = showWordmark ? fontSize * 1.95 : 0;
  const totalW = markSize + (showWordmark ? gap + wordmarkApprox : 0);

  return (
    <svg
      width={totalW}
      height={markSize}
      viewBox={`0 0 ${totalW} ${markSize}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={showWordmark ? 'SYT - Sell Your Things' : 'SYT'}
      className={className}
    >
      <defs>
        <linearGradient id="syt-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8c42" />
          <stop offset="100%" stopColor="#e54b14" />
        </linearGradient>
      </defs>

      <g>
        <path
          d={`M${markSize * 0.625} 0 L${markSize} ${markSize * 0.375} V${markSize * 0.8125}
              c0 ${markSize * 0.0625} -${markSize * 0.05} ${markSize * 0.125} -${markSize * 0.125} ${markSize * 0.125}
              H${markSize * 0.125}
              c-${markSize * 0.0625} 0 -${markSize * 0.125} -${markSize * 0.05} -${markSize * 0.125} -${markSize * 0.125}
              V${markSize * 0.125}
              c0 -${markSize * 0.0625} ${markSize * 0.05} -${markSize * 0.125} ${markSize * 0.125} -${markSize * 0.125} Z`}
          fill="url(#syt-logo-bg)"
        />
        <circle cx={markSize * 0.78} cy={markSize * 0.25} r={markSize * 0.055} fill="#ffffff" />
        <text
          x={markSize * 0.43}
          y={markSize * 0.76}
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight={900}
          fontSize={fontSize}
          fill="#ffffff"
          textAnchor="middle"
        >
          S
        </text>
      </g>

      {showWordmark && (
        <text
          x={markSize + gap}
          y={markSize * 0.78}
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight={900}
          fontSize={fontSize}
          fill={wordmarkColor}
          letterSpacing={-1}
        >
          SYT
        </text>
      )}
    </svg>
  );
};
