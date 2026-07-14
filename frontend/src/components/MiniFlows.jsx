// Mini-flow SVG illustrations for the OverviewPage (product overview cards).
// Ported verbatim from design/index.html — viewBox 0 0 400 200,
// preserveAspectRatio="xMidYMid meet". Each SVG is a self-contained
// snapshot of what one screen does end-to-end.

export function HomeFlow() {
  return (
    <svg className="mini-flow" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="200" y="13" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// HOW_IT_WORKS</text>
      <rect x="20" y="22" width="360" height="36" fill="none" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="30" y="36" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" letterSpacing="0.08em">YOUR_LONG_URL</text>
      <text x="30" y="50" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#111111">https://example.com/very/long/path</text>
      <line x1="200" y1="60" x2="200" y2="76" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="196,72 200,76 204,72" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="210" y="72" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" letterSpacing="0.08em">HASH</text>
      <rect x="130" y="80" width="140" height="22" fill="#ffffff" stroke="#111111" strokeWidth="0.8" rx="11"/>
      <text x="200" y="95" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#111111" textAnchor="middle" letterSpacing="0.05em">→ base62 encode</text>
      <line x1="200" y1="104" x2="200" y2="120" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="196,116 200,120 204,116" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="210" y="116" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" letterSpacing="0.08em">SHORTEN</text>
      <rect x="20" y="124" width="360" height="38" fill="#111111" rx="2"/>
      <text x="30" y="138" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#999999" letterSpacing="0.08em">YOUR_SHORT_URL</text>
      <text x="30" y="155" fontFamily="IBM Plex Mono, monospace" fontSize="15" fill="#ffffff" fontWeight="600">trunc.sh/aB12xY9z</text>
      <text x="200" y="180" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.2em">·  INSTANT  ·  NO_SIGNUP  ·  TRACKED  ·</text>
      <text x="200" y="194" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.1em">aB12xY9z · k7Pq2mN4 · Rt5hW8jL · 9zQw3vE8</text>
    </svg>
  );
}

export function LoginFlow() {
  return (
    <svg className="mini-flow" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="200" y="13" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// AUTH_FLOW</text>
      <rect x="15" y="26" width="105" height="34" fill="#ffffff" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="25" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" letterSpacing="0.05em">email</text>
      <text x="25" y="53" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#111111">you@…</text>
      <line x1="125" y1="43" x2="172" y2="43" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="168,39 172,43 168,47" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="148" y="36" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">POST /login</text>
      <text x="148" y="58" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#168a46" textAnchor="middle">200 OK</text>
      <rect x="177" y="26" width="80" height="34" fill="#f7f7f7" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="217" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" textAnchor="middle" letterSpacing="0.05em">auth</text>
      <text x="217" y="53" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#111111" textAnchor="middle">$argon2…</text>
      <line x1="262" y1="43" x2="308" y2="43" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="304,39 308,43 304,47" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="285" y="36" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">set cookie</text>
      <text x="285" y="58" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#168a46" textAnchor="middle">HttpOnly</text>
      <rect x="313" y="26" width="72" height="34" fill="#111111" rx="2"/>
      <text x="349" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#999999" textAnchor="middle" letterSpacing="0.05em">jwt</text>
      <text x="349" y="53" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#ffffff" textAnchor="middle">eyJhbG…</text>
      <text x="200" y="92" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// SESSION</text>
      <rect x="30" y="100" width="340" height="34" fill="none" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="40" y="115" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" letterSpacing="0.05em">Set-Cookie</text>
      <text x="40" y="128" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#111111">trunc_session=eyJhbGciOiJIUzI1…; HttpOnly; Secure</text>
      <text x="200" y="158" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#168a46" textAnchor="middle" letterSpacing="0.15em">✓ NO PLAINTEXT STORED</text>
      <text x="200" y="172" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.1em">argon2id · 12 rounds · 24h TTL</text>
      <text x="200" y="190" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.1em">rate_limit · 5/min/IP · same_site=strict</text>
    </svg>
  );
}

