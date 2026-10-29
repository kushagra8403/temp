/* =====================================================================
   Mascots: small inline SVG characters, one advisor + one newsroom per industry
   ===================================================================== */
const SHADOW = '<ellipse cx="32" cy="60" rx="15" ry="2.6" fill="#000" opacity=".13"/>';
const MASCOTS = {
  penguin: `${SHADOW}
    <ellipse cx="20" cy="40" rx="4" ry="10" fill="#26313a" transform="rotate(18 20 40)"/>
    <ellipse cx="44" cy="40" rx="4" ry="10" fill="#26313a" transform="rotate(-18 44 40)"/>
    <ellipse cx="32" cy="37" rx="15" ry="20" fill="#2e3a44"/>
    <ellipse cx="32" cy="41" rx="10" ry="14" fill="#f3f1ec"/>
    <path d="M20 24h24v3a4 4 0 0 1-4 4h-4a3 3 0 0 1-3-3 3 3 0 0 1-3 3h-4a4 4 0 0 1-4-4z" fill="#15191d"/>
    <rect x="21" y="25" width="7" height="1.4" rx=".7" fill="#7f97a3" opacity=".8"/>
    <path d="M29 32h6l-3 4z" fill="#d39b4e"/>
    <ellipse cx="26" cy="58" rx="5" ry="2" fill="#d39b4e"/><ellipse cx="38" cy="58" rx="5" ry="2" fill="#d39b4e"/>`,
  fox: `${SHADOW}
    <path d="M44 50c10 0 14-8 12-14-3 6-8 7-12 7z" fill="#c07a46"/><path d="M53 38c2 2 3 4 3 6-2-1-3-3-3-6z" fill="#f2ede4"/>
    <ellipse cx="32" cy="46" rx="12" ry="12" fill="#c07a46"/>
    <ellipse cx="32" cy="49" rx="6" ry="8" fill="#f2ede4"/>
    <path d="M18 14l6 12h-8zM46 14l2 12h-8z" fill="#b36d3b"/><path d="M19 17l3 7h-4zM45 17l1 7h-4z" fill="#3a2b25"/>
    <path d="M16 26c0-6 7-10 16-10s16 4 16 10c0 5-7 12-16 12S16 31 16 26z" fill="#c9834d"/>
    <path d="M22 30c3 5 7 8 10 8s7-3 10-8c-4 2-7 2-10 2s-6 0-10-2z" fill="#f2ede4"/>
    <ellipse cx="25" cy="25" rx="2" ry="2.4" fill="#22201e"/><ellipse cx="39" cy="25" rx="2" ry="2.4" fill="#22201e"/>
    <circle cx="25.7" cy="24.2" r=".7" fill="#fff"/><circle cx="39.7" cy="24.2" r=".7" fill="#fff"/>
    <ellipse cx="32" cy="34" rx="2.2" ry="1.6" fill="#22201e"/>`,
  rabbit: `${SHADOW}
    <path d="M7 34h8M5 40h9M8 46h7" stroke="var(--muted)" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="25" cy="12" rx="4.5" ry="12" fill="#ddd6cf" transform="rotate(-10 25 12)"/>
    <ellipse cx="39" cy="12" rx="4.5" ry="12" fill="#ddd6cf" transform="rotate(10 39 12)"/>
    <ellipse cx="25" cy="13" rx="2" ry="8" fill="#d9a9a6" transform="rotate(-10 25 13)"/>
    <ellipse cx="39" cy="13" rx="2" ry="8" fill="#d9a9a6" transform="rotate(10 39 13)"/>
    <ellipse cx="32" cy="46" rx="13" ry="12" fill="#e7e1da"/>
    <circle cx="32" cy="29" r="11" fill="#ece6df"/>
    <circle cx="28" cy="28" r="1.8" fill="#2a2524"/><circle cx="36" cy="28" r="1.8" fill="#2a2524"/>
    <path d="M30.5 32h3l-1.5 1.6z" fill="#c98f8c"/><path d="M32 33.6v1.6M30 35.5c1 .8 3 .8 4 0" stroke="#7d6a66" stroke-width=".9" fill="none" stroke-linecap="round"/>
    <circle cx="25" cy="32" r="2" fill="#e3b8b4" opacity=".6"/><circle cx="39" cy="32" r="2" fill="#e3b8b4" opacity=".6"/>
    <ellipse cx="24" cy="57" rx="6" ry="2.6" fill="#ddd6cf"/><ellipse cx="40" cy="57" rx="6" ry="2.6" fill="#ddd6cf"/>`,
  bee: `${SHADOW}
    <ellipse cx="22" cy="24" rx="9" ry="6" fill="#dfe7ea" opacity=".85" transform="rotate(-25 22 24)"/>
    <ellipse cx="42" cy="24" rx="9" ry="6" fill="#dfe7ea" opacity=".85" transform="rotate(25 42 24)"/>
    <path d="M27 17c-2-5-5-7-7-7M37 17c2-5 5-7 7-7" stroke="#3a3530" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="10" r="1.8" fill="#3a3530"/><circle cx="44" cy="10" r="1.8" fill="#3a3530"/>
    <ellipse cx="32" cy="40" rx="15" ry="17" fill="#d9a948"/>
    <path d="M18 36h28M17.5 44h29M20.5 52h23" stroke="#3a3530" stroke-width="4.2"/>
    <circle cx="32" cy="24" r="9" fill="#e0b553"/>
    <circle cx="28.5" cy="23" r="1.8" fill="#2a2524"/><circle cx="35.5" cy="23" r="1.8" fill="#2a2524"/>
    <path d="M29 27.5c2 1.5 4 1.5 6 0" stroke="#2a2524" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  robot: `${SHADOW}
    <path d="M32 6v6" stroke="#5d6670" stroke-width="2"/><circle cx="32" cy="5" r="2.5" fill="var(--second)"/>
    <rect x="17" y="12" width="30" height="20" rx="5" fill="#8b949c"/>
    <rect x="21" y="16" width="22" height="11" rx="3" fill="#2a3036"/>
    <rect x="24" y="19" width="5" height="4" rx="1" fill="#9fc3c9"/><rect x="35" y="19" width="5" height="4" rx="1" fill="#9fc3c9"/>
    <rect x="29" y="32" width="6" height="3" fill="#6e7780"/>
    <rect x="18" y="35" width="28" height="19" rx="4" fill="#9aa2a9"/>
    <rect x="24" y="40" width="16" height="7" rx="2" fill="#7c858d"/><circle cx="28" cy="43.5" r="1.4" fill="var(--second)"/><circle cx="32" cy="43.5" r="1.4" fill="#9fc3c9"/><circle cx="36" cy="43.5" r="1.4" fill="#c6c9b9"/>
    <rect x="10" y="37" width="7" height="4" rx="2" fill="#7c858d"/><rect x="47" y="37" width="7" height="4" rx="2" fill="#7c858d"/>
    <rect x="22" y="54" width="7" height="5" rx="1.5" fill="#5d6670"/><rect x="35" y="54" width="7" height="5" rx="1.5" fill="#5d6670"/>`,
  owl: `${SHADOW}
    <path d="M18 18l4 6h-6zM46 18l-4 6h6z" fill="#6f5a48"/>
    <ellipse cx="32" cy="40" rx="17" ry="19" fill="#7d6754"/>
    <ellipse cx="32" cy="45" rx="10" ry="12" fill="#c9b49a"/>
    <path d="M26 42q2 2 4 0M34 42q2 2 4 0M28 48q2 2 4 0M32 48q2 2 4 0" stroke="#9d876d" stroke-width="1" fill="none"/>
    <circle cx="25" cy="30" r="7" fill="#efe8dc"/><circle cx="39" cy="30" r="7" fill="#efe8dc"/>
    <circle cx="25" cy="30" r="3.2" fill="#2a2420"/><circle cx="39" cy="30" r="3.2" fill="#2a2420"/>
    <circle cx="26" cy="29" r="1" fill="#fff"/><circle cx="40" cy="29" r="1" fill="#fff"/>
    <circle cx="25" cy="30" r="7.6" fill="none" stroke="#3b332d" stroke-width="1.2"/><circle cx="39" cy="30" r="7.6" fill="none" stroke="#3b332d" stroke-width="1.2"/><path d="M32.6 30h-1.2" stroke="#3b332d" stroke-width="1.2"/>
    <path d="M30 35h4l-2 4z" fill="#d1a053"/>
    <path d="M24 59v-3M28 59v-3M36 59v-3M40 59v-3" stroke="#d1a053" stroke-width="2" stroke-linecap="round"/>`,
  eagle: `${SHADOW}
    <path d="M14 34c-4 8-3 16 3 20l5-14zM50 34c4 8 3 16-3 20l-5-14z" fill="#5e4636"/>
    <ellipse cx="32" cy="43" rx="15" ry="16" fill="#6b4f3c"/>
    <path d="M17 26c0-9 7-14 15-14s15 5 15 14c0 6-6 11-15 11S17 32 17 26z" fill="#f1ede6"/>
    <path d="M25 22l5 2M39 22l-5 2" stroke="#3a312b" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="27" cy="26" r="1.9" fill="#2a2420"/><circle cx="37" cy="26" r="1.9" fill="#2a2420"/>
    <path d="M28 30h8c0 4-2 7-5 8 1-2 1-4-3-5z" fill="#d6a443"/>
    <path d="M26 59v-3M30 59v-3M34 59v-3M38 59v-3" stroke="#d6a443" stroke-width="2" stroke-linecap="round"/>`,
  parrot: `${SHADOW}
    <path d="M27 56l-4 6M32 57v6M37 56l4 6" stroke="#4f7d8f" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="32" cy="42" rx="12" ry="15" fill="#5f9474"/>
    <path d="M22 38c-6 6-6 14 0 18l4-10z" fill="#4c7a5f"/>
    <path d="M27 10c2-4 6-5 8-3-3 0-4 2-5 4M31 9c3-3 8-2 9 1-3-1-5 0-7 2" fill="#b8564f"/>
    <circle cx="32" cy="24" r="11" fill="#6aa080"/>
    <circle cx="35" cy="22" r="3.4" fill="#f0ece4"/><circle cx="35.6" cy="22" r="1.7" fill="#2a2420"/>
    <path d="M39 25c6 0 8 5 5 9-1-3-3-4-6-4z" fill="#e1c27a"/><path d="M39 30c2 0 3 1 3 3-1-1-2-1-3-1z" fill="#3a332c"/>
    <circle cx="29" cy="28" r="2.2" fill="#c9786f" opacity=".6"/>`,
  squirrel: `${SHADOW}
    <path d="M42 56c14 0 18-14 12-26-4-8-14-8-16-2 6-2 10 2 10 8 0 6-6 10-10 10z" fill="#a8744a"/>
    <path d="M47 38c3 0 5 4 4 8" stroke="#c99570" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="30" cy="45" rx="11" ry="13" fill="#b07c52"/>
    <ellipse cx="29" cy="48" rx="6" ry="8" fill="#ead9c3"/>
    <path d="M21 14l3 8h-6zM35 13l1 9h-6z" fill="#9a6943"/>
    <circle cx="28" cy="27" r="10" fill="#b8845a"/>
    <circle cx="24.5" cy="25.5" r="1.9" fill="#2a2420"/><circle cx="32.5" cy="25.5" r="1.9" fill="#2a2420"/>
    <ellipse cx="28.5" cy="30" rx="1.8" ry="1.3" fill="#3a2b25"/>
    <ellipse cx="29" cy="40" rx="4.2" ry="3.4" fill="#8a5b3a"/><path d="M26 38.5h6" stroke="#6a4630" stroke-width="1.2"/>`,
  dish: `${SHADOW}
    <path d="M40 10a10 10 0 0 1 10 10M40 4a16 16 0 0 1 16 16" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>
    <path d="M28 40l-8 18h24l-8-18z" fill="#7c858d"/>
    <rect x="18" y="56" width="28" height="4" rx="1.5" fill="#5d6670"/>
    <path d="M12 30c4-14 20-22 32-14L20 40C14 38 11 35 12 30z" fill="#c9cfd3"/>
    <path d="M16 31c4-10 15-15 24-12" stroke="#a7b0b6" stroke-width="1.3" fill="none"/>
    <path d="M26 27l11-6" stroke="#5d6670" stroke-width="1.6"/><circle cx="38" cy="20.5" r="2.4" fill="var(--second)"/>
    <circle cx="28" cy="40" r="3" fill="#5d6670"/>
    <circle cx="23" cy="30" r="1.6" fill="#2a3036"/><circle cx="29" cy="27" r="1.6" fill="#2a3036"/><path d="M24 34c2 1 4 0 5-2" stroke="#2a3036" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
};
function mascotSVG(kind, size = 64) {
  return `<svg class="mascot-svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${MASCOTS[kind] || ''}</svg>`;
}
