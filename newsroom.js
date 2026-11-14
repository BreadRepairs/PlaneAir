const newsroomState = {
  articles: [],
  selectedCategory: 'all',
  keyword: '',
};

const validCategories = new Set([
  'Company News',
  'Fleet Updates',
  'New Routes',
  'Flight Operations',
  'Travel Information',
  'Announcements',
]);

function showStatus(message, isError = true) {
  const banner = document.querySelector('[data-status-banner]');
  if (!banner) return;

  banner.textContent = message;
  banner.classList.toggle('visible', Boolean(message));
  banner.style.background = isError ? 'rgba(217, 91, 97, 0.08)' : 'rgba(43, 182, 115, 0.08)';
  banner.style.color = isError ? '#d95b61' : '#2bb673';
  banner.style.borderColor = isError ? 'rgba(217, 91, 97, 0.15)' : 'rgba(43, 182, 115, 0.15)';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseArticleDate(value) {
  if (!value || typeof value !== 'string') {
    return new Date(NaN);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return new Date(NaN);
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const match = trimmed.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (match) {
    return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T00:00:00`);
  }

  return new Date(NaN);
}

function formatArticleDate(value) {
  if (!value) return 'Date not provided';

  const parsed = parseArticleDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function normalizeArticle(rawArticle, index) {
  if (!rawArticle || typeof rawArticle !== 'object' || Array.isArray(rawArticle)) {
    return null;
  }

  const article = {
    id: typeof rawArticle.id === 'string' ? rawArticle.id.trim() : '',
    title: typeof rawArticle.title === 'string' ? rawArticle.title.trim() : '',
    category: typeof rawArticle.category === 'string' ? rawArticle.category.trim() : '',
    date: typeof rawArticle.date === 'string' ? rawArticle.date.trim() : '',
    author: typeof rawArticle.author === 'string' ? rawArticle.author.trim() : '',
    summary: typeof rawArticle.summary === 'string' ? rawArticle.summary.trim() : '',
    content: typeof rawArticle.content === 'string' ? rawArticle.content.trim() : '',
    image: typeof rawArticle.image === 'string' && rawArticle.image.trim() ? rawArticle.image.trim().replace(/\\/g, '/') : '',
    featured: Boolean(rawArticle.featured),
    published: Boolean(rawArticle.published),
  };

  if (!article.id || !article.title || !article.category || !article.author || !article.summary || !article.content) {
    return null;
  }

  if (article.category && !validCategories.has(article.category)) {
    return null;
  }

  if (article.image && (!article.image.startsWith('images/newsroom/') || article.image.includes('..') || article.image.startsWith('/'))) {
    article.image = '';
  }

  return article;
}

function getPublishedArticles() {
  return newsroomState.articles
    .filter((article) => article && article.published)
    .sort((first, second) => {
      const firstDate = parseArticleDate(first.date);
      const secondDate = parseArticleDate(second.date);
      const firstTime = Number.isNaN(firstDate.getTime()) ? 0 : firstDate.getTime();
      const secondTime = Number.isNaN(secondDate.getTime()) ? 0 : secondDate.getTime();
      return secondTime - firstTime;
    });
}

function getFilteredArticles() {
  const published = getPublishedArticles();
  const query = newsroomState.keyword.trim().toLowerCase();
  return published.filter((article) => {
    const categoryMatch = newsroomState.selectedCategory === 'all' || article.category === newsroomState.selectedCategory;
    if (!categoryMatch) return false;

    if (!query) return true;

    const haystack = [
      article.title,
      article.summary,
      article.category,
      article.content,
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });
}

function renderEmptyState(message) {
  const list = document.querySelector('[data-newsroom-list]');
  if (!list) return;

  list.innerHTML = `<div class="empty-state"><strong>PlaneAir Newsroom</strong><br>${escapeHtml(message)}</div>`;
}

function renderCategoryFilters() {
  const root = document.querySelector('[data-newsroom-categories]');
  if (!root) return;

  const published = getPublishedArticles();
  const categories = ['all', ...new Set(published.map((article) => article.category))];

  root.innerHTML = categories.map((category) => {
    const label = category === 'all' ? 'All' : category;
    const selected = newsroomState.selectedCategory === category ? 'is-selected' : '';
    return `<button type="button" class="newsroom-category ${selected}" data-category="${escapeHtml(category)}" aria-pressed="${newsroomState.selectedCategory === category}">${escapeHtml(label)}</button>`;
  }).join('');

  root.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      newsroomState.selectedCategory = button.dataset.category;
      renderCategoryFilters();
      renderArticles();
    });
  });
}

function createArticleCard(article) {
  const card = document.createElement('article');
  card.className = 'newsroom-card';

  if (article.image) {
    const image = document.createElement('img');
    image.className = 'newsroom-card-image';
    image.src = article.image;
    image.alt = article.title;
    image.loading = 'lazy';
    image.onerror = () => {
      image.remove();
    };
    card.append(image);
  }

  const content = document.createElement('div');
  content.className = 'newsroom-card-content';

  const meta = document.createElement('div');
  meta.className = 'newsroom-meta';
  meta.innerHTML = `
    <span class="newsroom-category-label">${escapeHtml(article.category)}</span>
    <span>${escapeHtml(formatArticleDate(article.date))}</span>
  `;
  content.append(meta);

  const title = document.createElement('h3');
  title.className = 'newsroom-card-title';
  title.textContent = article.title;
  content.append(title);

  const summary = document.createElement('p');
  summary.className = 'newsroom-card-summary';
  summary.textContent = article.summary;
  content.append(summary);

  const footer = document.createElement('div');
  footer.className = 'newsroom-card-meta';
  footer.innerHTML = `<span>By ${escapeHtml(article.author)}</span><a href="article.html?id=${encodeURIComponent(article.id)}" class="newsroom-link">Read article</a>`;
  content.append(footer);

  card.append(content);
  return card;
}

function renderFeatured() {
  const root = document.querySelector('[data-newsroom-featured]');
  if (!root) return;

  const featured = getPublishedArticles().filter((article) => article.featured);
  if (!featured.length) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = featured.slice(0, 2).map((article) => {
    const imageMarkup = article.image ? `<img class="featured-card-image" src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" loading="lazy" />` : '';
    return `
      <article class="featured-card">
        ${imageMarkup}
        <div class="featured-card-content">
          <span class="newsroom-category-label">Featured • ${escapeHtml(article.category)}</span>
          <h2>${escapeHtml(article.title)}</h2>
          <p>${escapeHtml(article.summary)}</p>
          <div class="newsroom-card-meta">
            <span>${escapeHtml(formatArticleDate(article.date))}</span>
            <a href="article.html?id=${encodeURIComponent(article.id)}" class="newsroom-link">Read article</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderArticles() {
  const list = document.querySelector('[data-newsroom-list]');
  if (!list) return;

  const filtered = getFilteredArticles();
  if (!filtered.length) {
    renderEmptyState('No news articles match your search and selected filter.');
    return;
  }

  const articlesToRender = filtered.filter((article) => !article.featured);
  if (!articlesToRender.length) {
    renderEmptyState('No news articles match your search and selected filter.');
    return;
  }

  list.innerHTML = '';
  articlesToRender.forEach((article) => {
    list.append(createArticleCard(article));
  });
}

function renderNewsroomPage() {
  const articles = getPublishedArticles();
  if (!articles.length) {
    renderEmptyState('No news articles have been published yet. Check back later!');
    renderFeatured();
    renderCategoryFilters();
    return;
  }

  renderCategoryFilters();
  renderFeatured();
  renderArticles();
}

function initNewsroomPage() {
  const searchInput = document.querySelector('[data-newsroom-search]');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      newsroomState.keyword = event.target.value;
      renderArticles();
    });
  }

  renderNewsroomPage();
}

function renderArticlePage(article) {
  const root = document.querySelector('[data-article-view]');
  if (!root) return;

  const paragraphs = article.content.split(/\n+/).map((block) => block.trim()).filter(Boolean);

  root.innerHTML = `
    <article class="article-layout">
      <div class="article-content-panel">
        ${article.image ? `<img class="article-image" src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" />` : ''}
        <div class="article-header">
          <span class="eyebrow">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <div class="article-meta">
            <span>${escapeHtml(formatArticleDate(article.date))}</span>
            <span>By ${escapeHtml(article.author)}</span>
          </div>
        </div>
        <p class="article-summary">${escapeHtml(article.summary)}</p>
        <div class="article-body">
          ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        </div>
      </div>
      <aside class="article-side-panel">
        <div class="article-side-box">
          <span class="newsroom-category-label">Category</span>
          <strong>${escapeHtml(article.category)}</strong>
        </div>
        <div class="article-side-box">
          <span class="newsroom-category-label">Published</span>
          <strong>${escapeHtml(formatArticleDate(article.date))}</strong>
        </div>
        <div class="article-side-box">
          <span class="newsroom-category-label">Author</span>
          <strong>${escapeHtml(article.author)}</strong>
        </div>
      </aside>
    </article>
  `;
}

function initArticlePage() {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('id');

  if (!articleId) {
    const root = document.querySelector('[data-article-view]');
    if (root) {
      root.innerHTML = '<div class="empty-state">The requested article could not be found.</div>';
    }
    return;
  }

  const targetId = String(articleId).trim();
  const article = getPublishedArticles().find((item) => item.id === targetId);

  if (!article) {
    const root = document.querySelector('[data-article-view]');
    if (root) {
      root.innerHTML = '<div class="empty-state">The requested article is unavailable or is not currently published.</div>';
    }
    return;
  }

  renderArticlePage(article);
}

async function loadNewsroom() {
  try {
    const response = await fetch('./newsroom.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load newsroom.json (${response.status}).`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('newsroom.json contains invalid JSON. Check the file syntax and try again.');
    }

    if (!data || !Array.isArray(data.articles)) {
      throw new Error('newsroom.json must contain an "articles" array.');
    }

    const normalized = [];
    data.articles.forEach((entry, index) => {
      const article = normalizeArticle(entry, index + 1);
      if (article) {
        normalized.push(article);
      }
    });

    newsroomState.articles = normalized;
    const pageType = document.body.dataset.page;

    if (pageType === 'newsroom') {
      initNewsroomPage();
    }

    if (pageType === 'article') {
      initArticlePage();
    }
  } catch (error) {
    showStatus(error.message || 'Unable to load newsroom data.', true);
    const emptyList = document.querySelector('[data-newsroom-list]');
    if (emptyList) {
      renderEmptyState('No news articles have been published yet. Check back later!');
    }
    const articleRoot = document.querySelector('[data-article-view]');
    if (articleRoot) {
      articleRoot.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Unable to load the requested article.')}</div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadNewsroom();
});
