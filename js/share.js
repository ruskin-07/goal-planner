// Result-URL encode/decode + WhatsApp canvas card.

import { track, EVENTS } from './analytics.js';

const SCHEMA_VERSION = '1';
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// (1) URL encode/decode — versioned param schema so old links keep working.

export function buildShareURL(inputs) {
  const params = new URLSearchParams();
  params.set('v', SCHEMA_VERSION);
  params.set('n', inputs.goalName || '');
  params.set('t', String(inputs.targetAmount));
  params.set('s', String(inputs.currentSavings));
  params.set('i', String(inputs.monthlyIncome));
  params.set('e', String(inputs.monthlyExpenses));
  if (inputs.targetDate) {
    params.set('dm', String(inputs.targetDate.getMonth() + 1));
    params.set('dy', String(inputs.targetDate.getFullYear()));
  }

  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}

export function decodeStateFromURL(search = window.location.search) {
  const params = new URLSearchParams(search);
  if (params.get('v') !== SCHEMA_VERSION) return null;

  const goalName = params.get('n');
  const targetAmount = Number(params.get('t'));
  const currentSavings = Number(params.get('s'));
  const monthlyIncome = Number(params.get('i'));
  const monthlyExpenses = Number(params.get('e'));

  const amountsValid = [targetAmount, currentSavings, monthlyIncome, monthlyExpenses].every(Number.isFinite);
  if (!goalName || !amountsValid) return null;

  let targetDate = null;
  const dm = Number(params.get('dm'));
  const dy = Number(params.get('dy'));
  if (Number.isInteger(dm) && dm >= 1 && dm <= 12 && Number.isInteger(dy) && dy > 0) {
    targetDate = new Date(dy, dm - 1, 1);
  }

  return { goalName, targetAmount, currentSavings, monthlyIncome, monthlyExpenses, targetDate };
}

// (2) Shareable canvas card — goal name, the big date, brand line, site URL.
// No personal financial numbers: never draw savings, income, expenses, or gap amounts here.

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function drawCard({ goalName, bigLine }) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  gradient.addColorStop(0, '#2563eb');
  gradient.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  ctx.font = '600 48px -apple-system, sans-serif';
  wrapText(ctx, goalName, CARD_WIDTH / 2, 620, CARD_WIDTH - 160, 62);

  ctx.font = '800 92px -apple-system, sans-serif';
  wrapText(ctx, bigLine, CARD_WIDTH / 2, 900, CARD_WIDTH - 120, 106);

  ctx.font = '500 36px -apple-system, sans-serif';
  ctx.fillText('Planned on Goal Planner', CARD_WIDTH / 2, 1700);

  ctx.globalAlpha = 0.85;
  ctx.font = '400 30px -apple-system, sans-serif';
  ctx.fillText(window.location.host, CARD_WIDTH / 2, 1750);
  ctx.globalAlpha = 1;

  return canvas;
}

// Share button wiring — reads whatever whatif.js currently has rendered as the headline.

let currentInputs = null;
let currentShareUrl = '';

export function initShare(inputs) {
  currentInputs = inputs;
}

function getBigLine() {
  const headline = document.getElementById('reveal-headline');
  return headline ? headline.textContent.trim() : '';
}

function handleShareClick() {
  if (!currentInputs) return;

  currentShareUrl = buildShareURL(currentInputs);
  const goalName = currentInputs.goalName || 'My goal';
  const canvas = drawCard({ goalName, bigLine: getBigLine() });
  const dataUrl = canvas.toDataURL('image/png');

  const preview = document.getElementById('share-card-preview');
  const downloadLink = document.getElementById('share-download-link');
  const whatsappLink = document.getElementById('share-whatsapp-link');
  const panel = document.getElementById('share-panel');

  preview.src = dataUrl;
  downloadLink.href = dataUrl;

  const whatsappText = `${goalName} — planned on Goal Planner: ${currentShareUrl}`;
  whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  panel.hidden = false;
}

async function handleCopyLinkClick(copyBtn) {
  if (!currentShareUrl) return;

  try {
    await navigator.clipboard.writeText(currentShareUrl);
  } catch {
    return; // clipboard permission denied or unavailable — don't claim success or track a share that didn't happen
  }

  track(EVENTS.RESULT_SHARED, { method: 'link' });

  const originalLabel = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyBtn.textContent = originalLabel;
  }, 1500);
}

function attachListeners() {
  const shareBtn = document.getElementById('share-btn');
  const closeBtn = document.getElementById('share-close-btn');
  const panel = document.getElementById('share-panel');
  const downloadLink = document.getElementById('share-download-link');
  const whatsappLink = document.getElementById('share-whatsapp-link');
  const copyLinkBtn = document.getElementById('share-copy-link-btn');
  if (!shareBtn || !closeBtn || !panel || !downloadLink || !whatsappLink || !copyLinkBtn) return;

  shareBtn.addEventListener('click', handleShareClick);
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
  });

  // Only two events send result_shared: WhatsApp (opens with the link pre-filled) and
  // Copy link (link copied to the clipboard). Downloading the PNG is not a link share.
  whatsappLink.addEventListener('click', () => {
    track(EVENTS.RESULT_SHARED, { method: 'whatsapp' });
  });
  copyLinkBtn.addEventListener('click', () => handleCopyLinkClick(copyLinkBtn));
}

attachListeners();
