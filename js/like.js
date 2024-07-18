if (ghLikeFbase.sharedBy === 'www.giahuy.net') {
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

        const firebaseUrl = `${ghLikeFbase.firebaseUrl}${document.querySelector('.gh-like-btn').getAttribute('data-like')}`;
        const dbRef = firebase.database().ref(firebaseUrl);

        dbRef.once('value').then(snapshot => {
            let likeCount = snapshot.val() || 0;
            dbRef.set(likeCount);

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
        const firebaseUrl = `${ghLikeFbase.firebaseUrl}${document.querySelector('.gh-like-btn').getAttribute('data-like')}`;
        const dbRef = firebase.database().ref(firebaseUrl);

        dbRef.once('value').then(snapshot => {
            let likeCount = snapshot.val() || 0;

            if (localStorage.getItem(`ghLike${ghLikePostId}`) !== ghLikePostId) {
                likeCount++;
                localStorage.setItem(`ghLike${ghLikePostId}`, ghLikePostId);
                document.querySelector('.gh-like-btn svg').classList.add('like');
                document.querySelector('#gh-like').setAttribute('data-text', document.querySelector('#gh-like').getAttribute('data-after'));
            }

            dbRef.set(likeCount);

            if (ghLikeFbase.abbreviation === '0') {
                document.querySelector('#gh-like').setAttribute('data-click', likeCount);
            } else if (ghLikeFbase.abbreviation === '1') {
                document.querySelector('#gh-like').setAttribute('data-click', intToString(likeCount));
            } else if (ghLikeFbase.abbreviation === '2') {
                document.querySelector('#gh-like').setAttribute('data-click', likeCount.toLocaleString('id-ID'));
            }
        });
    }

    (function() {
        const scriptUrl = 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
        const databaseUrl = 'https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js';

        const scriptApp = document.createElement('script');
        scriptApp.async = true;
        scriptApp.src = scriptUrl;
        scriptApp.onload = () => {
            const scriptDatabase = document.createElement('script');
            scriptDatabase.async = true;
            scriptDatabase.src = databaseUrl;
            scriptDatabase.onload = () => {
const firebaseConfig = {
  apiKey: "AIzaSyBST1RkcBdYg-dXj46gyO-T_RNy08BLTLk",
  authDomain: "web-giahuy.firebaseapp.com",
  databaseURL: "https://web-giahuy-default-rtdb.firebaseio.com",
  projectId: "web-giahuy",
  storageBucket: "web-giahuy.appspot.com",
  messagingSenderId: "380462958233",
  appId: "1:380462958233:web:d88495e6a5b967e0a1da08"
                };

                firebase.initializeApp(firebaseConfig);
                getLiked();
            };

            document.body.appendChild(scriptDatabase);
        };

        document.body.appendChild(scriptApp);
    })();

    document.querySelector('.gh-like-btn').addEventListener('click', ghLike);

    if (localStorage.getItem(`ghLike${ghLikePostId}`) === ghLikePostId) {
        document.querySelector('.gh-like-btn svg').classList.add('like');
        document.querySelector('#gh-like').setAttribute('data-text', document.querySelector('#gh-like').getAttribute('data-after'));
    }

} else {
    window.location.href = 'https://www.giahuy.net/p/credit.html';
}
