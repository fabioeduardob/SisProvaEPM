import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const colorCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (colorCanvas) {
  colorCanvas.width = 1;
  colorCanvas.height = 1;
}
const colorCtx = colorCanvas ? colorCanvas.getContext('2d', { willReadFrequently: true }) : null;

/**
 * Converts any CSS color (including Tailwind v4 oklch/oklab/color-mix) into standard rgb/rgba
 * so html2canvas never fails or drops styles.
 */
function normalizeCssColor(value: string, fallback = '#000000'): string {
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value === 'none') {
    return 'transparent';
  }
  if (
    !value.includes('oklch') &&
    !value.includes('oklab') &&
    !value.includes('color-mix') &&
    !value.includes('color(')
  ) {
    return value;
  }
  if (!colorCtx) return fallback;
  try {
    colorCtx.clearRect(0, 0, 1, 1);
    colorCtx.fillStyle = value;
    colorCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return 'transparent';
    if (a < 255) return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return fallback;
  }
}

const LAYOUT_AND_TYPOGRAPHY_PROPS = [
  'boxSizing',
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'minWidth',
  'maxWidth',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignContent',
  'alignSelf',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'gap',
  'rowGap',
  'columnGap',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumn',
  'gridRow',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecoration',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
  'verticalAlign',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderCollapse',
  'tableLayout',
] as const;

/**
 * Recursively copies browser-computed styles from the live DOM element onto the cloned DOM element,
 * normalizing all colors to rgb/rgba, and removes external Tailwind v4 @layer stylesheets from the clone
 * so html2canvas renders the exact visual appearance shown on screen.
 */
function inlineComputedStylesDeep(origRoot: HTMLElement, cloneRoot: HTMLElement) {
  const origElements = [origRoot, ...Array.from(origRoot.querySelectorAll<HTMLElement>('*'))];
  const cloneElements = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>('*'))];

  const count = Math.min(origElements.length, cloneElements.length);
  for (let i = 0; i < count; i++) {
    const origEl = origElements[i];
    const cloneEl = cloneElements[i];
    const cs = window.getComputedStyle(origEl);

    for (const prop of LAYOUT_AND_TYPOGRAPHY_PROPS) {
      const val = cs[prop];
      if (val) {
        cloneEl.style[prop as any] = val;
      }
    }

    cloneEl.style.color = normalizeCssColor(cs.color, '#000000');
    cloneEl.style.backgroundColor = normalizeCssColor(cs.backgroundColor, 'transparent');
    cloneEl.style.borderTopColor = normalizeCssColor(cs.borderTopColor, '#000000');
    cloneEl.style.borderRightColor = normalizeCssColor(cs.borderRightColor, '#000000');
    cloneEl.style.borderBottomColor = normalizeCssColor(cs.borderBottomColor, '#000000');
    cloneEl.style.borderLeftColor = normalizeCssColor(cs.borderLeftColor, '#000000');
    cloneEl.style.boxShadow = 'none';
  }
}

