/*<![CDATA[*/
// Kiểm tra biến ghRatings và thuộc tính sharedBy trước khi chạy các chức năng khác
if (typeof ghRatings === "undefined" || ghRatings.sharedBy !== "www.giahuy.net") {
  window.location.href = "https://www.giahuy.net/p/credit.html";
}

// Thêm các biến cấu hình credit và thông tin Blog/Post
var viewBlogId = "<data:blog.blogId/>";
var viewPostId = "<data:post.id/>";

function loadScript(src, callback) {
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = callback;
  document.head.appendChild(s);
}

(function(){
  // Tải firebase-app.js phiên bản 8.10.1 trước
  loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js", function(){
    // Sau đó tải firebase-database.js phiên bản 8.10.1
    loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js", function(){
      
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
        if (window.firebaseConfig) {
          firebase.initializeApp(window.firebaseConfig);
        } else {
          console.error("firebaseConfig is not defined. Vui lòng định nghĩa window.firebaseConfig trước khi tải Rating.js");
          return;
        }
      }
      
      // Lấy các phần tử cần thiết từ HTML
      var ratingStars = document.querySelectorAll('.stars-svg');
      var resultRating = document.querySelector('.result-rating');
      var alreadyRt = document.querySelector('.alreadyRt');
      
      // Tham chiếu đến nút lưu trữ đánh giá trên Firebase với cấu trúc mong muốn:
      // BlogID_xxxxxxxxxxxx/ghRatings/PostID_xxxxxxxxxxxx
      var ratingRef = firebase.database().ref(ratingPath);
      
      // Hàm cập nhật giao diện hiển thị điểm trung bình và số lượt đánh giá
      function updateRatingDisplay(avg, votes) {
        resultRating.textContent = avg.toFixed(1);
        resultRating.setAttribute('aria-label', votes + ' lượt đánh giá');
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
      
      // Hàm gửi đánh giá lên Firebase sử dụng giao dịch (transaction)
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
            alreadyRt.style.display = 'block';
            // Lưu flag vào LocalStorage để không cho phép đánh giá thêm cho bài viết này
            localStorage.setItem("hasRated_" + viewPostId, "true");
          }
        });
      }
      
      // Gán sự kiện click cho từng ngôi sao, kiểm tra LocalStorage để chỉ cho phép đánh giá 1 lần cho bài viết này
      ratingStars.forEach(function(star, index) {
        star.addEventListener('click', function() {
          // Kiểm tra nếu người dùng đã đánh giá (LocalStorage) cho bài viết này
          if (localStorage.getItem("hasRated_" + viewPostId) === "true") return;
          // Nếu đã hiển thị thông báo đánh giá rồi thì không cho phép đánh giá thêm
          if (alreadyRt.style.display === 'block') return;
          var ratingValue = index + 1; // Lấy giá trị từ 1 đến 5
          submitRating(ratingValue);
          // Cập nhật giao diện các ngôi sao (active)
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
})();
  
/*]]>*/
