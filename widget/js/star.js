// star.js - Star Rating Widget by © giahuy.net
(function () {
  'use strict';

  if (typeof ghRatings === 'undefined' || ghRatings.sharedBy !== 'www.giahuy.net') {
    location.href = 'https://www.giahuy.net/p/credit.html';
    return;
  }

  const container = document.getElementById('ratingContainer');
  if (!container) return;

  const firebaseUrl = ghRatings.firebaseUrl.replace(/\/$/, '');
  const postId = container.getAttribute('data-id') || 'unknown';
  let fingerprint = '';
  let rated = false;

  container.innerHTML = `
    <div class="gh-rating-area">
      <div class="gh-stars" id="ghStars"></div>
      <div class="gh-rating-info" id="ghInfo">Đang tải...</div>
    </div>
    <div class="gh-rating-thumbs" id="ghThumbs">
      ${[5, 4, 3, 2, 1].map(i => `
        <div class="gh-rating-progress" data-rate="${i}">
          <div class="label">${i}★</div>
          <div class="bar-container"><div class="bar-fill" style="width:0%"></div></div>
          <div class="count">0</div>
        </div>
      `).join('')}
    </div>
  `;

  const starsWrap = container.querySelector('#ghStars');
  const infoWrap = container.querySelector('#ghInfo');
  const thumbsWrap = container.querySelector('#ghThumbs');

  function getFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText(navigator.userAgent, 2, 2);
      return btoa(canvas.toDataURL()).slice(0, 32);
    } catch {
      return 'anonymous';
    }
  }

  function renderStars(score, hover = 0) {
    starsWrap.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("data-star", i);
      svg.innerHTML = `<path d="M12 .587l3.668 7.431L24 9.423l-6 5.849
      1.417 8.268L12 18.897 4.583 23.54 6 15.272
      0 9.423l8.332-1.405z"/>`;
      if (hover > 0) {
        svg.classList.add(i <= hover ? 'hovered' : 'empty');
      } else {
        svg.classList.add(i <= score ? 'filled' : 'empty');
      }
      starsWrap.appendChild(svg);
    }
  }

  function render(data) {
    const count = data?.count || 0;
    const sum = data?.sum || 0;
    const fps = data?.fingerprints || {};
    const avg = count ? (sum / count) : 0;

    renderStars(avg);
    infoWrap.textContent = count ? `${avg.toFixed(1)}/5 từ ${count} lượt` : 'Chưa có đánh giá';

    // Thống kê
    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const key in fps) {
      const v = parseInt(fps[key]);
      if (v >= 1 && v <= 5) starCounts[v]++;
    }

    container.querySelectorAll('.gh-rating-progress').forEach(el => {
      const rate = parseInt(el.getAttribute('data-rate'));
      const val = starCounts[rate] || 0;
      const percent = count ? (val / count * 100).toFixed(1) : 0;
      el.querySelector('.bar-fill').style.width = percent + '%';
      el.querySelector('.count').textContent = `${val}`;
    });

    if (fps[fingerprint]) {
      rated = true;
      renderStars(fps[fingerprint]);
    }
  }

  function sendRating(score) {
    fetch(`${firebaseUrl}/ghRatings/${postId}.json`)
      .then(r => r.json())
      .then(data => {
        const count = data?.count || 0;
        const sum = data?.sum || 0;
        const fps = data?.fingerprints || {};
        if (fps[fingerprint]) return;

        const newData = {
          sum: sum + score,
          count: count + 1,
          fingerprints: { ...fps, [fingerprint]: score }
        };

        return fetch(`${firebaseUrl}/ghRatings/${postId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newData)
        });
      })
      .then(() => {
        rated = true;
        renderStars(score);
        infoWrap.textContent = "Cảm ơn bạn đã đánh giá!";
        setTimeout(load, 2000);
      });
  }

  function bindEvents() {
    starsWrap.addEventListener('mouseover', function (e) {
      if (rated) return;
      const star = e.target.closest('svg');
      if (!star) return;
      const val = parseInt(star.getAttribute('data-star'));
      renderStars(0, val);
    });

    starsWrap.addEventListener('mouseout', function () {
      if (rated) return;
      load(); // reset
    });

    starsWrap.addEventListener('click', function (e) {
      if (rated) return;
      const star = e.target.closest('svg');
      if (!star) return;
      const score = parseInt(star.getAttribute('data-star'));
      sendRating(score);
    });
  }

  function load() {
    fetch(`${firebaseUrl}/ghRatings/${postId}.json`)
      .then(r => r.json())
      .then(render);
  }

  fingerprint = getFingerprint();
  bindEvents();
  load();
})();
