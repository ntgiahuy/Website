(function () {
  const section = document.querySelector('.rating-section[data-id]');
  if (!section || typeof ghRatings === 'undefined' || ghRatings.sharedBy !== 'www.giahuy.net') {
    location.href = 'https://www.giahuy.net/p/credit.html';
    return;
  }

  const firebaseUrl = ghRatings.firebaseUrl.replace(/\/$/, '');
  const postId = section.getAttribute('data-id');
  const radios = section.querySelectorAll('.rating-widget input[type="radio"]');
  const labels = section.querySelectorAll('.rating-widget label');
  const avgSpan = section.querySelector('.average-rating span');
  const totalSpan = section.querySelector('.total-rating .total');
  const caption = section.querySelector('.rated-caption');
  const progressList = section.querySelectorAll('.rating-progress');
  let fingerprint = '';
  let rated = false;

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

  function render(data) {
    const count = data?.count || 0;
    const sum = data?.sum || 0;
    const fps = data?.fingerprints || {};
    const avg = count ? (sum / count).toFixed(1) : '0.0';
    avgSpan.textContent = avg;
    totalSpan.textContent = count;

    const starCounts = {1:0,2:0,3:0,4:0,5:0};
    for (let key in fps) {
      const val = parseInt(fps[key]);
      if (val >= 1 && val <= 5) starCounts[val]++;
    }

    progressList.forEach(p => {
      const rate = parseInt(p.getAttribute('data-rate'));
      const vote = starCounts[rate] || 0;
      const percent = count ? (vote / count * 100).toFixed(4) : 0;
      p.setAttribute('data-text', vote);
      const bar = p.querySelector('.progress-bar');
      bar.style.width = percent + '%';
      bar.setAttribute('aria-valuenow', percent);
    });

    if (fps[fingerprint]) {
      rated = true;
      const star = fps[fingerprint];
      const input = section.querySelector(`input[value="${star}"]`);
      if (input) input.checked = true;
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
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(newData)
        });
      })
      .then(() => {
        rated = true;
        caption.classList.remove('hidden');
        load();
      });
  }

  labels.forEach(label => {
    label.addEventListener('click', () => {
      if (rated) return;
      const val = parseInt(label.getAttribute('for').replace('rate-', ''));
      save(val);
    });
  });

  fingerprint = getFingerprint();
  load();
})();
