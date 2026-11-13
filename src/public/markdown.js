(function initMarkdown() {
  function escHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPlainContent(content) {
    return escHtml(content).replace(/\n/g, '<br>');
  }

  let markdownConfigured = false;

  function configureMarkdown() {
    if (markdownConfigured || typeof marked === 'undefined') return;
    markdownConfigured = true;

    marked.use({
      breaks: true,
      gfm: true,
      renderer: {
        link({ href, title, tokens }) {
          const text = this.parser.parseInline(tokens);
          const safeHref = escHtml(href || '');
          const titleAttr = title ? ` title="${escHtml(title)}"` : '';
          return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
        },
      },
    });
  }

  function formatMarkdownContent(content) {
    const text = String(content ?? '');
    if (!text) return '';

    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      return formatPlainContent(text);
    }

    configureMarkdown();

    const html = marked.parse(text);
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel', 'class', 'title'],
    });
  }

  window.formatMarkdownContent = formatMarkdownContent;
  window.formatPlainContent = formatPlainContent;
})();
