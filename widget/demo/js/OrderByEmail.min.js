//<![CDATA[
/**
 * Description: Order Sent By Email
 * Author: GiaHuy Design
 * Author URL: www.giahuy.net
*/
$(".form-close").click(function(){
  $(".giahuy-form-mail").fadeOut("fast")}
);$(".show-form").click(function(){
  $(".giahuy-form-mail").fadeIn("slow")});
 
// Validation For Mailjib Column Contents
$('.giahuy-input-field .validate').each(function() {
    title = $(this).attr('name');
    label = $(this).parents('.giahuy-input-field');
    $('<span class="giahuy-validasi"><b>' + title + '</b> yêu cầu</span>').appendTo(label);
});
   $(document).on('keyup', '.giahuy-input-field .validate', function() {
    if ($(this).val() != '') {
        $(this).removeClass('focus');
        $(this).parents('.giahuy-input-field').find('.giahuy-validasi').removeClass('show');
    }
});
$(document).on('change', '.giahuy-input-field select', function() {
    $(this).removeClass('focus');
    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').removeClass('show');
});
$('.send_form').click(mailchat);
function mailchat() { 
if ($('#mail_name').val() == '') { // Validation Full Name
          $('#mail_name').each(function() {
              $(this).addClass('focus');
                    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').addClass('show');
          });
        $('#mail_name').focus();
        return false;
    } else if ($('#mail_nomor').val() == '') { // mobile number validation
          $('#mail_nomor').each(function() {
              $(this).addClass('focus');
                    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').addClass('show');
          });
        $('#mail_nomor').focus();
        return false;
    } else if ($('#mail_blog').val() == '') { // Blog Name validation
          $('#mail_blog').each(function() {
              $(this).addClass('focus');
                    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').addClass('show');
          });
        $('#mail_blog').focus();
        return false;
      } else if ($('#mail_url').val() == '') { // giahuy-validation Blog Url
          $('#mail_url').each(function() {
              $(this).addClass('focus');
                    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').addClass('show');
          });
        $('#mail_url').focus();
        return false;
      } else if ($('#mail_lisensi').val() == 'default') { // License validation
          $('#mail_lisensi').each(function() {
              $(this).addClass('focus');
                    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').addClass('show');
          });
        $('#mail_lisensi').focus();
        return false;
        } else if ($('#mail_pembayaran').val() == 'default') { // Payment validation
          $('#mail_pembayaran').each(function() {
              $(this).addClass('focus');
                    $(this).parents('.giahuy-input-field').find('.giahuy-validasi').addClass('show');
          });
        $('#mail_pembayaran').focus();
        return false;
    } else {
 
      /* Email Settings */
var maillink = 'https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=',
    email = 'emailcuaban@gmail.com', //Your Email Address
    mailsubject = '&subject=Xác nhận mua hàng ', //Email Subject But Appears On Smartphone Onlya
    maillink1 = '',
    jarak = '',
    maillink2 = '&body=Xin chào, tôi muốn mua mẫu của bạn với thông tin sau: '; //Welcome Message
      
/* Smartphone Support */ 
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) { 
var maillink = 'mailto:',
    jarak ='<br>',
    maillink1 = '?cc=&bcc=';
}  
 
 /* Call Input Form */ 
var input_name = $("#mail_name").val(),
    input_nomor = $("#mail_nomor").val(),
    input_nameBlog = $("#mail_blog").val(), 
    input_urlBlog = $("#mail_url").val(),  
    input_lisensi = $("#mail_lisensi :selected").text(),
    input_pembayaran = $("#mail_pembayaran :selected").text(),
    input_nameproduk = $("#name_produk").text(),
    input_viaUrl = location.href;

/* Email Final URL */ 
var mail_link = maillink + email + maillink1 + mailsubject + input_name + maillink2 + '%0A%0A' + jarak + jarak +
    'THÔNG TIN CỦA TÔI ' + jarak + 
    '%0A-----------------------------%0A' + '%0A' + jarak + jarak +
    'Họ tên: ' + input_name + '%0A' + jarak + 
    'Số lượng: ' + input_nomor + '%0A' + jarak +
    'Tên Blog: ' + input_nameBlog + '%0A' + jarak +
    'Url Blog: ' + input_urlBlog + '%0A' + jarak +
    'Phương thức thanh toán: ' + input_pembayaran + '%0A' + jarak +
    '%0A-----------------------------%0A' + '%0A' + jarak + jarak + 
    'THÔNG TIN SẢN PHẨM %0A' + jarak +
    '-----------------------------%0A' + jarak +
    'Tên Template: ' + input_nameproduk + '%0A' + jarak + 
    'Loại giấy phép: ' + input_lisensi + '%0A' + jarak + 
    'Liên kết mẫu: ' + input_viaUrl + '%0A' + jarak + 
    '%0A-----------------------------%0A';
 
/* Open Email Window */ 
window.open(mail_link,'_blank');
window.location.href = input_viaUrl;
return false;
  }
};
//]]>
