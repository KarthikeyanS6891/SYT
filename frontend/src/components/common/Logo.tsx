import { FC, useId } from 'react';

interface Props {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  wordmarkColor?: string;
  taglineColor?: string;
  className?: string;
}

/**
 * SYT brand mark: a price tag pointing left (the app-wide price-tag
 * signature) carrying an "S" whose stroke terminals end in arrowheads —
 * one flowing out (sell), one flowing in (buy). Marigold gradient from
 * the "Marigold & Ink" design system; all letterforms are paths so the
 * mark renders identically on every platform.
 */

const TAG_PATH =
  'M 13 4 H 34 C 35.15 4 36 4.85 36 6 V 34 C 36 35.15 35.15 36 34 36 H 13 L 5.1 22.05 Q 4 20 5.1 17.95 Z';
const S_PATH =
  'M 29.8 13.9 C 28.3 12.1 24.9 11.5 22.6 12.5 C 20.2 13.6 19.6 16.4 21.6 18 ' +
  'C 22.7 18.9 24.4 19.3 25.9 19.8 C 27.4 20.3 29.1 21 29.5 22.9 ' +
  'C 30 25.1 28.2 27.2 25.6 27.6 C 23.1 27.9 20.6 27 19.5 25.3';
const ARROW_OUT = 'M 28.9 10.7 L 34.0 12.4 L 30.8 16.5 Z';
const ARROW_IN = 'M 20.6 28.9 L 15.5 27.3 L 18.6 23.2 Z';

const DISPLAY_FONT =
  "'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BODY_FONT =
  "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const Logo: FC<Props> = ({
  size = 40,
  showWordmark = true,
  showTagline = false,
  wordmarkColor = 'currentColor',
  taglineColor = '#6b7280',
  className,
}) => {
  const uid = useId();
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '');
  const bgId = `syt-bg-${safeUid}`;

  const m = size;
  const px = (n: number) => +(n * (m / 40)).toFixed(2);

  const fontSize = px(25);
  const taglineSize = px(7);
  const gap = px(11);
  const wordmarkW = showWordmark ? (showTagline ? px(100) : px(74)) : 0;
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
        <linearGradient id={bgId} x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#ffa14e" />
          <stop offset="52%" stopColor="#ff5a1f" />
          <stop offset="100%" stopColor="#d43b05" />
        </linearGradient>
      </defs>

      {/* Mark — nested svg keeps the 40-unit geometry at any size */}
      <svg x="0" y="0" width={m} height={m} viewBox="0 0 40 40">
        <path d={TAG_PATH} fill={`url(#${bgId})`} />
        <path
          d={S_PATH}
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.3"
          strokeLinecap="round"
        />
        <path d={ARROW_OUT} fill="#ffffff" />
        <path d={ARROW_IN} fill="#ffffff" />
        <circle
          cx="11.6"
          cy="20"
          r="2.55"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.7"
          opacity="0.95"
        />
        <circle cx="11.6" cy="20" r="1.15" fill="rgba(18, 23, 42, 0.35)" />
      </svg>

      {/* Wordmark: S [arrow-Y] T */}
      {showWordmark && (
        <g transform={`translate(${m + gap},0)`}>
          <text
            x="0"
            y={px(29)}
            fontFamily={DISPLAY_FONT}
            fontWeight={800}
            fontSize={fontSize}
            fill={wordmarkColor}
          >
            S
          </text>
          <g
            transform={`translate(${px(22)},${px(7)})`}
            stroke="#ff5a1f"
            strokeWidth={px(3.2)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d={`M ${px(0)} ${px(2)} L ${px(10)} ${px(16)} L ${px(20)} ${px(2)}`} />
            <path d={`M ${px(10)} ${px(16)} V ${px(26)}`} />
          </g>
          <text
            x={px(51)}
            y={px(29)}
            fontFamily={DISPLAY_FONT}
            fontWeight={800}
            fontSize={fontSize}
            fill={wordmarkColor}
          >
            T
          </text>
        </g>
      )}

      {showTagline && showWordmark && (
        <text
          x={m + gap}
          y={m + px(6)}
          fontFamily={BODY_FONT}
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
