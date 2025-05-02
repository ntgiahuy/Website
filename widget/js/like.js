// like.js - Like/Dislike kiểu YouTube | Bản quyền © www.giahuy.net

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
    <style>
      .gh-like-bar{display:flex;justify-content:center;gap:20px;padding:15px 0}
      .gh-button{display:flex;align-items:center;cursor:pointer;font-size:16px;color:#666}
      .gh-button svg{width:24px;height:24px;margin-right:6px;fill:#ccc;transition:fill 0.2s}
      .gh-button.liked svg{fill:#0f9d58}
      .gh-button.disliked svg{fill:#e53935}
    </style>
    <div class="gh-like-bar">
      <div class="gh-button" id="likeBtn">
        <svg viewBox="0 0 24 24"><path d="M14 1H6C5.4 1 5 1.4 5 2V14C5 14.6 5.4 15 6 15H14L21 8L14 1Z"/></svg>
        <span id="likeCount">0</span>
      </div>
      <div class="gh-button" id="dislikeBtn">
        <svg viewBox="0 0 24 24"><path d="M10 23H18C18.6 23 19 22.6 19 22V10C19 9.4 18.6 9 18 9H10L3 16L10 23Z"/></svg>
        <span id="dislikeCount">0</span>
      </div>
    </div>
  `;

  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');
  const likeCount = document.getElementById('likeCount');
  const dislikeCount = document.getElementById('dislikeCount');

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

        // Không thay đổi
        if (current === newState) {
          // Gỡ phản hồi
          if (newState === 'like') fps[fingerprint] = null;
          if (newState === 'dislike') fps[fingerprint] = null;
        } else {
          // Chuyển đổi hoặc chọn mới
          fps[fingerprint] = newState;
        }

        // Tính lại tổng Like/Dislike
        let totalLike = 0, totalDislike = 0;
        Object.values(fps).forEach(v => {
          if (v === 'like') totalLike++;
          if (v === 'dislike') totalDislike++;
        });

        const newData = {
          like: totalLike,
          dislike: totalDislike,
          fingerprints: fps
        };

        return fetch(`${firebaseUrl}/ghLikes/${fullId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newData)
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
