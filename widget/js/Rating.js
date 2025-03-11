/* Ratings.js */
/*<![CDATA[*/

// Kiểm tra điều kiện sharedBy, nếu không đúng thì chuyển hướng
if (typeof ghRatings === "undefined" || ghRatings.sharedBy !== "www.giahuy.net") {
  window.location.href = "https://www.giahuy.net/p/credit.html";
  throw new Error("Invalid credit - redirecting to credit page.");
}

function loadScript(src, callback) {
  var s = document.createElement('script');
  s.src = src;
  s.onload = callback;
  document.head.appendChild(s);
}

function RatingsLoad(){
  // Tải Firebase SDK
  loadScript("https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js", function(){
    loadScript("https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js", function(){
      
      // Lấy đường dẫn rating từ container được render bởi Blogspot
      var ratingContainer = document.getElementById("ratingContainer");
      // Nếu không có container, sử dụng giá trị mặc định đã bao gồm tiền tố "BlogID_" và "PostID_"
      var ratingPath = ratingContainer 
        ? ratingContainer.getAttribute("data-view") 
        : "BlogID_defaultBlogId/ghRatings/PostID_defaultPostId";
      
      console.log("Rating path ban đầu: " + ratingPath);
      
      // Nếu ratingPath chưa chứa chuỗi "/ratings/", xử lý và thay thế bằng "/ghRatings/"
      if (ratingPath.indexOf("/ratings/") === -1) {
        var parts = ratingPath.split("/");
        if (parts.length >= 2) {
          // Thêm tiền tố "BlogID_" cho phần đầu nếu chưa có
          if (parts[0].indexOf("BlogID_") !== 0) {
            parts[0] = "BlogID_" + parts[0];
          }
          // Thêm tiền tố "PostID_" cho phần thứ 2 nếu chưa có
          if (parts[1].indexOf("PostID_") !== 0) {
            parts[1] = "PostID_" + parts[1];
          }
          ratingPath = parts[0] + "/ghRatings/" + parts[1];
        }
      }
      
      console.log("Rating path đã chỉnh sửa: " + ratingPath);
      
      // Khởi tạo Firebase (nếu chưa được khởi tạo)
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      
      // Lấy các phần tử cần thiết từ HTML
      var ratingStars = document.querySelectorAll('.stars-svg');
      var hasilRating = document.querySelector('.hasil-rating');
      var sudahRt = document.querySelector('.sudahRt');
      
      // Tham chiếu đến nút lưu trữ đánh giá trên Firebase với cấu trúc:
      // BlogID_xxxxxxxxxxxx/ghRatings/PostID_xxxxxxxxxxxx
      var ratingRef = firebase.database().ref(ratingPath);
      
      // Hàm cập nhật giao diện hiển thị điểm trung bình và số lượt đánh giá
      function updateRatingDisplay(avg, votes) {
        hasilRating.textContent = avg.toFixed(1);
        hasilRating.setAttribute('aria-label', votes + ' lượt đánh giá');
      }
      
      // Lắng nghe thay đổi dữ liệu đánh giá trên Firebase
      ratingRef.on('value', function(snapshot) {
        var data = snapshot.val();
        if(data) {
          var totalRating = data.totalRating || 0;
          var totalVotes = data.totalVotes || 0;
          var avgRating = totalVotes ? totalRating / totalVotes : 0;
          updateRatingDisplay(avgRating, totalVotes);
        } else {
          updateRatingDisplay(0, 0);
        }
      });
      
      // Hàm gửi đánh giá lên Firebase sử dụng transaction
      function submitRating(rating) {
        ratingRef.transaction(function(currentData) {
          if(currentData === null) {
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
        }, function(error, committed, snapshot) {
          if(error) {
            console.error('Lỗi khi cập nhật đánh giá:', error);
          } else if (!committed) {
            console.log('Giao dịch không được thực hiện.');
          } else {
            console.log('Đánh giá đã được ghi nhận.');
            // Hiển thị thông báo rằng người dùng đã đánh giá
            sudahRt.style.display = 'block';
          }
        });
      }
      
      // Gán sự kiện click cho từng ngôi sao
      ratingStars.forEach(function(star, index) {
        star.addEventListener('click', function() {
          if (sudahRt.style.display === 'block') return;
          var ratingValue = index + 1;
          submitRating(ratingValue);
          ratingStars.forEach(function(s, i) {
            if(i <= index) {
              s.classList.add('active');
            } else {
              s.classList.remove('active');
            }
          });
        });
      });
      
    });
  });
}

// Đưa RatingsLoad vào phạm vi toàn cục để mã inline có thể gọi được
window.RatingsLoad = RatingsLoad;

/*]]>*/
