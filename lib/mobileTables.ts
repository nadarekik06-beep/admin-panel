// Phones: wide tables become one card per row instead of scrolling sideways.
// Every column stays: each cell shows its column title as a label, the first
// few cells and any cell with buttons/inputs stay visible, the rest open with
// a "Details ▾" button at the bottom of the card. Styles: .ct-cards in globals.css.
// Only tables that do not fit their box are converted, so small tables that
// already fit stay as they are. Desktop (≥ 768px) is untouched (CSS is mobile-only).
// Opt out with <table data-ct-cards="off">; keep more cells open with data-ct-keep="N",
// or name the always-visible columns with data-ct-show="0,3,6" (column indexes).

const MOBILE_MAX = 767;
const DEFAULT_KEEP = 3;

const LABELS: Record<string, { more: string; less: string }> = {
  fr: { more: 'Détails', less: 'Moins' },
  en: { more: 'Details', less: 'Less' },
  ar: { more: 'التفاصيل', less: 'أقل' },
};

function words() {
  const lang = (document.documentElement.lang || 'fr').slice(0, 2);
  return LABELS[lang] ?? LABELS.fr;
}

function headerLabels(table: HTMLTableElement): string[] {
  const head = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!head) return [];
  const out: string[] = [];
  for (const th of Array.from(head.cells)) {
    const text = (th.innerText || th.textContent || '').replace(/\s+/g, ' ').trim();
    const span = th.colSpan || 1;
    for (let i = 0; i < span; i++) out.push(text);
  }
  return out;
}

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"]';

function enhanceRow(tr: HTMLTableRowElement, labels: string[], keep: number, show: Set<number> | null) {
  const cells = Array.from(tr.cells).filter(c => !c.classList.contains('ct-more'));
  // Full-width rows (empty state, expanded sub-rows) stay as one block.
  if (cells.length === 1 && cells[0].colSpan > 1) {
    tr.dataset.ctFull = '1';
    return;
  }
  let col = 0;
  let shown = 0;
  let hidden = 0;
  for (const td of cells) {
    const label = labels[col] ?? '';
    if (td.dataset.label !== label) td.dataset.label = label;
    const index = col;
    col += td.colSpan || 1;
    const empty = !(td.innerText || '').trim() && !td.querySelector('img, svg, input, button, select');
    const isAction = !!td.querySelector(INTERACTIVE) && !td.querySelector('a[href] img');
    if (isAction || (show ? show.has(index) : shown < keep)) {
      td.removeAttribute('data-ct-extra');
      if (!empty) shown++;
    } else {
      td.dataset.ctExtra = '1';
      if (!empty) hidden++;
    }
  }
  let more = tr.querySelector<HTMLTableCellElement>(':scope > td.ct-more');
  if (hidden === 0) {
    more?.remove();
    return;
  }
  if (!more) {
    more = document.createElement('td');
    more.className = 'ct-more';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ct-more-btn';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const open = tr.dataset.ctOpen === '1';
      if (open) delete tr.dataset.ctOpen; else tr.dataset.ctOpen = '1';
      paintButton(btn, !open);
    });
    more.appendChild(btn);
    tr.appendChild(more);
  }
  paintButton(more.querySelector('button')!, tr.dataset.ctOpen === '1');
}

function paintButton(btn: HTMLButtonElement, open: boolean) {
  const w = words();
  const text = `${open ? w.less : w.more} ${open ? '▴' : '▾'}`;
  if (btn.textContent !== text) btn.textContent = text;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/** Labels and card borders need to know if the card sits on a dark background. */
function isDarkBehind(el: HTMLElement): boolean {
  for (let a: HTMLElement | null = el; a; a = a.parentElement) {
    const m = getComputedStyle(a).backgroundColor.match(/[\d.]+/g);
    if (!m) continue;
    const [r, g, b, alpha = '1'] = m;
    if (Number(alpha) < 0.5) continue;
    return 0.299 * +r + 0.587 * +g + 0.114 * +b < 128;
  }
  return false;
}

function overflows(table: HTMLTableElement): boolean {
  const box = table.parentElement;
  if (!box) return false;
  const bs = getComputedStyle(box);
  // the box's inner width (its padding is not room for the table)
  const inner = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
  const width = Math.min(inner, window.innerWidth);
  return table.scrollWidth > width + 2
    || table.getBoundingClientRect().right > window.innerWidth + 2
    // the table fits but a cell's content sticks out of its scroll box
    || (bs.overflowX !== 'visible' && box.scrollWidth > box.clientWidth + 2);
}

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.ctCards === 'off') return;
  if (table.closest('[data-ct-cards="off"]')) return;
  if (!table.classList.contains('ct-cards')) {
    if (!overflows(table)) return;
    table.classList.add('ct-cards');
  }
  const labels = headerLabels(table);
  const keep = Number(table.dataset.ctKeep) || DEFAULT_KEEP;
  const show = table.dataset.ctShow ? new Set(table.dataset.ctShow.split(',').map(Number)) : null;
  const dark = isDarkBehind(table) ? '1' : '0';
  if (table.dataset.ctDark !== dark) table.dataset.ctDark = dark;
  for (const body of Array.from(table.tBodies)) {
    for (const tr of Array.from(body.rows)) enhanceRow(tr, labels, keep, show);
  }
}

let scheduled = false;
function scan() {
  scheduled = false;
  if (window.innerWidth > MOBILE_MAX) return;
  document.querySelectorAll<HTMLTableElement>('table').forEach(enhanceTable);
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  // after React has committed (and hydrated) the change
  window.setTimeout(scan, 60);
}

/** Starts the enhancer; returns a cleanup function. */
export function installMobileTables(): () => void {
  const obs = new MutationObserver(muts => {
    // our own writes (labels, the Details cell) don't need another pass
    for (const m of muts) {
      const t = m.target as HTMLElement;
      if (m.type === 'attributes') continue;
      if (t.classList?.contains('ct-more') || t.classList?.contains('ct-more-btn')) continue;
      schedule();
      return;
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    obs.disconnect();
    window.removeEventListener('resize', schedule);
  };
}
