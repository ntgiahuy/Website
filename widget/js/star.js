(function () {
  const section = document.querySelector('.rating-section[data-id]');
  if (!section || typeof ghRatings === 'undefined' || ghRatings.sharedBy !== 'www.giahuy.net') {
    location.href = 'https://www.giahuy.net/p/credit.html';
    return;
  }

  const firebaseUrl = ghRatings.firebaseUrl.replace(/\/$/, '');
  const postId = section.getAttribute('data-id');
  const starsWrap = section.querySelector('#starsAverage');
  const avgScore = section.querySelector('#avgScore');
  const totalSpan = section.querySelector('.total-rating .total');
  const caption = section.querySelector('.rated-caption');
  const progressList = section.querySelectorAll('.rating-progress');
  let fingerprint = '', rated = false;

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
    avgScore.textContent = `${score.toFixed(1)}/5`;
  }

  function render(data) {
    const count = data?.count || 0;
    const sum = data?.sum || 0;
    const fps = data?.fingerprints || {};
    const avg = count ? (sum / count) : 0;
    renderStars(avg);
    totalSpan.textContent = count;

    const starCounts = {1:0,2:0,3:0,4:0,5:0};
    for (let key in fps) {
      const val = parseInt(fps[key]);
      if (val >= 1 && val <= 5) starCounts[val]++;
    }

    progressList.forEach(p => {
      const rate = parseInt(p.getAttribute('data-rate'));
      const votes = starCounts[rate] || 0;
      const percent = count ? (votes / count * 100).toFixed(1) : 0;
      const bar = p.querySelector('.progress-bar');
      const voteEl = p.querySelector('.rating-count-detail .votes');
      if (bar) bar.style.width = percent + '%';
      if (voteEl) voteEl.textContent = votes;
    });

    if (fps[fingerprint]) {
      rated = true;
      renderStars(fps[fingerprint]);
      caption.classList.remove('hidden');
    }
  }

  function load() {
    fetch(`${firebaseUrl}/ghRatings/${postId}.json`)
      .then(r => r.json())
      .then(render);
  }

  function save(score) {
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
        caption.classList.remove('hidden');
        load();
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
      load();
    });

    starsWrap.addEventListener('click', function (e) {
      if (rated) return;
      const star = e.target.closest('svg');
      if (!star) return;
      const score = parseInt(star.getAttribute('data-star'));
      save(score);
    });
  }

  fingerprint = getFingerprint();
  bindEvents();
  load();
})();
