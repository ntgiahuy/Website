import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.11.0/firebase-app.js';
import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/9.11.0/firebase-database.js';

const ghLikeFbase = {
    firebaseUrl: 'https://like-giahuy-default-rtdb.firebaseio.com/',
    abbreviation: '2',  // 0 or 1 or 2
    sharedBy: 'www.giahuy.net' // Credit do not remove
};

function intToString(value) {
    const thresholds = [
        { value: 1e3, suffix: 'K' },
        { value: 1e6, suffix: 'M' },
        { value: 1e9, suffix: 'B' },
        { value: 1e12, suffix: 'T' },
        { value: 1e15, suffix: 'P' },
        { value: 1e18, suffix: 'E' }
    ];

    value = value.toString().replace(/[^0-9.]/g, '');
    if (value < 1000) return value;

    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (value >= thresholds[i].value) {
            return (value / thresholds[i].value).toFixed(2).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1') + thresholds[i].suffix;
        }
    }
}

const ghLikePostId = document.querySelector('.gh-like-btn').getAttribute('data-like').split('/')[1];

function getLiked() {
    const elementId = '#gh-like';
    const attribute = 'data-click';

    const db = getDatabase();
    const likeRef = ref(db, document.querySelector('.gh-like-btn').getAttribute('data-like'));

    get(likeRef).then((snapshot) => {
        let likeCount = snapshot.val() || 0;
        set(likeRef, likeCount);

        if (ghLikeFbase.abbreviation === '0') {
            document.querySelector(elementId).setAttribute(attribute, likeCount);
        } else if (ghLikeFbase.abbreviation === '1') {
            document.querySelector(elementId).setAttribute(attribute, intToString(likeCount));
        } else if (ghLikeFbase.abbreviation === '2') {
            document.querySelector(elementId).setAttribute(attribute, likeCount.toLocaleString('id-ID'));
        }
    });
}

function ghLike() {
    const db = getDatabase();
    const likeRef = ref(db, document.querySelector('.gh-like-btn').getAttribute('data-like'));

    get(likeRef).then((snapshot) => {
        let likeCount = snapshot.val() || 0;

        if (localStorage.getItem(`ghLike${ghLikePostId}`) !== ghLikePostId) {
            likeCount++;
            localStorage.setItem(`ghLike${ghLikePostId}`, ghLikePostId);
            document.querySelector('.gh-like-btn svg').classList.add('like');
            document.querySelector('#gh-like').setAttribute('data-text', document.querySelector('#gh-like').getAttribute('data-after'));
        }

        set(likeRef, likeCount);

        if (ghLikeFbase.abbreviation === '0') {
            document.querySelector('#gh-like').setAttribute('data-click', likeCount);
        } else if (ghLikeFbase.abbreviation === '1') {
            document.querySelector('#gh-like').setAttribute('data-click', intToString(likeCount));
        } else if (ghLikeFbase.abbreviation === '2') {
            document.querySelector('#gh-like').setAttribute('data-click', likeCount.toLocaleString('id-ID'));
        }
    });
}

if (ghLikeFbase.sharedBy === 'www.giahuy.net') {
    const firebaseConfig = {
        databaseURL: ghLikeFbase.firebaseUrl
    };

    const app = initializeApp(firebaseConfig);

    document.addEventListener('DOMContentLoaded', getLiked);
    document.querySelector('.gh-like-btn').addEventListener('click', ghLike);

    if (localStorage.getItem(`ghLike${ghLikePostId}`) === ghLikePostId) {
        document.querySelector('.gh-like-btn svg').classList.add('like');
        document.querySelector('#gh-like').setAttribute('data-text', document.querySelector('#gh-like').getAttribute('data-after'));
    }
} else {
    window.location.href = 'https://www.giahuy.net/p/credit.html';
}
