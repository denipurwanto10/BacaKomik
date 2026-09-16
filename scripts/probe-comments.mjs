const r = await fetch('https://komiku.org/asset/js/memberv1.5.js', { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://komiku.org/' } });
const t = await r.text();
for (const m of t.matchAll(/sticker/gi)) {
  console.log('---', m.index);
  console.log(JSON.stringify(t.slice(m.index - 200, m.index + 400)).slice(0, 650));
}
