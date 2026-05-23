// ============================================================
// TerminalLog.tsx — Scrolling terminal-style activity log
// ============================================================
import { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';

interface Props {
  entries: LogEntry[];
  maxLines?: number;
}

const LEVEL_STYLES: Record<LogEntry['level'], { color: string; prefix: string }> = {
  INFO:     { color: '#00ff41',  prefix: '[INFO]    ' },
  SUCCESS:  { color: '#00ff41',  prefix: '[SUCCESS] ' },
  WARN:     { color: '#ffaa00',  prefix: '[WARN]    ' },
  ERROR:    { color: '#ff4400',  prefix: '[ERROR]   ' },
  CRITICAL: { color: '#ff0040',  prefix: '[CRITICAL]' },
};

const SOURCE_COLORS: Record<string, string> = {
  'SIMULATOR':  '#9b59b6',
  'DEFENDER':   '#00d4ff',
  'INTEGRITY':  '#ffaa00',
  'DASHBOARD':  '#00ff41',
  'SYSTEM':     '#888',
};

export default function TerminalLog({ entries, maxLines = 200 }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const visible = entries.slice(-maxLines);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#00ff41]"
          style={{ textShadow: '0 0 8px #00ff41' }}
        >
          ◈ SYSTEM LOG
        </h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ff41] pulse-green" />
          <span className="text-[10px] font-['Share_Tech_Mono'] text-[#00ff4160]">
            {entries.length} ENTRIES
          </span>
        </div>
      </div>

      {/* Terminal window */}
      <div
        className="flex-1 rounded overflow-hidden"
        style={{ background: '#000', border: '1px solid #00ff4120' }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ background: '#050f05', borderBottom: '1px solid #00ff4115' }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff0040]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffaa00]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#00ff41]" />
          <span className="ml-2 text-[10px] font-['Share_Tech_Mono'] text-[#00ff4160]">
            ransomwatch@soc:~$ tail -f /var/log/ransomwatch.log
          </span>
        </div>

        {/* Log content */}
        <div className="h-full overflow-y-auto p-3 space-y-0.5 terminal-text pb-16">
          {visible.map((entry) => {
            const ls = LEVEL_STYLES[entry.level];
            const sc = SOURCE_COLORS[entry.source] ?? '#00ff4180';
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });

            return (
              <div
                key={entry.id}
                className="flex gap-2 leading-relaxed hover:bg-[#00ff4105] transition-colors rounded px-1"
              >
                {/* Timestamp */}
                <span className="text-[#00ff4140] shrink-0">{time}</span>
                {/* Source */}
                <span className="shrink-0 w-20" style={{ color: sc }}>
                  [{entry.source}]
                </span>
                {/* Level */}
                <span className="shrink-0 w-20" style={{ color: ls.color }}>
                  {ls.prefix}
                </span>
                {/* Message */}
                <span style={{ color: ls.color, opacity: 0.9 }}>{entry.message}</span>
              </div>
            );
          })}

          {/* Blinking cursor */}
          <div className="flex gap-2 mt-1">
            <span className="text-[#00ff4140]">
              {new Date().toLocaleTimeString('en-US', { hour12: false })}
            </span>
            <span className="text-[#00ff41]">$</span>
            <span className="w-2 h-4 bg-[#00ff41] blink" />
          </div>

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
