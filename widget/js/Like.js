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
                return (value / thresholds[i].value).toFixed(2)
                    .replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1') + thresholds[i].suffix;
            }
        }
    }

    const ghLikeBtn = document.querySelector('.gh-like-btn');
    // Lấy giá trị data-like được render: ví dụ "12345678/987654321/likepost"
    const dataLike = ghLikeBtn.getAttribute('data-like').split('/');
    const blogRealId = dataLike[0]; // Blog ID được render từ data:blog.blogId
    const rawPostId = dataLike[1];  // Post ID được render từ data:post.id

    // Xây dựng đường dẫn Firebase theo định dạng:
    // BlogID_<blogRealId> → ghLike → PostID_<rawPostId> → likepost
    const firebasePath = `BlogID_${blogRealId}/ghLike/PostID_${rawPostId}/likepost`;

    function getLiked() {
        const elementId = '#gh-like';
        const attribute = 'data-click';
        firebase.database().ref(firebasePath).once('value').then(snapshot => {
            let likeCount = snapshot.val() || 0;
            firebase.database().ref(firebasePath).set(likeCount);

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
        firebase.database().ref(firebasePath).once('value').then(snapshot => {
            let likeCount = snapshot.val() || 0;

            if (localStorage.getItem(`ghLike${rawPostId}`) !== rawPostId) {
                likeCount++;
                localStorage.setItem(`ghLike${rawPostId}`, rawPostId);
                ghLikeBtn.querySelector('svg').classList.add('like');
                document.querySelector('#gh-like').setAttribute('data-text', 
                    document.querySelector('#gh-like').getAttribute('data-after'));
            }

            firebase.database().ref(firebasePath).set(likeCount);

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
        const appScript = document.createElement('script');
        appScript.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js';
        appScript.onload = function() {
            const dbScript = document.createElement('script');
            dbScript.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js';
            dbScript.onload = function() {
                // Khởi tạo Firebase với URL của database
                firebase.initializeApp({
                    databaseURL: ghLikeFbase.firebaseUrl
                });
                getLiked();
            };
            document.body.appendChild(dbScript);
        };
        document.body.appendChild(appScript);
    })();

    ghLikeBtn.addEventListener('click', ghLike);

    if (localStorage.getItem(`ghLike${rawPostId}`) === rawPostId) {
        ghLikeBtn.querySelector('svg').classList.add('like');
        document.querySelector('#gh-like').setAttribute('data-text', 
            document.querySelector('#gh-like').getAttribute('data-after'));
    }

} else {
    window.location.href = 'https://www.giahuy.net/p/credit.html';
}