async function renderElementToCanvas(element: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const tempId = `pdf-capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const prevDataId = element.getAttribute('data-pdf-capture-id');
  element.setAttribute('data-pdf-capture-id', tempId);

  try {
    return await html2canvas(element, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.offsetWidth,
      height: element.offsetHeight,
      windowWidth: Math.max(document.documentElement.clientWidth, 1280),
      onclone: (clonedDoc: Document) => {
        const clonedTarget = clonedDoc.querySelector<HTMLElement>(
          `[data-pdf-capture-id="${tempId}"]`
        );
        if (clonedTarget) {
          inlineComputedStylesDeep(element, clonedTarget);
          clonedTarget.style.width = `${element.offsetWidth}px`;
          clonedTarget.style.margin = '0';
        }
        // Remove Tailwind v4 @layer / oklch stylesheets after inlining computed styles
        // so html2canvas's CSS parser does not abort or override inline styles
        clonedDoc
          .querySelectorAll('style, link[rel="stylesheet"]')
          .forEach(node => node.parentNode?.removeChild(node));
      },
    });
  } finally {
    if (prevDataId) {
      element.setAttribute('data-pdf-capture-id', prevDataId);
    } else {
      element.removeAttribute('data-pdf-capture-id');
    }
  }
}

interface PageSlice {
  startY: number;
  endY: number;
}

/**
 * Computes vertical page slices [startY, endY] in element pixel coordinates
 * so that no '.pdf-block' is split across pages.
 */
function computeBlockSlices(
  container: HTMLElement,
  blockSelector: string,
  maxPageHeightPx: number
): PageSlice[] {
  const containerRect = container.getBoundingClientRect();
  const totalH = container.offsetHeight;
  const blocks = Array.from(container.querySelectorAll<HTMLElement>(blockSelector));

  if (blocks.length === 0) {
    const slices: PageSlice[] = [];
    for (let y = 0; y < totalH; y += maxPageHeightPx) {
      slices.push({ startY: y, endY: Math.min(y + maxPageHeightPx, totalH) });
    }
    return slices;
  }

  const measured = blocks.map(b => {
    const r = b.getBoundingClientRect();
    return {
      top: Math.max(0, Math.floor(r.top - containerRect.top) - 2),
      bottom: Math.min(totalH, Math.ceil(r.bottom - containerRect.top) + 4),
    };
  });

  const slices: PageSlice[] = [];
  let currentStart = measured[0].top;
  let currentEnd = measured[0].bottom;

  for (let i = 1; i < measured.length; i++) {
    const blk = measured[i];
    if (blk.bottom - currentStart <= maxPageHeightPx) {
      currentEnd = Math.max(currentEnd, blk.bottom);
    } else {
      slices.push({ startY: currentStart, endY: currentEnd });
      currentStart = blk.top;
      currentEnd = blk.bottom;
    }
  }

  slices.push({ startY: currentStart, endY: currentEnd });
  return slices;
}

function addSlicedCanvasPagesToPdf(
  pdf: jsPDF,
  fullCanvas: HTMLCanvasElement,
  containerWidthPx: number,
  slices: PageSlice[],
  scale: number,
  topMarginMm: number,
  startOnNewPage: boolean
) {
  const pageWidthMm = 210;
  const pxToMm = pageWidthMm / containerWidthPx;

  slices.forEach((slice, idx) => {
    if (startOnNewPage || idx > 0) {
      pdf.addPage();
    }

    const sliceHeightPx = Math.max(1, slice.endY - slice.startY);
    const sy = Math.max(0, Math.floor(slice.startY * scale));
    const sh = Math.min(fullCanvas.height - sy, Math.ceil(sliceHeightPx * scale));
    if (sh <= 0) return;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = fullCanvas.width;
    sliceCanvas.height = sh;
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      fullCanvas,
      0,
      sy,
      fullCanvas.width,
      sh,
      0,
      0,
      fullCanvas.width,
      sh
    );

    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.98);
    const sliceHeightMm = sliceHeightPx * pxToMm;
    pdf.addImage(imgData, 'JPEG', 0, topMarginMm, pageWidthMm, sliceHeightMm);
  });
}

/**
 * Exports the Answer Key (#answer-key-preview) to an A4 PDF preserving exact visual formatting
 * and keeping every question card intact across page breaks.
 */
export async function exportAnswerKeyToPdf(container: HTMLElement, filename: string): Promise<void> {
  const scale = 2;
  const containerWidthPx = container.offsetWidth || 794;
  // A4 is 210mm x 297mm. Leaving 16mm top and 16mm bottom margins gives 265mm usable height per page.
  const topMarginMm = 16;
  const usableHeightMm = 297 - topMarginMm * 2;
  const maxPageHeightPx = Math.floor((usableHeightMm / 210) * containerWidthPx);

  const slices = computeBlockSlices(container, '.pdf-block', maxPageHeightPx);
  const fullCanvas = await renderElementToCanvas(container, scale);

  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  addSlicedCanvasPagesToPdf(pdf, fullCanvas, containerWidthPx, slices, scale, topMarginMm, false);
  pdf.save(filename);
}

/**
 * Exports the Exam (#exam-preview) to an A4 PDF:
 * Page 1 is the Cover Page (#exam-cover-page), followed by paginated Question Pages (#exam-questions-page)
 * where no question is cut in half.
 */
export async function exportExamToPdf(container: HTMLElement, filename: string): Promise<void> {
  const scale = 2;
  const coverEl = container.querySelector<HTMLElement>('#exam-cover-page');
  const questionsEl = container.querySelector<HTMLElement>('#exam-questions-page');

  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  if (coverEl) {
    const coverCanvas = await renderElementToCanvas(coverEl, scale);
    const coverImg = coverCanvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(coverImg, 'JPEG', 0, 0, 210, 297);
  }

  if (questionsEl) {
    const qWidthPx = questionsEl.offsetWidth || 794;
    const topMarginMm = 20;
    const usableHeightMm = 297 - topMarginMm * 2;
    const maxPageHeightPx = Math.floor((usableHeightMm / 210) * qWidthPx);

    const slices = computeBlockSlices(questionsEl, '.question-block', maxPageHeightPx);
    const questionsCanvas = await renderElementToCanvas(questionsEl, scale);

    addSlicedCanvasPagesToPdf(
      pdf,
      questionsCanvas,
      qWidthPx,
      slices,
      scale,
      topMarginMm,
      Boolean(coverEl)
    );
  }

  pdf.save(filename);
}
