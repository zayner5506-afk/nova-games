/* Unblocked Games Platform - Main JS */
(function() {
  'use strict';

  /* ========== Lazy Image Loading ========== */
  var lazyObserver = null;

  function loadImage(img) {
    if (!img.dataset.src) return;
    // Set srcset first if available, then src
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
      img.removeAttribute('data-srcset');
    }
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    img.onload = function() { img.classList.add('loaded'); };
    img.onerror = function() {
      // If resized version fails, try the original full-size image
      var origSrc = img.src.replace(/-\d+x\d+\./, '.');
      if (origSrc !== img.src) {
        img.srcset = '';
        img.src = origSrc;
        img.onerror = function() {
          img.style.display = 'none';
          var placeholder = img.parentElement.querySelector('.thumb-placeholder');
          if (placeholder) placeholder.style.display = 'flex';
        };
        return;
      }
      img.style.display = 'none';
      var placeholder = img.parentElement.querySelector('.thumb-placeholder');
      if (placeholder) placeholder.style.display = 'flex';
    };
  }

  function initLazyImages() {
    if ('IntersectionObserver' in window && !lazyObserver) {
      lazyObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            loadImage(entry.target);
            lazyObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '300px' });
    }
    observeNewImages();
  }

  function observeNewImages() {
    var images = document.querySelectorAll('img[data-src]');
    if (!images.length) return;

    if (lazyObserver) {
      images.forEach(function(img) {
        // Only observe images whose parent card is visible
        var card = img.closest('.game-card');
        if (!card || !card.classList.contains('hidden-by-pagination')) {
          lazyObserver.observe(img);
        }
      });
    } else {
      // Fallback: load all visible images directly
      images.forEach(function(img) {
        var card = img.closest('.game-card');
        if (!card || !card.classList.contains('hidden-by-pagination')) {
          loadImage(img);
        }
      });
    }
  }

  /* ========== Search Filter ========== */
  function isHomepage() {
    return !!document.getElementById('game-grid');
  }

  function getHomeUrl() {
    // Find the home link in the header to get the correct relative path
    var homeLink = document.querySelector('.logo');
    return homeLink ? homeLink.getAttribute('href') : '/';
  }

  function initSearch() {
    var searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    // On non-homepage: Enter key navigates to homepage with query
    if (!isHomepage()) {
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var query = searchInput.value.trim();
          if (query) {
            var home = getHomeUrl();
            window.location.href = home + '?q=' + encodeURIComponent(query);
          }
        }
      });
      return;
    }

    // Homepage: live filtering
    var cards = document.querySelectorAll('.game-card');
    var noResults = document.getElementById('no-results');
    var resultsInfo = document.getElementById('results-info');
    var debounceTimer;

    function filterCards(query) {
      var visibleCount = 0;

      cards.forEach(function(card) {
        var title = (card.dataset.title || '').toLowerCase();
        var cats = (card.dataset.categories || '').toLowerCase();
        var match = !query || title.indexOf(query) !== -1 || cats.indexOf(query) !== -1;
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      }
      if (resultsInfo) {
        if (query) {
          resultsInfo.textContent = visibleCount + ' game' + (visibleCount !== 1 ? 's' : '') + ' found';
        } else {
          resultsInfo.textContent = '';
        }
      }

      var loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.style.display = query ? 'none' : '';
      }
      if (query) {
        cards.forEach(function(card) {
          if (card.style.display !== 'none') {
            card.classList.remove('hidden-by-pagination');
          }
        });
        scheduleObserve();
      } else {
        resetPagination();
      }
    }

    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        filterCards(searchInput.value.toLowerCase().trim());
      }, 150);
    });

    // Check for ?q= parameter on page load
    var params = new URLSearchParams(window.location.search);
    var q = params.get('q');
    if (q) {
      searchInput.value = q;
      filterCards(q.toLowerCase().trim());
    }
  }

  /* ========== Category Tab Filtering ========== */
  function initCategoryTabs() {
    var tabs = document.querySelectorAll('.cat-tab');
    if (!tabs.length) return;

    var cards = document.querySelectorAll('.game-card');
    var noResults = document.getElementById('no-results');

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        // Update active tab
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');

        var category = tab.dataset.category;
        var visibleCount = 0;

        cards.forEach(function(card) {
          var cats = (card.dataset.categories || '').toLowerCase();
          var match = category === 'all' || cats.indexOf(category.toLowerCase()) !== -1;
          card.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        });

        if (noResults) {
          noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }

        // Clear search when switching categories
        var searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';

        // Reset pagination for new filter
        resetPagination();
      });
    });
  }

  /* ========== Load More Pagination ========== */
  var ITEMS_PER_PAGE = 60;
  var currentlyShown = 0;

  function resetPagination() {
    var cards = document.querySelectorAll('.game-card');
    var visibleCards = [];
    cards.forEach(function(card) {
      if (card.style.display !== 'none') {
        visibleCards.push(card);
      }
    });

    currentlyShown = 0;
    visibleCards.forEach(function(card) {
      card.classList.add('hidden-by-pagination');
    });

    showMore(visibleCards);
  }

  function showMore(cards) {
    if (!cards) {
      cards = [];
      document.querySelectorAll('.game-card').forEach(function(card) {
        if (card.style.display !== 'none') {
          cards.push(card);
        }
      });
    }

    var end = Math.min(currentlyShown + ITEMS_PER_PAGE, cards.length);
    for (var i = currentlyShown; i < end; i++) {
      cards[i].classList.remove('hidden-by-pagination');
    }
    currentlyShown = end;

    var loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = currentlyShown >= cards.length ? 'none' : '';
    }

    // Wait for browser to layout the newly visible cards, then observe their images
    scheduleObserve();
  }

  function scheduleObserve() {
    requestAnimationFrame(function() {
      observeNewImages();
    });
  }

  function initLoadMore() {
    var loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;

    // Initial load
    resetPagination();

    loadMoreBtn.addEventListener('click', function() {
      showMore();
    });
  }

  /* ========== Click-to-Play Game Launcher ========== */
  function initGameLauncher() {
    var overlay = document.getElementById('game-play-overlay');
    var wrap = document.getElementById('game-frame-wrap');
    if (!overlay || !wrap) return;

    overlay.addEventListener('click', function() {
      var gameUrl = wrap.dataset.src;
      if (!gameUrl) return;

      // Instant visual feedback
      var playBtn = overlay.querySelector('.game-play-btn');
      if (playBtn) {
        playBtn.style.transform = 'translate(-50%, -50%) scale(0.9)';
        playBtn.style.opacity = '0.7';
      }

      // Yield to paint, then do heavy work
      requestAnimationFrame(function() {
        setTimeout(function() {
          // Remove overlay
          overlay.remove();

          // Create iframe
          var iframe = document.createElement('iframe');
          iframe.id = 'game-frame';
          iframe.className = 'game-iframe';
          iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad *;');
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('title', document.title);

          // Insert iframe before fullscreen button
          var fsBtn = document.getElementById('fullscreen-btn');
          wrap.insertBefore(iframe, fsBtn);

          // Set src after DOM insertion
          iframe.src = gameUrl;

          // Show fullscreen button
          if (fsBtn) fsBtn.style.display = '';

          // Smooth scroll to game
          wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      });
    });
  }

  /* ========== Fullscreen Toggle (real browser fullscreen) ========== */
  function initFullscreen() {
    var btn = document.getElementById('fullscreen-btn');
    var wrap = document.getElementById('game-frame-wrap');
    if (!btn || !wrap) return;

    btn.addEventListener('click', function() {
      var isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
      if (isFS) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
      } else {
        var rfs = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.msRequestFullscreen;
        if (rfs) rfs.call(wrap);
      }
    });

    // Update button text and class when fullscreen changes
    function onFSChange() {
      var isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
      if (isFS) {
        wrap.classList.add('fullscreen');
        btn.textContent = '\u2716 Exit Fullscreen';
      } else {
        wrap.classList.remove('fullscreen');
        btn.textContent = '\u26F6 Fullscreen';
      }
    }

    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('MSFullscreenChange', onFSChange);
  }

  /* ========== Hidden by pagination CSS ========== */
  function injectPaginationCSS() {
    var style = document.createElement('style');
    style.textContent = '.game-card.hidden-by-pagination { display: none !important; }';
    document.head.appendChild(style);
  }

  /* ========== Init ========== */
  document.addEventListener('DOMContentLoaded', function() {
    injectPaginationCSS();
    initLazyImages();
    initSearch();
    initCategoryTabs();
    initLoadMore();
    initGameLauncher();
    initFullscreen();
  });

})();
