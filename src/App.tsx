import { useEffect, useMemo, useRef, useState } from 'react';
import { RECIPES, type LensResult, type LogLine } from './recipes';
import { toBase64 } from './recompute/agent-anchor/bytes';

export default function App() {
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const recipe = useMemo(() => RECIPES.find((r) => r.id === recipeId)!, [recipeId]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LensResult | null>(null);
  const [error, setError] = useState('');
  const [conf, setConf] = useState<{ done: number; ok: number } | null>(null);

  useEffect(() => {
    let done = 0, ok = 0;
    Promise.all(RECIPES.map((r) => r.selfTest().then((t) => { done++; if (t.ok) ok++; }).catch(() => { done++; })))
      .then(() => setConf({ done, ok }));
  }, []);

  useEffect(() => { setFields({}); setResult(null); setError(''); }, [recipeId]);

  const set = (k: string, v: string) => setFields((s) => {
    const next = { ...s, [k]: v }; delete next[k + '__base64']; return next;
  });
  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { set(key, ''); setResult(null); setError('INPUT_TOO_LARGE: maximum 4 MiB.'); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Preserve original bytes, including malformed UTF-8, for the verifier.
    setFields(s => ({ ...s, [key]: new TextDecoder().decode(bytes), [key + '__base64']: toBase64(bytes) }));
    setResult(null); setError('');
  };
  const run = async () => {
    setError(''); setResult(null);
    const out = await recipe.run(fields);
    if ('error' in out) { setError(out.error); return; }
    setResult(out);
  };
  const loadExample = () => { setFields(recipe.loadExample()); setResult(null); setError(''); };

  return (
    <div className="app">
      <header>
        <h1>recompute<span className="lens">·lens</span></h1>
        <p className="tag">Don't trust. Recompute.</p>
        <p className="sub">Recompute selected record and proof profiles in your browser. Each recipe states its inputs, trust assumptions and verification limits.</p>
      </header>

      {conf && (
        <div className={'conf ' + (conf.ok === conf.done ? 'ok' : 'bad')}>
          {conf.ok === conf.done
            ? <>✓ all <b>{conf.done}</b> recipes conformant to their golden vectors — reproduced byte-exact in your browser, right now</>
            : <>✗ {conf.done - conf.ok}/{conf.done} recipe self-test(s) <b>FAILED</b> — do not trust this build</>}
        </div>
      )}

      <section className="panel">
        <label>Recipe</label>
        <select className="recipe-pick" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
          {RECIPES.map((r) => <option key={r.id} value={r.id}>{r.label} · {r.profile}</option>)}
        </select>
        <div className="blurb">{recipe.blurb}</div>

        {recipe.fields.map((fl) => (
          <div key={fl.key} className="field">
            <label htmlFor={'field-' + fl.key}>{fl.label}</label>
            {fl.area
              ? <textarea id={'field-' + fl.key} rows={5} spellCheck={false} placeholder={fl.placeholder} value={fields[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)} />
              : <input id={'field-' + fl.key} spellCheck={false} placeholder={fl.placeholder} value={fields[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)} />}
            {fl.bytes && <>
              <input aria-label={'Original bytes file: ' + fl.key} type="file" onChange={e => void upload(fl.key, e.target.files?.[0])} />
              {fields[fl.key + '__base64'] !== undefined && <small>Original file bytes selected; the textarea is a preview. Editing it selects UTF-8 text instead.</small>}
            </>}
          </div>
        ))}

        <div className="actions">
          <button className="go" onClick={run}>Recompute</button>
          <button className="ghost" onClick={loadExample}>Load example</button>
        </div>
        {error && <div className="err">{error}</div>}
      </section>

      {result && <ResultView r={result} />}

      <footer>
        {RECIPES.length} recipes · engine mirrors{' '}
        <a href="https://github.com/trustless-ai/recompute-kit" target="_blank" rel="noreferrer">recompute-kit</a> · source{' '}
        <a href="https://github.com/trustless-ai/recompute-lens" target="_blank" rel="noreferrer">recompute-lens</a> · part of{' '}
        <a href="https://trustless-ai.eth.limo" target="_blank" rel="noreferrer">trustless-ai</a>
      </footer>
    </div>
  );
}

const LABEL: Record<LensResult['verdict'], string> = {
  'verified-good': 'VERIFIED · GOOD',
  'verified-bad': 'VERIFIED · BAD',
  'unverifiable': 'UNVERIFIABLE',
};

function ResultView({ r }: { r: LensResult }) {
  const { shown, finished } = useConsoleStream(r.log);
  return (
    <section className="result">
      <h2>Watch it recompute</h2>
      <Console log={r.log} shown={shown} streaming={!finished} />

      {finished && (
        <>
          {r.dimensions ? <div className="dimensions" data-testid="result-dimensions">
            <div><b>Proof validity:</b> <code>{r.dimensions.proofValidity}</code></div>
            <div><b>Anchor assurance:</b> <code>{r.dimensions.anchorAssurance}</code></div>
            <div><b>Verification executes in:</b> {r.dimensions.execution}</div>
            <div><b>Native-algorithm port result:</b> <code>{r.dimensions.nativeResult}</code></div>
            <div><b>Host comparison:</b> {r.dimensions.hostComparison} (diagnostic only)</div>
            <div><b>Reason:</b> <code>{r.reason}</code></div>
            <div><b>Selected profile:</b> <code>{r.profile}</code></div>
            <ul>{r.dimensions.notCovered.map(item => <li key={item}>{item}</li>)}</ul>
          </div> : <div className={'verdict ' + r.verdict}>
            <div className="v-badge">{LABEL[r.verdict]}</div>
            <div className="v-reason">{r.reason}</div>
            <div className="v-profile">verified under profile <code>{r.profile}</code></div>
          </div>}

          <div className="repro">
            <div className="repro-h">Don't trust this console — reproduce it yourself:</div>
            {r.reproduce.rows.map((row, i) => (
              <div className="repro-row" key={i}><span>{row.label}</span><code>{row.value}</code></div>
            ))}
            <div className="repro-cmd"><pre>{r.reproduce.commands}</pre></div>
          </div>

          <div className="vantage"><b>vantage limitation.</b> {r.vantageLimitation}</div>
          {r.signatureNote && <div className="vantage signote"><b>signature note.</b> {r.signatureNote}</div>}
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
