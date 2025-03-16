/*<![CDATA[*/ 
if (typeof ghRatings === "undefined" || ghRatings.sharedBy !== "www.giahuy.net") {
    window.location.href = "https://www.giahuy.net/p/credit.html";
  }

  // Import các hàm cần thiết từ Firebase SDK v9
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
  import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

  // Khởi tạo Firebase App sử dụng cấu hình đã được định nghĩa bên ngoài (ví dụ: window.firebaseConfig)
  const app = initializeApp(window.firebaseConfig);
  const database = getDatabase(app);

  // Lấy container và xác định ratingPath
  const ratingContainer = document.getElementById("ratingContainer");
  let ratingPath = ratingContainer
    ? ratingContainer.getAttribute("data-view")
    : "BlogID_defaultBlogId/ghRatings/PostID_defaultPostId";

  console.log("Rating path ban đầu: " + ratingPath);

  // Nếu ratingPath chưa chứa "/ratings/", xử lý để thêm "/ghRatings/"
  if (ratingPath.indexOf("/ratings/") === -1) {
    const parts = ratingPath.split("/");
    if (parts.length >= 2) {
      if (!parts[0].startsWith("BlogID_")) {
        parts[0] = "BlogID_" + parts[0];
      }
      if (!parts[1].startsWith("PostID_")) {
        parts[1] = "PostID_" + parts[1];
      }
      ratingPath = parts[0] + "/ghRatings/" + parts[1];
    }
  }
  console.log("Rating path đã chỉnh sửa: " + ratingPath);

  // Lấy các phần tử DOM cần thiết
  const ratingStars = document.querySelectorAll('.stars-svg');
  const resultRating = document.querySelector('.result-rating');
  const alreadyRt = document.querySelector('.alreadyRt');
  const viewPostId = "PostID_samplePostId"; // Thay đổi nếu cần

  // Tạo tham chiếu đến rating trên Firebase Database
  const ratingRef = ref(database, ratingPath);

  // Hàm cập nhật giao diện hiển thị điểm trung bình và số lượt đánh giá
  function updateRatingDisplay(avg, votes) {
    resultRating.textContent = avg.toFixed(1);
    resultRating.setAttribute('aria-label', votes + ' lượt đánh giá');
  }

  // Lắng nghe thay đổi dữ liệu đánh giá trên Firebase
  onValue(ratingRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const totalRating = data.totalRating || 0;
      const totalVotes = data.totalVotes || 0;
      const avgRating = totalVotes ? totalRating / totalVotes : 0;
      updateRatingDisplay(avgRating, totalVotes);
    } else {
      updateRatingDisplay(0, 0);
    }
  });

  // Hàm gửi đánh giá sử dụng transaction
  function submitRating(rating) {
    runTransaction(ratingRef, (currentData) => {
      if (currentData === null) {
        return {
          totalRating: rating,
          totalVotes: 1
        };
      } else {
        return {
          totalRating: currentData.totalRating + rating,
          totalVotes: currentData.totalVotes + 1
        };
      }
    })
    .then((result) => {
      if (!result.committed) {
        console.log('Giao dịch không được thực hiện.');
      } else {
        console.log('Đánh giá đã được ghi nhận.');
        alreadyRt.style.display = 'block';
        localStorage.setItem("hasRated_" + viewPostId, "true");
      }
    })
    .catch((error) => {
      console.error('Lỗi khi cập nhật đánh giá:', error);
    });
  }

  // Gán sự kiện click cho từng ngôi sao để gửi đánh giá (chỉ cho phép 1 lần)
  ratingStars.forEach((star, index) => {
    star.addEventListener('click', () => {
      if (localStorage.getItem("hasRated_" + viewPostId) === "true") return;
      if (alreadyRt.style.display === 'block') return;
      const ratingValue = index + 1; // Giá trị từ 1 đến 5
      submitRating(ratingValue);
      // Cập nhật giao diện: tô màu các ngôi sao đã chọn
      ratingStars.forEach((s, i) => {
        if (i <= index) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
  }); /*]]>*/
