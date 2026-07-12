import { useEffect, useRef, useState } from 'react';
import { recompute, selfTest, GOLDEN, PROFILE, type Result, type LogLine } from './recompute/receiptos-c14n-v0';

export default function App() {
  const [input, setInput] = useState('');
  const [expected, setExpected] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [conformant, setConformant] = useState<boolean | null>(null);

  useEffect(() => { selfTest().then((t) => setConformant(t.ok)).catch(() => setConformant(false)); }, []);

  const run = async () => {
    setError(''); setResult(null);
    let evidence: unknown;
    try { evidence = JSON.parse(input); } catch { setError('Input is not valid JSON.'); return; }
    if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
      setError('Input must be a JSON object.'); return;
    }
    setResult(await recompute(evidence as Record<string, unknown>, expected || null));
  };

  const loadExample = () => {
    setInput(JSON.stringify(GOLDEN.evidence));
    setExpected(GOLDEN.root);
    setResult(null); setError('');
  };

  return (
    <div className="app">
      <header>
        <h1>recompute<span className="lens">·lens</span></h1>
        <p className="tag">Don't trust. Recompute.</p>
        <p className="sub">Verify an off-chain record by watching it re-derive from its primary source — in your browser, no server, no trusted party.</p>
      </header>

      {conformant !== null && (
        <div className={'conf ' + (conformant ? 'ok' : 'bad')}>
          {conformant
            ? <>✓ this build is <b>conformant</b> to the <code>{PROFILE}</code> golden vector (§2.8) — it reproduces the published root byte-exact, in your browser, right now</>
            : <>✗ conformance self-test <b>FAILED</b> — do not trust this build</>}
        </div>
      )}

      <section className="panel">
        <label>Evidence object <span className="opt">(JSON)</span></label>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={5} spellCheck={false}
          placeholder={'{"b":1,"a":{ … },"anchor":{ … }}'} />
        <label>Expected <code>receipt_root</code> <span className="opt">(optional — falls back to anchor.receipt_root if present)</span></label>
        <input value={expected} onChange={(e) => setExpected(e.target.value)} spellCheck={false} placeholder="0x…" />
        <div className="actions">
          <button className="go" onClick={run}>Recompute</button>
          <button className="ghost" onClick={loadExample}>Load §2.8 example</button>
        </div>
        {error && <div className="err">{error}</div>}
      </section>

      {result && <ResultView r={result} />}

      <footer>
        profile <code>{PROFILE}</code> · engine mirrors{' '}
        <a href="https://github.com/trustless-ai/recompute-kit" target="_blank" rel="noreferrer">recompute-kit</a> · part of{' '}
        <a href="https://trustless-ai.eth.limo" target="_blank" rel="noreferrer">trustless-ai</a>
      </footer>
    </div>
  );
}

const LABEL: Record<Result['verdict'], string> = {
  'verified-good': 'VERIFIED · GOOD',
  'verified-bad': 'VERIFIED · BAD',
  'unverifiable': 'UNVERIFIABLE',
};

function ResultView({ r }: { r: Result }) {
  const done = useConsoleStream(r.log);
  return (
    <section className="result">
      <h2>Watch it recompute</h2>
      <Console log={r.log} shown={done.shown} streaming={!done.finished} />

      {/* the verdict + independent-verify only reveal once the run has finished streaming */}
      {done.finished && (
        <>
          <div className={'verdict ' + r.verdict}>
            <div className="v-badge">{LABEL[r.verdict]}</div>
            <div className="v-reason">{r.reason}</div>
            <div className="v-profile">verified under profile <code>{r.profile}</code></div>
          </div>

          <div className="repro">
            <div className="repro-h">Don't trust this console — reproduce it yourself:</div>
            <div className="repro-row"><span>bytes (UTF-8)</span><code>{r.canonical}</code></div>
            <div className="repro-row"><span>bytes (hex)</span><code>{r.canonicalHex}</code></div>
            <div className="repro-row"><span>sha256 →</span><code>{r.recomputedRoot}</code></div>
            <div className="repro-cmd">
              <span className="cmt"># paste those exact bytes into any SHA-256 tool → same root. Or run the kit:</span>
              <pre>echo -n '&lt;canonical bytes above&gt;' | shasum -a 256{'\n'}recompute-step receiptos/canonicalize evidence.json {r.recomputedRoot}</pre>
            </div>
          </div>

          <div className="vantage"><b>vantage limitation.</b> {r.vantageLimitation}</div>
        </>
      )}
    </section>
  );
}

function useConsoleStream(log: LogLine[]) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    let i = 0;
    const id = setInterval(() => { i += 1; setShown(i); if (i >= log.length) clearInterval(id); }, 110);
    return () => clearInterval(id);
  }, [log]);
  return { shown, finished: shown >= log.length };
}

function Console({ log, shown, streaming }: { log: LogLine[]; shown: number; streaming: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [shown]);
  return (
    <div className="console" ref={ref}>
      {log.slice(0, shown).map((l, i) => (
        <div key={i} className={'ln ' + l.kind}>
          {l.kind === 'cmd' && <span className="pre-sym">$&nbsp;</span>}
          {(l.kind === 'out' || l.kind === 'ok' || l.kind === 'bad' || l.kind === 'warn') && <span className="pre-sym">→&nbsp;</span>}
          <span className="ln-text">{l.text}</span>
        </div>
      ))}
      {streaming && <div className="ln cursor">▋</div>}
    </div>
  );
}
