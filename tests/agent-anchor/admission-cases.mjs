// Expected admission decisions authored independently of the parser.
export function admissionCases(raw) {
  const text=new TextDecoder().decode(raw),parsed=JSON.parse(text);
  const replace=m=>new TextEncoder().encode(text.replace('"metadata":{}','"metadata":'+m));
  const cases=[
    {name:'RAW_ORIGINAL',raw,expected:'ADMITTED'},
    {name:'RAW_NEWLINE',raw:new TextEncoder().encode(text+'\n'),expected:'NON_CANONICAL_RECEIPT'},
    {name:'RAW_DUPLICATE',raw:new TextEncoder().encode('{"profile":"x",'+text.slice(1)),expected:'DUPLICATE_JSON_KEY'},
    {name:'RAW_NESTED_DUPLICATE',raw:replace('{"x":1,"x":2}'),expected:'DUPLICATE_JSON_KEY'},
    {name:'RAW_NEGATIVE_ZERO',raw:replace('{"n":-0}'),expected:'UNSAFE_JSON_NUMBER'},
    {name:'RAW_UNSAFE_INTEGER',raw:replace('{"n":9007199254740992}'),expected:'UNSAFE_JSON_NUMBER'},
    {name:'RAW_FRACTION',raw:replace('{"n":1.5}'),expected:'UNSAFE_JSON_NUMBER'},
    {name:'RAW_EXPONENT',raw:replace('{"n":1e0}'),expected:'UNSAFE_JSON_NUMBER'},
    {name:'RAW_LONE_SURROGATE',raw:replace('{"s":"\\ud800"}'),expected:'INVALID_UNICODE'},
    {name:'RAW_INVALID_UTF8',raw:new Uint8Array([0xc0,0xaf]),expected:'INVALID_UTF8'},
    {name:'RAW_BOM',raw:new Uint8Array([239,187,191,...raw]),expected:'MALFORMED_JSON'},
    {name:'RAW_UNSAFE_KEY',raw:replace('{"__proto__":0}'),expected:'INVALID_JSON_KEY'},
    {name:'RAW_NONASCII_KEY',raw:replace('{"π":0}'),expected:'INVALID_JSON_KEY'},
    {name:'RAW_DEPTH_32',raw:replace('['.repeat(31)+'0'+']'.repeat(31)),expected:'ADMITTED'},
    {name:'RAW_DEPTH_33',raw:replace('['.repeat(32)+'0'+']'.repeat(32)),expected:'JSON_NESTING_LIMIT'},
  ];
  const marker=replace('{"s":"@@"}');const offset=new TextDecoder().decode(marker).indexOf('@@');
  const unicodeOffset=new TextEncoder().encode(new TextDecoder().decode(marker).slice(0,offset)).length;
  const invalidEmbedded=new Uint8Array(marker);invalidEmbedded.set([0xc0,0xaf],unicodeOffset);
  cases.push({name:'RAW_EMBEDDED_INVALID_UTF8',raw:invalidEmbedded,expected:'INVALID_UTF8'});
  const prefix=text.replace('"metadata":{}','"metadata":""');
  const count=4*1024*1024-new TextEncoder().encode(prefix).length;
  cases.push({name:'RAW_EXACT_4MIB',raw:replace('"'+'x'.repeat(count)+'"'),expected:'ADMITTED'},
    {name:'RAW_OVER_4MIB',raw:replace('"'+'x'.repeat(count+1)+'"'),expected:'INPUT_TOO_LARGE'});
  parsed.anchor={ignored:false};
  const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  cases.push({name:'RAW_TOP_LEVEL_ANCHOR_FORBIDDEN',raw:new TextEncoder().encode(canonical(parsed)),expected:'RECEIPT_SHAPE'});
  return cases;
}
