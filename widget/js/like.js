// Like by Giahuy.net
(function () {
  'use strict';

  if (typeof ghLikes === 'undefined' || typeof ghLikes.firebaseUrl === 'undefined') return;
  if (typeof ghLikes.sharedBy !== 'string' || ghLikes.sharedBy !== 'www.giahuy.net') {
    window.location.href = "https://www.giahuy.net/p/credit.html";
    return;
  }

  const firebaseUrl = ghLikes.firebaseUrl.replace(/\/$/, '');
  const blogId = document.getElementById('likeContainer')?.getAttribute('data-blog-id') || 'unknown';
  const postId = document.getElementById('likeContainer')?.getAttribute('data-post-id') || 'unknown';
  const fullId = blogId + '/' + postId;
  const container = document.getElementById('likeContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="gh-like-bar">
      <div class="gh-button" id="likeBtn">
        <svg viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 
                   2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 
                   4.5 2.09C13.09 3.81 14.76 3 16.5 3 
                   19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 
                   11.54L12 21.35z"/>
        </svg>
        <span id="likeCount">0</span>
      </div>
      <div class="gh-button" id="dislikeBtn">
        <svg viewBox="0 0 24 24">
          <path d="M16.5,3c-1.74,0-3.41,0.81-4.5,2.09C10.91,3.81,9.24,3,
            7.5,3C4.42,3,2,5.42,2,8.5c0,3.78,3.4,6.86,8.55,11.54
            L12,21.35l1.44-1.31C17.68,15.4,20,12.53,20,9
            c0-1.1-0.3-2.13-0.83-3.02L16.5,10L14,7.5L16.5,5
            l2.5-2.5C18.63,3.2,17.6,3,16.5,3z"/>
        </svg>
        <span id="dislikeCount">0</span>
      </div>
    </div>
    <div class="gh-like-status" id="likeStatus">Đang tải trạng thái...</div>
  `;

  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');
  const likeCount = document.getElementById('likeCount');
  const dislikeCount = document.getElementById('dislikeCount');
  const statusText = document.getElementById('likeStatus');

  let fingerprint = '';

  function getFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText(navigator.userAgent, 2, 2);
      return Promise.resolve(btoa(canvas.toDataURL()).slice(0, 32));
    } catch (e) {
      return Promise.resolve('anonymous');
    }
  }

  function render(data, state) {
    likeCount.innerText = data?.like || 0;
    dislikeCount.innerText = data?.dislike || 0;
    likeBtn.classList.toggle('liked', state === 'like');
    dislikeBtn.classList.toggle('disliked', state === 'dislike');

    if (state === 'like') statusText.innerText = 'Bạn đã thích bài viết này';
    else if (state === 'dislike') statusText.innerText = 'Bạn đã không thích bài viết này';
    else statusText.innerText = 'Bạn chưa phản hồi';
  }

  function loadLike() {
    fetch(`${firebaseUrl}/ghLikes/${fullId}.json`)
      .then(res => res.json())
      .then(data => {
        const userState = data?.fingerprints?.[fingerprint] || null;
        render(data || {}, userState);
      });
  }

  function updateState(newState) {
    fetch(`${firebaseUrl}/ghLikes/${fullId}.json`)
      .then(res => res.json())
      .then(data => {
        const like = data?.like || 0;
        const dislike = data?.dislike || 0;
        const fps = data?.fingerprints || {};
        const current = fps[fingerprint] || null;

        let newLike = like, newDislike = dislike;

        if (current === newState) {
          if (newState === 'like') newLike = Math.max(0, like - 1);
          if (newState === 'dislike') newDislike = Math.max(0, dislike - 1);
          fps[fingerprint] = null;
        } else {
          if (current === 'like') newLike = Math.max(0, like - 1);
          if (current === 'dislike') newDislike = Math.max(0, dislike - 1);
          if (newState === 'like') newLike++;
          if (newState === 'dislike') newDislike++;
          fps[fingerprint] = newState;
        }

        const updates = {
          like: newLike,
          dislike: newDislike,
          [`fingerprints/${fingerprint}`]: fps[fingerprint]
        };

        return fetch(`${firebaseUrl}/ghLikes/${fullId}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      })
      .then(() => loadLike());
  }

  function bindEvents() {
    likeBtn.addEventListener('click', () => updateState('like'));
    dislikeBtn.addEventListener('click', () => updateState('dislike'));
  }

  getFingerprint().then(fp => {
    fingerprint = fp;
    bindEvents();
    loadLike();
  });
})();
