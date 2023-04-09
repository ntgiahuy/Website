//<![CDATA[
/**
 * Description: Take A Quiz
 * Author: GiaHuy Design
 * Author URL: www.giahuy.net
*/
  var htmlDataWaktu = document.getElementById("waktu-soal");
  var htmlJumlahSoal = document.querySelector(".bank-soal-wrap");
  if (htmlDataWaktu != null){
    var waktu = htmlDataWaktu.getAttribute("data-waktu");
    var cekWaktu = new Date().getTime();
    var setWaktu = cekWaktu+(waktu*3600000);
    var waktuMulai = setWaktu - new Date().getTime();
    var jumlahSoal = htmlJumlahSoal.getAttribute("data-soal");
  }
  var jumlahBenar = 0;
  var jumlahSalah = 0;
  var tidakTerjawab = 0;
  var intervalWaktu;
  var clickMulai = document.getElementById("klik-mulai");
  if (clickMulai != null){
    clickMulai.onclick = inputData;
  }
  function inputData(){
    var htmlData = "";
    htmlData += "<div class='input-data'>";
    htmlData += "<form>";
    htmlData += "<label for='nama'><input id='nama' placeholder='Họ và tên' type='text' autocomplete='off'/></label>";
    htmlData += "<label for='kelas'><input id='kelas' placeholder='Lớp' type='text' autocomplete='off'/></label>";
    htmlData += "</form>";
    htmlData += "<button id='mulai-mengerjakan'>Làm bài</button>";
    htmlData += "</div>";
    document.getElementById("klik-mulai").style.display = "none";
    document.getElementById("input-data").innerHTML = htmlData;
    var kerjakan = document.getElementById("mulai-mengerjakan");
    if (kerjakan != null){
      kerjakan.onclick = function(){
        if (document.getElementById("nama").value == ""){
          document.getElementById("nama").focus();
          return false;
        } else if (document.getElementById("kelas").value == ""){
          document.getElementById("kelas").focus();
          return false;
        } else {
          document.getElementById("input-data").style.display = "none";
          document.getElementById("bank-soal").style.display = "block";
          document.querySelector(".nama-peserta").innerHTML = "<b>Tên:</b> " + document.getElementById("nama").value
          document.querySelector(".kelas-peserta").innerHTML = "<b>Lớp:</b> " + document.getElementById("kelas").value
          mulai();
          return false;
        }
      }
    }
  }
  function mulai() {
    intervalWaktu = setInterval(timerGo, 1000);
  }
  function selesai(){
    clearInterval(intervalWaktu);
    console.log(clearInterval(intervalWaktu));
  }
  function timerGo() {
    waktuMulai -= 1e3;
    var l = Math.floor(waktuMulai / 864e5),
        o = Math.floor((waktuMulai % 864e5) / 36e5),
        n = Math.floor((waktuMulai % 36e5) / 6e4),
        s = Math.floor((waktuMulai / 1e3) % 60);
    if (waktuMulai > 0){
      document.querySelector("#waktu-soal").innerHTML = "<b>Thời gian còn lại:</b> " + ("0" + o).slice(-2) + ":" + ("0" + n).slice(-2) + ":" + ("0" + s).slice(-2);
    } else if (waktuMulai < 0 || waktuMulai === 0) {
      document.querySelector("#waktu-soal").innerHTML = "<b>Hết thời gian</b>";
      document.querySelector(".waktu-wrap").style.display = "none";
      document.querySelector(".bank-soal-wrap").style.display = "none";
      document.getElementById("menu-soal").style.display = "none";
      document.getElementById("lihat-hasil-nilai").style.display = "block";
      lihatHasil();
      selesai();
    }
  }
  function lihatHasil(){
    var htmlHasil = "";
    var nilai = ((jumlahBenar/jumlahSoal)*100);
    var nama = document.getElementById("nama").value + " (" + document.getElementById("kelas").value + ")";
    htmlHasil += "<h3>Cảm ơn bạn " + nama + ", đây là điểm của bạn.</h3>";
    htmlHasil += "<p>Câu trả lời đúng: " + jumlahBenar + "</p>";
    htmlHasil += "<p>Câu trả lời sai: " + jumlahSalah + "</p>";
    htmlHasil += "<p>Không có câu trả lời: " + tidakTerjawab + "</p>";
    htmlHasil += "<p>Số điểm: " + nilai + "</p>";
    var htmlJawaban = document.getElementById("hasil-pengerjaan");
    if (htmlJawaban != null){
      htmlJawaban.innerHTML = htmlHasil;
    }
  }
  function done(){
    document.querySelector(".waktu-wrap").style.display = "none";
    document.querySelector(".bank-soal-wrap").style.display = "none";
    document.getElementById("menu-soal").style.display = "none";
    document.getElementById("lihat-hasil-nilai").style.display = "block";
    lihatHasil();
    selesai();
  }
  var tombolMenuSoal = document.querySelectorAll(".lihat-soal");
  if (tombolMenuSoal != null){
    for (var i = 0; i < tombolMenuSoal.length; i++) {
      tombolMenuSoal[i].addEventListener( "click", function() {
        document.getElementById("show-hide-box-soal").classList.toggle("active");
      });
    }
  }
  var soalSelesai = document.getElementById("soal-selesai");
  if (soalSelesai != null){
    soalSelesai.onclick = done;
  }
  var pilgan = document.querySelectorAll("input[type=radio]");
  if (pilgan != null){
    for (var i = 0; i < pilgan.length; i++) {
      pilgan[i].addEventListener( "change", function() {
        jumlahBenar = document.querySelectorAll("input[value=benar]:checked").length;
        jumlahSalah = document.querySelectorAll("input[value=salah]:checked").length;
        tidakTerjawab = jumlahSoal - (jumlahBenar + jumlahSalah);
      });
    }
  }
  var slideSoalIndex = 1;
  showSoalSlide(slideSoalIndex);
  function nextprevSoal(n) {
    showSoalSlide(slideSoalIndex += n);
  }
  function showSoalButton(n) {
    showSoalSlide(slideSoalIndex = n);
  }
  function showSoalSlide(n) {
    var i;
    var slides = document.getElementsByClassName("box-soal");
    var dots = document.getElementsByClassName("tombol-soal");
    if (n > slides.length) {slideSoalIndex = 1}    
    if (n < 1) {slideSoalIndex = slides.length;}
    for (i = 0; i < slides.length; i++) {
      slides[i].style.display = "none";  
    }
    for (i = 0; i < dots.length; i++) {
      dots[i].className = dots[i].className.replace(" active", "");
    }
    slides[slideSoalIndex-1].style.display = "block";  
    dots[slideSoalIndex-1].className += " active";
  }
  document.getElementById("prev-soal").onclick = function(){
    nextprevSoal(-1);
  }
  document.getElementById("next-soal").onclick = function(){
    nextprevSoal(1);
  }
    var tombolSoal = document.querySelectorAll(".tombol-soal");
  for (var i = 0; i < tombolSoal.length; i++) {
    tombolSoal[i].addEventListener( "click", function() {
      var cekNomor = this.getAttribute("data-nomor");
      showSoalButton(cekNomor);
    });
  }
//]]>