export function RegisterFlow() {
  return (
    <svg className="mini-flow" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="200" y="13" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// KEY_DERIVATION</text>
      <rect x="15" y="26" width="115" height="38" fill="#ffffff" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="25" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" letterSpacing="0.05em">password</text>
      <text x="25" y="53" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#111111">••••••••••</text>
      <rect x="25" y="58" width="95" height="2" fill="#d9d9d9" rx="1"/>
      <rect x="25" y="58" width="80" height="2" fill="#111111" rx="1"/>
      <line x1="135" y1="42" x2="178" y2="42" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="174,38 178,42 174,46" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="156" y="35" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">hash()</text>
      <rect x="183" y="26" width="90" height="38" fill="#f7f7f7" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="228" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" textAnchor="middle" letterSpacing="0.05em">argon2id</text>
      <text x="228" y="53" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#111111" textAnchor="middle">12 rounds</text>
      <text x="228" y="62" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">256MB · 200ms</text>
      <line x1="278" y1="42" x2="318" y2="42" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="314,38 318,42 314,46" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="298" y="35" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">store</text>
      <rect x="323" y="26" width="62" height="38" fill="#111111" rx="2"/>
      <text x="354" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#999999" textAnchor="middle" letterSpacing="0.05em">db</text>
      <text x="354" y="54" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#ffffff" textAnchor="middle">$2y$10$…</text>
      <line x1="20" y1="92" x2="20" y2="180" stroke="#d9d9d9" strokeWidth="0.5"/>
      <line x1="200" y1="92" x2="200" y2="180" stroke="#d9d9d9" strokeWidth="0.5"/>
      <line x1="380" y1="92" x2="380" y2="180" stroke="#d9d9d9" strokeWidth="0.5"/>
      <text x="110" y="98" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#707070" textAnchor="middle" letterSpacing="0.12em">// GUARANTEES</text>
      <text x="110" y="118" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#168a46">✓ 0 plaintext stored</text>
      <text x="110" y="132" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#168a46">✓ 0 emails sold</text>
      <text x="110" y="146" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#168a46">✓ 0 trackers</text>
      <text x="110" y="160" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#168a46">✓ PII never logged</text>
      <text x="290" y="98" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#707070" textAnchor="middle" letterSpacing="0.12em">// RULES</text>
      <text x="290" y="118" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#111111">· 8+ chars</text>
      <text x="290" y="132" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#111111">· 1+ number</text>
      <text x="290" y="146" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#111111">· 1+ symbol</text>
      <text x="290" y="160" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070">zxcvbn ≥ 3</text>
      <text x="200" y="190" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.1em">OWASP compliant · 1 account / email</text>
    </svg>
  );
}

export function DashboardFlow() {
  return (
    <svg className="mini-flow" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="200" y="13" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// CLICKS · LAST_7_DAYS</text>
      <line x1="22" y1="28" x2="22" y2="108" stroke="#111111" strokeWidth="0.8"/>
      <line x1="22" y1="108" x2="378" y2="108" stroke="#111111" strokeWidth="0.8"/>
      <text x="18" y="32" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="end">3k</text>
      <text x="18" y="68" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="end">2k</text>
      <text x="18" y="104" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="end">0</text>
      <text x="44" y="120" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">Mon</text>
      <text x="104" y="120" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">Tue</text>
      <text x="164" y="120" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">Wed</text>
      <text x="224" y="120" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">Thu</text>
      <text x="284" y="120" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">Fri</text>
      <text x="344" y="120" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">Sat</text>
      <polyline points="44,90 104,76 164,82 224,52 284,38 344,46" fill="none" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="44" cy="90" r="1.8" fill="#111111"/>
      <circle cx="104" cy="76" r="1.8" fill="#111111"/>
      <circle cx="164" cy="82" r="1.8" fill="#111111"/>
      <circle cx="224" cy="52" r="1.8" fill="#111111"/>
      <circle cx="284" cy="38" r="2.2" fill="#168a46"/>
      <circle cx="344" cy="46" r="1.8" fill="#111111"/>
      <line x1="284" y1="34" x2="284" y2="22" stroke="#111111" strokeWidth="0.5" strokeDasharray="2,2"/>
      <text x="284" y="18" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#111111" textAnchor="middle">PEAK 2,847</text>
      <text x="200" y="138" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// REALTIME_STREAM</text>
      <rect x="20" y="148" width="360" height="20" fill="none" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="30" y="161" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#168a46">▸ 14:23:45</text>
      <text x="105" y="161" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#111111">click aB12xY9z</text>
      <text x="220" y="161" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070">ip 192.0.2…</text>
      <text x="370" y="161" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#111111" textAnchor="end">us-west</text>
      <text x="200" y="188" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.1em">↑ 18% vs last week · 4 countries</text>
    </svg>
  );
}

