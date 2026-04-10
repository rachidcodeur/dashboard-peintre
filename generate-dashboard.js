#!/usr/bin/env node
/**
 * Génère le dashboard HTML récapitulatif de tous les sites peintres déployés.
 * Scanne le dossier output/ pour trouver les départements générés.
 *
 * Usage : node dashboard-peintre/generate-dashboard.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const OUTPUT    = path.join(ROOT, 'output');
const COMMUNES  = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'communes.json'), 'utf8'));
const DASH_DIR  = path.join(ROOT, 'dashboard-peintre');

// ─── Index des communes par dep_code ─────────────────────────────────────────

const depNames = {};
COMMUNES.forEach(c => { if (!depNames[c.dep_code]) depNames[c.dep_code] = c.dep_nom; });

// ─── Scan des dossiers output/ ───────────────────────────────────────────────

function scanDepartments() {
  if (!fs.existsSync(OUTPUT)) return [];

  const entries = fs.readdirSync(OUTPUT).filter(d =>
    fs.statSync(path.join(OUTPUT, d)).isDirectory()
  );

  // Dossiers villes : {code}-{nom}  (ex: 33-gironde)
  // Dossiers dep :    {code}-{nom}-dep (ex: 33-gironde-dep)
  const depPattern = /^(\d{1,3})-(.+?)(?:-dep)?$/;
  const depsMap = {};

  entries.forEach(dir => {
    const m = dir.match(depPattern);
    if (!m) return;
    const code = m[1];
    if (!depsMap[code]) depsMap[code] = { code, nom: '', cities: [], hasDepSite: false };

    if (dir.endsWith('-dep')) {
      depsMap[code].hasDepSite = true;
    } else {
      // Scan les sous-dossiers (villes)
      const villesDir = path.join(OUTPUT, dir);
      const cities = fs.readdirSync(villesDir).filter(f =>
        fs.statSync(path.join(villesDir, f)).isDirectory()
      );
      depsMap[code].cities = cities.sort();
    }
  });

  // Noms des départements
  Object.values(depsMap).forEach(dep => {
    dep.nom = depNames[dep.code] || dep.code;
  });

  return Object.values(depsMap).sort((a, b) => {
    const cA = String(a.code).padStart(3, '0');
    const cB = String(b.code).padStart(3, '0');
    return cA.localeCompare(cB);
  });
}

// ─── Recherche du nom standard de la commune ─────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, '-').replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

const communeBySlugDep = {};
COMMUNES.forEach(c => {
  const key = `${slugify(c.nom_sans_accent)}::${c.dep_code}`;
  communeBySlugDep[key] = c;
});

function getCommuneName(slug, depCode) {
  const c = communeBySlugDep[`${slug}::${depCode}`];
  return c ? c.nom_standard : slug;
}

function getCommunePopulation(slug, depCode) {
  const c = communeBySlugDep[`${slug}::${depCode}`];
  return c && c.population ? parseInt(c.population, 10) : 0;
}

// ─── Génération HTML ─────────────────────────────────────────────────────────

const departments = scanDepartments();
const totalSites  = departments.reduce((s, d) => s + d.cities.length, 0);
const totalDeps   = departments.length;

function encodeQ(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

function generateIndex() {
  const cards = departments.map(dep => {
    const depCode = String(dep.code).padStart(2, '0');
    return `
        <a href="dep-${dep.code}.html" class="dep-card">
          <div class="dep-card-icon">🌐</div>
          <div class="dep-card-title">Peintre en Bâtiment ${depCode}</div>
          <div class="dep-card-count">${dep.cities.length} sites</div>
          <div class="dep-card-name">${dep.nom}</div>
        </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Peintres France</title>
  <style>${getCSS()}</style>
</head>
<body>
  <header class="dash-header">
    <h1>Sites Peintres en Bâtiment</h1>
    <div class="badge">${totalSites} sites en ligne · ${totalDeps} départements</div>
  </header>

  <main class="container">
    <div class="search-box">
      <input type="text" id="search" placeholder="Rechercher un département..." autocomplete="off">
    </div>

    <div class="dep-grid" id="dep-grid">
${cards}
    </div>
  </main>

  <script>
    const input = document.getElementById('search');
    const grid  = document.getElementById('dep-grid');
    const cards = [...grid.querySelectorAll('.dep-card')];
    input.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      cards.forEach(c => {
        const text = c.textContent.toLowerCase();
        c.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

function generateDepPage(dep) {
  const depCode = String(dep.code).padStart(2, '0');
  const domainBase = `peintre-en-batiment-${dep.code}.com`;

  const rows = dep.cities.map((slug, i) => {
    const name = getCommuneName(slug, dep.code);
    const pop  = getCommunePopulation(slug, dep.code);
    const url  = `${slug}.${domainBase}`;
    const fullUrl = `https://${url}`;
    const kw   = `peintre en batiment ${name}`;

    return `
          <tr>
            <td class="row-num">${i + 1}.</td>
            <td class="row-name">
              <a href="${fullUrl}" target="_blank" rel="noopener">${url}</a>
              ${pop ? `<span class="pop">🏠 ${pop.toLocaleString('fr-FR')}</span>` : ''}
            </td>
            <td class="row-actions">
              <a href="${fullUrl}" target="_blank" title="Ouvrir le site" class="action-btn">🔗</a>
              <a href="https://developers.google.com/speed/pagespeed/insights/?url=${url}" target="_blank" title="PageSpeed" class="action-btn">⚡</a>
              <a href="https://www.google.com/search?q=site:${url}" target="_blank" title="Indexation Google" class="action-btn action-g">G<sub>i</sub></a>
              <a href="https://www.google.com/search?q=${encodeQ(kw)}" target="_blank" title="Position Google" class="action-btn action-g">G</a>
              <a href="https://www.bing.com/search?q=${encodeQ(kw)}" target="_blank" title="Position Bing" class="action-btn action-b">B</a>
            </td>
          </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dep.nom} (${depCode}) — Dashboard Peintres</title>
  <style>${getCSS()}</style>
</head>
<body>
  <header class="dash-header">
    <a href="index.html" class="back-link">← Retour</a>
    <h1>Peintre en Bâtiment <span class="accent">${dep.nom} (${depCode})</span></h1>
    <div class="badge">${dep.cities.length} sites en ligne</div>
  </header>

  <main class="container">
    <div class="search-box">
      <input type="text" id="search" placeholder="Rechercher une ville ou un lien..." autocomplete="off">
      <div class="search-count" id="search-count">${dep.cities.length} sites affichés</div>
    </div>

    <div class="dep-detail-card">
      <div class="dep-detail-header">
        🌐 peintre-en-batiment-${dep.code}.com · ${dep.cities.length} sites
      </div>
      <table class="sites-table" id="sites-table">
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
  </main>

  <script>
    const input = document.getElementById('search');
    const table = document.getElementById('sites-table');
    const rows  = [...table.querySelectorAll('tr')];
    const count = document.getElementById('search-count');
    input.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      let n = 0;
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        const show = !q || text.includes(q);
        r.style.display = show ? '' : 'none';
        if (show) n++;
      });
      count.textContent = n + ' site' + (n > 1 ? 's' : '') + ' affiché' + (n > 1 ? 's' : '');
    });
  </script>
</body>
</html>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function getCSS() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f4f7f9;
      color: #1a1a1a;
      min-height: 100vh;
    }
    a { color: inherit; text-decoration: none; }

    .dash-header {
      text-align: center;
      padding: 2.5rem 1rem 1.5rem;
    }
    .dash-header h1 {
      font-size: 2rem;
      font-weight: 800;
      color: #003c57;
      margin-bottom: .6rem;
    }
    .accent { color: #007198; }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #04bbff, #007198);
      color: #fff;
      padding: .45rem 1.4rem;
      border-radius: 50px;
      font-size: .95rem;
      font-weight: 600;
    }
    .back-link {
      display: inline-block;
      color: #007198;
      font-size: .9rem;
      margin-bottom: .5rem;
      transition: opacity .2s;
    }
    .back-link:hover { opacity: .7; }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    /* Search */
    .search-box {
      max-width: 560px;
      margin: 0 auto 2rem;
      text-align: center;
    }
    .search-box input {
      width: 100%;
      padding: .85rem 1.2rem;
      border-radius: 12px;
      border: 1px solid rgba(0, 60, 87, 0.15);
      background: #fff;
      color: #1a1a1a;
      font-size: 1rem;
      outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    .search-box input::placeholder { color: #999; }
    .search-box input:focus {
      border-color: #04bbff;
      box-shadow: 0 0 0 3px rgba(4, 187, 255, 0.18);
    }
    .search-count {
      margin-top: .5rem;
      font-size: .85rem;
      color: #888;
    }

    /* Department cards grid */
    .dep-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }
    .dep-card {
      background: linear-gradient(145deg, #04bbff, #007198);
      border-radius: 14px;
      padding: 1.3rem;
      transition: transform .2s, box-shadow .2s;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      color: #fff;
    }
    .dep-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 32px rgba(0, 113, 152, 0.3);
    }
    .dep-card-icon {
      position: absolute;
      top: 1rem;
      right: 1rem;
      font-size: 1.3rem;
      opacity: .6;
    }
    .dep-card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: .35rem;
    }
    .dep-card-count {
      color: rgba(255, 255, 255, 0.9);
      font-weight: 700;
      font-size: .95rem;
    }
    .dep-card-name {
      color: rgba(255, 255, 255, 0.7);
      font-size: .85rem;
      margin-top: .15rem;
    }

    /* Department detail */
    .dep-detail-card {
      background: #fff;
      border: 1px solid rgba(0, 60, 87, 0.1);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 60, 87, 0.06);
    }
    .dep-detail-header {
      background: linear-gradient(135deg, #04bbff, #007198);
      color: #fff;
      padding: 1rem 1.5rem;
      font-weight: 700;
      font-size: 1rem;
    }

    /* Sites table */
    .sites-table {
      width: 100%;
      border-collapse: collapse;
    }
    .sites-table tr {
      border-bottom: 1px solid rgba(0, 60, 87, 0.06);
      transition: background .15s;
    }
    .sites-table tr:hover {
      background: rgba(4, 187, 255, 0.05);
    }
    .sites-table td {
      padding: .75rem 1rem;
      vertical-align: middle;
    }
    .row-num {
      color: #007198;
      font-weight: 700;
      width: 3rem;
      text-align: center;
    }
    .row-name a {
      color: #1a1a1a;
      font-weight: 500;
      transition: color .15s;
    }
    .row-name a:hover { color: #007198; }
    .pop {
      margin-left: .6rem;
      color: #007198;
      font-size: .85rem;
    }
    .row-actions {
      text-align: right;
      white-space: nowrap;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: linear-gradient(135deg, #04bbff, #007198);
      margin-left: 4px;
      font-size: .8rem;
      transition: transform .15s, box-shadow .15s;
      color: #fff;
    }
    .action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 12px rgba(0, 113, 152, 0.3);
    }
    .action-g { font-weight: 700; font-size: .85rem; }
    .action-b { font-weight: 700; font-size: .85rem; }

    @media (max-width: 640px) {
      .dash-header h1 { font-size: 1.4rem; }
      .dep-grid { grid-template-columns: repeat(2, 1fr); gap: .7rem; }
      .dep-card { padding: 1rem; }
      .row-actions { display: none; }
    }
  `;
}

// ─── Écriture ────────────────────────────────────────────────────────────────

fs.writeFileSync(path.join(DASH_DIR, 'index.html'), generateIndex(), 'utf8');
console.log(`✅  Dashboard index → ${totalDeps} départements, ${totalSites} sites`);

departments.forEach(dep => {
  fs.writeFileSync(
    path.join(DASH_DIR, `dep-${dep.code}.html`),
    generateDepPage(dep),
    'utf8'
  );
});

console.log(`✅  ${departments.length} pages département générées dans dashboard-peintre/`);
