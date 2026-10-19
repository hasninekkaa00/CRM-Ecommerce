/**
 * Universal & Bulletproof Printing Utility for Google AI Studio Build
 * Solves the blank page issue completely by using isolated iframe printing
 * and unconstrained styling across all browsers, modals, and preview environments.
 */

export interface PrintOptions {
  title?: string;
  printableElementId?: string;
  modalId?: string;
  targetElement?: HTMLElement | null;
  isLandscape?: boolean;
  extraStyles?: string;
}

/**
 * Triggers clean, blank-free print for any element, modal, or report.
 */
export function triggerPrint(options?: PrintOptions) {
  const targetId = options?.printableElementId || options?.modalId;
  const docTitle = options?.title || document.title || 'طباعة مستند';
  const isLandscape = !!options?.isLandscape;

  // 1. Locate the target element
  let targetEl: HTMLElement | null = null;
  if (options?.targetElement) {
    targetEl = options.targetElement;
  } else if (targetId) {
    targetEl = document.getElementById(targetId);
  }

  // Fallback: search for any printable area or open modal in the DOM
  if (!targetEl) {
    const candidate = document.querySelector<HTMLElement>(
      '[id^="printable-"], .printable-area, [role="dialog"] > div, .fixed.inset-0 > div'
    );
    if (candidate) {
      targetEl = candidate;
    } else {
      targetEl = document.querySelector('main') || document.body;
    }
  }

  if (!targetEl) {
    window.print();
    return;
  }

  // 2. Clone the element to safely prepare it for printing without affecting the live UI
  const cloned = targetEl.cloneNode(true) as HTMLElement;

  // Remove any explicit print:hidden or no-print elements from the cloned tree
  const hiddenElements = cloned.querySelectorAll('.print\\:hidden, .print-hidden, .no-print');
  hiddenElements.forEach(el => el.remove());

  // Reveal elements intended specifically for print
  const printOnlyElements = cloned.querySelectorAll<HTMLElement>(
    '.hidden.print\\:block, .print\\:block, [class*="print:block"]'
  );
  printOnlyElements.forEach(el => {
    el.style.display = 'block';
    el.classList.remove('hidden');
  });

  const printTableCells = cloned.querySelectorAll<HTMLElement>(
    '.hidden.print\\:table-cell, .print\\:table-cell'
  );
  printTableCells.forEach(el => {
    el.style.display = 'table-cell';
    el.classList.remove('hidden');
  });

  // Remove restrictive height & overflow constraints from all containers inside the clone
  cloned.style.overflow = 'visible';
  cloned.style.maxHeight = 'none';
  cloned.style.height = 'auto';
  cloned.style.position = 'static';
  cloned.style.boxShadow = 'none';
  cloned.style.border = 'none';

  const scrollContainers = cloned.querySelectorAll<HTMLElement>(
    '.overflow-hidden, .overflow-y-auto, .overflow-x-auto, [class*="max-h-"], [class*="h-["]'
  );
  scrollContainers.forEach(sc => {
    sc.style.overflow = 'visible';
    sc.style.maxHeight = 'none';
    sc.style.height = 'auto';
  });

  // 3. Collect active CSS stylesheets from the main document (including Tailwind CSS)
  let collectedStyles = '';
  try {
    const styleNodes = document.querySelectorAll('link[rel="stylesheet"], style');
    styleNodes.forEach(node => {
      collectedStyles += node.outerHTML + '\n';
    });
  } catch (err) {
    console.warn('Could not collect style nodes:', err);
  }

  // 4. Create an isolated hidden printing iframe
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;z-index:-99999;opacity:0;');
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc || !iframe.contentWindow) {
    // If iframe creation fails, fallback to in-place print
    fallbackInPlacePrint(targetEl, options);
    return;
  }

  const printDocumentHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  ${collectedStyles}
  <style>
    @page {
      size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
      margin: 8mm 10mm 10mm 10mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      width: 100% !important;
      height: auto !important;
      min-height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Tajawal', system-ui, -apple-system, sans-serif !important;
      direction: rtl !important;
    }
    .print\\:hidden, .no-print, button:not(.printable-button), input[type="file"], .toast, [data-hot-toast] {
      display: none !important;
      visibility: hidden !important;
    }
    .hidden.print\\:block, .print\\:block {
      display: block !important;
      visibility: visible !important;
    }
    .hidden.print\\:table-cell, .print\\:table-cell {
      display: table-cell !important;
      visibility: visible !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      border-color: #cbd5e1 !important;
    }
    .print-box {
      border: 2px solid #334155 !important;
      width: 16px !important;
      height: 16px !important;
      display: inline-block !important;
      border-radius: 3px !important;
    }
    ${options?.extraStyles || ''}
  </style>
</head>
<body dir="rtl" class="p-6 bg-white text-slate-900">
  <div class="print-isolated-sheet w-full">
    ${cloned.outerHTML}
  </div>
</body>
</html>`;

  try {
    iframeDoc.open();
    iframeDoc.write(printDocumentHtml);
    iframeDoc.close();
  } catch (err) {
    console.error('Error writing to print iframe:', err);
    fallbackInPlacePrint(targetEl, options);
    return;
  }

  // 5. Trigger the print once resources are rendered
  const executeIframePrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('iframe.print failed, attempting in-place fallback:', err);
      fallbackInPlacePrint(targetEl, options);
    } finally {
      // Safe cleanup after print dialogue finishes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  };

  // Wait for images if any exist
  const images = iframeDoc.getElementsByTagName('img');
  if (images.length > 0) {
    let loaded = 0;
    const total = images.length;
    const onImgDone = () => {
      loaded++;
      if (loaded >= total) executeIframePrint();
    };
    for (let i = 0; i < total; i++) {
      const img = images[i];
      if (img.complete) {
        onImgDone();
      } else {
        img.onload = onImgDone;
        img.onerror = onImgDone;
      }
    }
    // Safety timeout in case an image takes too long or fails silently
    setTimeout(() => {
      if (loaded < total) executeIframePrint();
    }, 600);
  } else {
    // Small delay for DOM layout & styling pass
    setTimeout(executeIframePrint, 250);
  }
}

/**
 * Fallback in-place print if iframe printing is blocked
 */
function fallbackInPlacePrint(targetEl: HTMLElement, options?: PrintOptions) {
  const originalTitle = document.title;
  if (options?.title) {
    document.title = options.title;
  }

  document.body.classList.add('print-focus-mode');
  targetEl.classList.add('print-focused-element');

  if (options?.isLandscape) {
    document.body.classList.add('print-landscape');
  }

  try {
    window.print();
  } catch (err) {
    console.error('Window print error:', err);
  } finally {
    const cleanup = () => {
      document.title = originalTitle;
      document.body.classList.remove('print-focus-mode', 'print-landscape');
      targetEl.classList.remove('print-focused-element');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 2500);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
