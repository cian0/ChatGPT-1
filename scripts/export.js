/**
 * @name export.js
 * @version 0.1.3
 * @url https://github.com/lencx/ChatGPT/tree/main/scripts/export.js
 */

async function exportInit() {
  if (window.location.pathname === '/auth/login') return;
  const buttonOuterHTMLFallback = `<button class="btn flex justify-center gap-2 btn-neutral">Try Again</button>`;
  removeButtons();
  if (window.buttonsInterval) {
    clearInterval(window.buttonsInterval);
  }
  if (window.innerWidth < 767) return;

  const chatConf = (await invoke('get_app_conf')) || {};
  window.buttonsInterval = setInterval(() => {
    const formArea = document.querySelector('form>div>div');
    const textarea = formArea.querySelector('div textarea');
    const textareaDiv = formArea.querySelector('div div.absolute');
    const hasBtn = formArea.querySelector('div button');

    if (!formArea || (textarea && textareaDiv) || !hasBtn) {
      return;
    }

    const actionsArea = document.querySelector('form>div>div>div');

    if (shouldAddButtons(actionsArea)) {
      let TryAgainButton = actionsArea.querySelector('button');
      if (!TryAgainButton) {
        const parentNode = document.createElement('div');
        parentNode.innerHTML = buttonOuterHTMLFallback;
        TryAgainButton = parentNode.querySelector('button');
      }
      addActionsButtons(actionsArea, TryAgainButton, chatConf);
    } else if (shouldRemoveButtons()) {
      removeButtons();
    }
  }, 1000);

  const Format = {
    PNG: 'png',
    PDF: 'pdf',
  };

  function shouldRemoveButtons() {
    if (document.querySelector('form .text-2xl')) {
      return true;
    }
    return false;
  }

  function shouldAddButtons(actionsArea) {
    // first, check if there's a "Try Again" button and no other buttons
    const buttons = actionsArea.querySelectorAll('button');

    const hasTryAgainButton = Array.from(buttons).some((button) => {
      return !/download-/.test(button.id);
    });

    const stopBtn = buttons?.[0]?.innerText;

    if (/Stop generating/gi.test(stopBtn)) {
      return false;
    }

    if (
      buttons.length === 2 &&
      (/Regenerate response/gi.test(stopBtn) || buttons[1].innerText === '')
    ) {
      return true;
    }

    if (hasTryAgainButton && buttons.length === 1) {
      return true;
    }

    // otherwise, check if open screen is not visible
    const isOpenScreen = document.querySelector('h1.text-4xl');
    if (isOpenScreen) {
      return false;
    }

    // check if the conversation is finished and there are no share buttons
    const finishedConversation = document.querySelector('form button>svg');
    const hasShareButtons = actionsArea.querySelectorAll('button[share-ext]');
    if (finishedConversation && !hasShareButtons.length) {
      return true;
    }

    return false;
  }

  function removeButtons() {
    const downloadPngButton = document.getElementById('download-png-button');
    const downloadPdfButton = document.getElementById('download-pdf-button');
    const downloadMdButton = document.getElementById('download-markdown-button');
    const refreshButton = document.getElementById('refresh-page-button');
    if (downloadPngButton) {
      downloadPngButton.remove();
    }
    if (downloadPdfButton) {
      downloadPdfButton.remove();
    }
    if (downloadPdfButton) {
      downloadMdButton.remove();
    }
    if (refreshButton) {
      refreshButton.remove();
    }
  }

  function addActionsButtons(actionsArea, TryAgainButton) {
    // Export markdown
    const exportMd = TryAgainButton.cloneNode(true);
    exportMd.id = 'download-markdown-button';
    exportMd.setAttribute('share-ext', 'true');
    exportMd.title = 'Export Markdown';

    exportMd.innerHTML = setIcon('md');
    exportMd.onclick = () => {
      exportMarkdown();
    };
    actionsArea.appendChild(exportMd);

    // Generate PNG
    const downloadPngButton = TryAgainButton.cloneNode(true);
    downloadPngButton.id = 'download-png-button';
    downloadPngButton.setAttribute('share-ext', 'true');
    downloadPngButton.title = 'Generate PNG';
    downloadPngButton.innerHTML = setIcon('png');
    downloadPngButton.onclick = () => {
      downloadThread();
    };
    actionsArea.appendChild(downloadPngButton);

    // Generate PDF
    const downloadPdfButton = TryAgainButton.cloneNode(true);
    downloadPdfButton.id = 'download-pdf-button';
    downloadPdfButton.setAttribute('share-ext', 'true');
    downloadPdfButton.title = 'Download PDF';
    downloadPdfButton.innerHTML = setIcon('pdf');
    downloadPdfButton.onclick = () => {
      downloadThread({ as: Format.PDF });
    };
    actionsArea.appendChild(downloadPdfButton);

    // Refresh
    const refreshButton = TryAgainButton.cloneNode(true);
    refreshButton.id = 'refresh-page-button';
    refreshButton.title = 'Refresh the Page';
    refreshButton.innerHTML = setIcon('refresh');
    refreshButton.onclick = () => {
      window.location.reload();
    };
    actionsArea.appendChild(refreshButton);
  }

  async function exportMarkdown() {
    const content = Array.from(document.querySelectorAll('main div.group'))
      .map((i) => {
        let j = i.cloneNode(true);
        if (/dark\:bg-gray-800/.test(i.getAttribute('class'))) {
          j.innerHTML = `<blockquote>${i.innerHTML}</blockquote>`;
        }
        return j.innerHTML;
      })
      .join('');
    const data = ExportMD.turndown(content);
    const { id, filename } = getName();
    await invoke('save_file', { name: `notes/${id}.md`, content: data });
    await invoke('download_list', { pathname: 'chat.notes.json', filename, id, dir: 'notes' });
  }

  async function downloadThread({ as = Format.PNG } = {}) {
    const { startLoading, stopLoading } = new window.__LoadingMask('Exporting in progress...');
    startLoading();
    const elements = new Elements();
    await elements.fixLocation();
    const pixelRatio = window.devicePixelRatio;
    const minRatio = as === Format.PDF ? 2 : 2.5;
    window.devicePixelRatio = Math.max(pixelRatio, minRatio);

    html2canvas(elements.thread, {
      letterRendering: true,
      useCORS: true,
    }).then((canvas) => {
      elements.restoreLocation();
      window.devicePixelRatio = pixelRatio;
      const imgData = canvas.toDataURL('image/png');
      requestAnimationFrame(async () => {
        if (as === Format.PDF) {
          await handlePdf(imgData, canvas, pixelRatio);
        } else {
          await handleImg(imgData);
        }
        stopLoading();
      });
    });
  }

  async function handleImg(imgData) {
    const binaryData = atob(imgData.split('base64,')[1]);
    const data = [];
    for (let i = 0; i < binaryData.length; i++) {
      data.push(binaryData.charCodeAt(i));
    }
    const name = `ChatGPT_${formatDateTime()}.png`;
    await invoke('download_file', { name: name, blob: data });
  }

  async function handlePdf(imgData, canvas, pixelRatio) {
    const { jsPDF } = window.jspdf;
    const orientation = canvas.width > canvas.height ? 'l' : 'p';
    var pdf = new jsPDF(orientation, 'pt', [canvas.width / pixelRatio, canvas.height / pixelRatio]);
    var pdfWidth = pdf.internal.pageSize.getWidth();
    var pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, '', 'FAST');
    const data = pdf.__private__.getArrayBuffer(pdf.__private__.buildDocument());

    const name = `ChatGPT_${formatDateTime()}.pdf`;
    await invoke('download_file', { name: name, blob: Array.from(new Uint8Array(data)) });
  }

  class Elements {
    constructor() {
      this.init();
    }
    init() {
      this.spacer = document.querySelector("main div[class*='h-'].flex-shrink-0");
      this.thread = document.querySelector(
        "[class*='react-scroll-to-bottom']>[class*='react-scroll-to-bottom']>div",
      );

      // fix: old chat https://github.com/lencx/ChatGPT/issues/185
      if (!this.thread) {
        this.thread = document.querySelector('main .overflow-y-auto');
      }

      // h-full overflow-y-auto
      this.positionForm = document.querySelector('form').parentNode;
      this.scroller = Array.from(document.querySelectorAll('[class*="react-scroll-to"]')).filter(
        (el) => el.classList.contains('h-full'),
      )[0];

      // fix: old chat
      if (!this.scroller) {
        this.scroller = document.querySelector('main .overflow-y-auto');
      }

      this.hiddens = Array.from(document.querySelectorAll('.overflow-hidden'));
      this.images = Array.from(document.querySelectorAll('img[srcset]'));
      this.chatImages = Array.from(document.querySelectorAll('main img[src]'));
    }
    async fixLocation() {
      this.hiddens.forEach((el) => {
        el.classList.remove('overflow-hidden');
      });
      this.spacer.style.display = 'none';
      this.thread.style.maxWidth = '960px';
      this.thread.style.marginInline = 'auto';
      this.positionForm.style.display = 'none';
      this.scroller.classList.remove('h-full');
      this.scroller.style.minHeight = '100vh';
      this.images.forEach((img) => {
        const srcset = img.getAttribute('srcset');
        img.setAttribute('srcset_old', srcset);
        img.setAttribute('srcset', '');
      });

      const chatImagePromises = this.chatImages.map(async (img) => {
        const src = img.getAttribute('src');
        if (!/^http/.test(src)) return;
        const data = await invoke('fetch_image', { url: src });
        const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
        img.src = URL.createObjectURL(blob);
      });
      await Promise.all(chatImagePromises);
    }
    async restoreLocation() {
      this.hiddens.forEach((el) => {
        el.classList.add('overflow-hidden');
      });
      this.spacer.style.display = null;
      this.thread.style.maxWidth = null;
      this.thread.style.marginInline = null;
      this.positionForm.style.display = null;
      this.scroller.classList.add('h-full');
      this.scroller.style.minHeight = null;
    }
  }

  function setIcon(type) {
    return {
      png: `<svg class="chatappico png" viewBox="0 0 1024 1024"><path d="M264.258065 338.580645c16.780387 0 31.281548-6.144 43.536516-18.398968 12.254968-12.221935 18.398968-26.756129 18.398967-43.536516s-6.144-31.281548-18.398967-43.536516A59.524129 59.524129 0 0 0 264.258065 214.709677c-16.780387 0-31.281548 6.144-43.536517 18.398968-12.254968 12.221935-18.398968 26.756129-18.398967 43.536516s6.144 31.281548 18.398967 43.536516c12.221935 12.254968 26.756129 18.398968 43.536517 18.398968zM883.612903 28.903226H140.387097a119.345548 119.345548 0 0 0-87.568516 36.302451A119.345548 119.345548 0 0 0 16.516129 152.774194v743.225806c0 34.188387 12.089806 63.388903 36.302452 87.568516a119.345548 119.345548 0 0 0 87.568516 36.302452h743.225806a119.345548 119.345548 0 0 0 87.568516-36.302452A119.345548 119.345548 0 0 0 1007.483871 896v-743.225806a119.345548 119.345548 0 0 0-36.302452-87.568517A119.345548 119.345548 0 0 0 883.612903 28.903226zM264.258065 152.774194c34.188387 0 63.388903 12.089806 87.568516 36.302451a119.345548 119.345548 0 0 1 36.302451 87.568516 119.345548 119.345548 0 0 1-36.302451 87.568516A119.345548 119.345548 0 0 1 264.258065 400.516129a119.345548 119.345548 0 0 1-87.568517-36.302452A119.345548 119.345548 0 0 1 140.387097 276.645161c0-34.188387 12.089806-63.388903 36.302451-87.568516A119.345548 119.345548 0 0 1 264.258065 152.774194zM140.387097 957.935484c-16.780387 0-31.281548-6.144-43.536516-18.398968a59.524129 59.524129 0 0 1-18.398968-43.536516v-29.035355l245.793032-220.655484L635.870968 957.935484h-495.483871z m805.16129-61.935484c0 16.780387-6.144 31.281548-18.398968 43.536516-12.221935 12.254968-26.756129 18.398968-43.536516 18.398968h-159.677935l-228.385033-231.291871L759.741935 462.451613l185.806452 185.806452v247.741935z" fill="currentColor"></path></svg>`,
      pdf: `<svg class="chatappico pdf" viewBox="0 0 1024 1024"><path d="M821.457602 118.382249H205.725895c-48.378584 0-87.959995 39.583368-87.959996 87.963909v615.731707c0 48.378584 39.581411 87.959995 87.959996 87.959996h615.733664c48.380541 0 87.961952-39.581411 87.961952-87.959996V206.346158c-0.001957-48.378584-39.583368-87.963909-87.963909-87.963909zM493.962468 457.544987c-10.112054 32.545237-21.72487 82.872662-38.806571 124.248336-8.806957 22.378397-8.380404 18.480717-15.001764 32.609808l5.71738-1.851007c58.760658-16.443827 99.901532-20.519564 138.162194-27.561607-7.67796-6.06371-14.350194-10.751884-19.631237-15.586807-26.287817-29.101504-35.464584-34.570387-70.440002-111.862636v0.003913z m288.36767 186.413594c-7.476424 8.356924-20.670227 13.191847-40.019704 13.191847-33.427694 0-63.808858-9.229597-107.79277-31.660824-75.648648 8.356924-156.097 17.214754-201.399704 31.729308-2.199293 0.876587-4.832967 1.759043-7.916674 3.077836-54.536215 93.237125-95.031389 132.767663-130.621199 131.19646-11.286054-0.49895-27.694661-7.044-32.973748-10.11988l-6.52157-6.196764-2.29517-4.353583c-3.07588-7.91863-3.954423-15.395054-2.197337-23.751977 4.838837-23.309771 29.907651-60.251638 82.686779-93.237126 8.356924-6.159587 27.430511-15.897917 45.020944-24.25484 13.311204-21.177004 19.45905-34.744531 36.341171-72.259702 19.102937-45.324228 36.505531-99.492589 47.500041-138.191543v-0.44025c-16.267727-53.219378-25.945401-89.310095-9.67376-147.80856 3.958337-16.71189 18.46702-33.864031 34.748444-33.864031h10.552304c10.115967 0 19.791684 3.520043 26.829814 10.552304 29.029107 29.031064 15.39114 103.824649 0.8805 162.323113-0.8805 2.63563-1.322707 4.832967-1.761 6.153717 17.59239 49.697378 45.400538 98.774492 73.108895 121.647926 11.436717 8.791304 22.638634 18.899444 36.71098 26.814161 19.791684-2.20125 37.517128-4.11487 55.547812-4.11487 54.540128 0 87.525615 9.67963 100.279169 30.351814 4.400543 7.034217 6.595923 15.389184 5.281043 24.1844-0.44025 10.996467-4.39663 21.112434-12.31526 29.031064z m-27.796407-36.748157c-4.394673-4.398587-17.024957-16.936907-78.601259-16.936907-3.073923 0-10.622744-0.784623-14.57521 3.612007 32.104987 14.072347 62.830525 24.757704 83.058545 24.757703 3.083707 0 5.72325-0.442207 8.356923-0.876586h1.759044c2.20125-0.8805 3.520043-1.324663 3.960293-5.71738-0.87463-1.324663-1.757087-3.083707-3.958336-4.838837z m-387.124553 63.041845c-9.237424 5.27713-16.71189 10.112054-21.112433 13.634053-31.226444 28.586901-51.018128 57.616008-53.217422 74.331812 19.789727-6.59788 45.737084-35.626987 74.329855-87.961952v-0.003913z m125.574957-297.822284l2.197336-1.761c3.079793-14.072347 5.232127-29.189554 7.87167-38.869184l1.318794-7.036174c4.39663-25.070771 2.71781-39.720334-4.76057-50.272637l-6.59788-2.20125a57.381208 57.381208 0 0 0-3.079794 5.27713c-7.474467 18.47289-7.063567 55.283661 3.0524 94.865072l-0.001956-0.001957z" fill="currentColor"></path></svg>`,
      md: `<svg class="chatappico md" viewBox="0 0 1024 1024"><path d="M128 128h768a42.666667 42.666667 0 0 1 42.666667 42.666667v682.666666a42.666667 42.666667 0 0 1-42.666667 42.666667H128a42.666667 42.666667 0 0 1-42.666667-42.666667V170.666667a42.666667 42.666667 0 0 1 42.666667-42.666667z m170.666667 533.333333v-170.666666l85.333333 85.333333 85.333333-85.333333v170.666666h85.333334v-298.666666h-85.333334l-85.333333 85.333333-85.333333-85.333333H213.333333v298.666666h85.333334z m469.333333-128v-170.666666h-85.333333v170.666666h-85.333334l128 128 128-128h-85.333333z" fill="currentColor"></path></svg>`,
      refresh: `<svg class="chatappico refresh" viewBox="0 0 1024 1024"><path d="M512 63.5C264.3 63.5 63.5 264.3 63.5 512S264.3 960.5 512 960.5 960.5 759.7 960.5 512 759.7 63.5 512 63.5zM198 509.6h87.6c0-136.3 102.3-243.4 233.7-238.5 43.8 0 82.8 14.6 121.7 34.1L597.2 349c-24.4-9.8-53.6-19.5-82.8-19.5-92.5 0-170.4 77.9-170.4 180.1h87.6L314.8 631.3 198 509.6z m540.3-0.1c0 131.4-102.2 243.4-228.8 243.4-43.8 0-82.8-19.4-121.7-38.9l43.8-43.8c24.4 9.8 53.6 19.5 82.8 19.5 92.5 0 170.4-77.9 170.4-180.1h-92.5l116.9-121.7L826 509.5h-87.7z" fill="currentColor"></path></svg>`,
    }[type];
  }

  function formatDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const formattedDateTime = `${year}_${month}_${day}-${hours}${minutes}${seconds}`;
    return formattedDateTime;
  }

  function getName() {
    const id = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    const name =
      document.querySelector('nav .overflow-y-auto a.hover\\:bg-gray-800')?.innerText?.trim() || '';
    return { filename: name ? name : id, id, pathname: 'chat.download.json' };
  }
}

window.addEventListener('resize', exportInit);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  exportInit();
} else {
  document.addEventListener('DOMContentLoaded', exportInit);
}