export function McpFlow() {
  return (
    <svg className="mini-flow" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="200" y="13" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// MCP_HANDSHAKE</text>
      <rect x="15" y="26" width="95" height="44" fill="#ffffff" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="62" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" textAnchor="middle" letterSpacing="0.05em">mcp client</text>
      <text x="62" y="52" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#111111" textAnchor="middle">Claude Desktop</text>
      <text x="62" y="64" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">or any client</text>
      <line x1="115" y1="46" x2="168" y2="46" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="164,42 168,46 164,50" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="141" y="38" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">POST /mcp</text>
      <text x="141" y="58" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#168a46" textAnchor="middle">Bearer jwt</text>
      <rect x="173" y="26" width="100" height="44" fill="#0a0a0a" rx="2"/>
      <text x="223" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#999999" textAnchor="middle" letterSpacing="0.05em">trunc.sh</text>
      <text x="223" y="52" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#37f712" textAnchor="middle">/mcp endpoint</text>
      <text x="223" y="64" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#999999" textAnchor="middle">JSON-RPC 2.0</text>
      <line x1="278" y1="46" x2="330" y2="46" stroke="#111111" strokeWidth="0.8"/>
      <polyline points="326,42 330,46 326,50" fill="none" stroke="#111111" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="304" y="38" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">initialize</text>
      <text x="304" y="58" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#707070" textAnchor="middle">tools/list</text>
      <rect x="335" y="26" width="50" height="44" fill="#ffffff" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="360" y="40" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070" textAnchor="middle" letterSpacing="0.05em">tools</text>
      <text x="360" y="58" fontFamily="IBM Plex Mono, monospace" fontSize="14" fill="#111111" fontWeight="600" textAnchor="middle">9</text>
      <text x="360" y="68" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070" textAnchor="middle">+1 prompt</text>
      <text x="200" y="94" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#707070" textAnchor="middle" letterSpacing="0.15em">// tools/call EXAMPLE</text>
      <rect x="20" y="102" width="360" height="80" fill="none" stroke="#111111" strokeWidth="0.8" rx="2"/>
      <text x="30" y="117" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070">{"{"}</text>
      <text x="42" y="130" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#111111">"method":</text>
      <text x="110" y="130" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#37f712">"shorten_url"</text>
      <text x="195" y="130" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#707070">,</text>
      <text x="42" y="143" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#111111">"params":</text>
      <text x="110" y="143" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#707070">{"{ \"url\":"}</text>
      <text x="160" y="143" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#37f712">"https://…"</text>
      <text x="215" y="143" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#707070">{"}"}</text>
      <text x="30" y="156" fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="#707070">{"}"}</text>
      <text x="42" y="156" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#168a46">→</text>
      <text x="52" y="156" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#168a46">"trunc.sh/aB12xY9z"</text>
      <text x="200" y="174" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#d9d9d9" textAnchor="middle" letterSpacing="0.1em">streamable_http · Server-Sent Events</text>
    </svg>
  );
}

export function PricingFlow() {
  return (
    <svg className="mini-flow" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="200" y="14" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#707070" textAnchor="middle" letterSpacing="0.2em">// PRICING · COMING_SOON</text>
      <rect x="14" y="28" width="118" height="148" fill="none" stroke="#d9d9d9" strokeWidth="0.8"/>
      <rect x="14" y="28" width="118" height="14" fill="#f7f7f7"/>
      <text x="22" y="38" fontFamily="IBM Plex Mono, monospace" fontSize="7" fontWeight="600" fill="#111111" letterSpacing="0.1em">FREE</text>
      <text x="22" y="72" fontFamily="IBM Plex Mono, monospace" fontSize="22" fontWeight="600" fill="#111111">$0</text>
      <text x="52" y="72" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070">/mo</text>
      <line x1="22" y1="84" x2="124" y2="84" stroke="#eeeeee" strokeWidth="0.6"/>
      <text x="22" y="98" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">1k links / mo</text>
      <text x="22" y="112" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">0–30d analytics</text>
      <text x="22" y="126" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">random slugs</text>
      <text x="22" y="140" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">no card required</text>
      <text x="22" y="168" fontFamily="IBM Plex Mono, monospace" fontSize="5.5" fill="#168a46">✓ mit-licensed</text>
      <rect x="141" y="28" width="118" height="148" fill="none" stroke="#111111" strokeWidth="1.2"/>
      <rect x="141" y="28" width="118" height="14" fill="#111111"/>
      <text x="149" y="38" fontFamily="IBM Plex Mono, monospace" fontSize="7" fontWeight="600" fill="#ffffff" letterSpacing="0.1em">PRO</text>
      <text x="149" y="72" fontFamily="IBM Plex Mono, monospace" fontSize="22" fontWeight="600" fill="#111111">$9</text>
      <text x="179" y="72" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#707070">/mo</text>
      <line x1="149" y1="84" x2="251" y2="84" stroke="#eeeeee" strokeWidth="0.6"/>
      <text x="149" y="98" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">50k links / mo</text>
      <text x="149" y="112" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">12mo analytics</text>
      <text x="149" y="126" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">custom slugs</text>
      <text x="149" y="140" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">qr · embed · api</text>
      <text x="149" y="168" fontFamily="IBM Plex Mono, monospace" fontSize="5.5" fill="#168a46">✓ priority_support</text>
      <rect x="268" y="28" width="118" height="148" fill="none" stroke="#d9d9d9" strokeWidth="0.8"/>
      <rect x="268" y="28" width="118" height="14" fill="#f7f7f7"/>
      <text x="276" y="38" fontFamily="IBM Plex Mono, monospace" fontSize="7" fontWeight="600" fill="#111111" letterSpacing="0.1em">TEAM</text>
      <text x="276" y="72" fontFamily="IBM Plex Mono, monospace" fontSize="20" fontWeight="600" fill="#111111">custom</text>
      <text x="276" y="84" fontFamily="IBM Plex Mono, monospace" fontSize="5.5" fill="#707070">contact us</text>
      <line x1="276" y1="94" x2="378" y2="94" stroke="#eeeeee" strokeWidth="0.6"/>
      <text x="276" y="108" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">unlimited links</text>
      <text x="276" y="122" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">team workspaces</text>
      <text x="276" y="136" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">sso · audit log</text>
      <text x="276" y="150" fontFamily="IBM Plex Mono, monospace" fontSize="6" fill="#111111">99.9% sla</text>
      <text x="276" y="170" fontFamily="IBM Plex Mono, monospace" fontSize="5.5" fill="#168a46">✓ white-glove</text>
    </svg>
  );
}
