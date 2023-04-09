//<![CDATA[
/**
 * Description: Get Link Drive
 * Author: GiaHuy Design
 * Author URL: www.giahuy.net
*/
function getButton(){
    var input = document.getElementById("driveID").value,
        drive = input.indexOf("google.com");
    if (-1 != drive) {
        var textd = input.indexOf("d/"),
            textEdit = input.indexOf("/edit"),
            driveID = input.slice(textd + 2, textEdit),
            output = "https://docs.google.com/$type/d/" + driveID + "/export?format=pdf";
        -1 !== input.indexOf("document")
            ? (output = output.replace("$type", "document").split("pdf").join("docx"))
            : -1 !== input.indexOf("spreadsheet")
            ? (output = output.replace("$type", "spreadsheets").split("pdf").join("xlsx"))
            : -1 !== input.indexOf("presentation")
            ? (output = "https://drive.google.com/uc?export=download&id=" + (driveID = input.slice(textd + 2, textEdit)))
            : ((textEdit = input.indexOf("/view")), (output = "https://drive.google.com/uc?export=download&id=" + (driveID = input.slice(textd + 2, textEdit))));
      document.getElementById("output").value = output;
      document.querySelector(".input").style.display = "none";
      document.querySelector(".output").style.display = "block";
      document.querySelector(".tombol-copy-reset").style.display = "block";
      document.getElementById("get-button").style.display = "none";
    } else {
      document.getElementById("driveID").value = "Url không khớp với định dạng";
    }
  }
  function copy(){
    document.getElementById("output").select();
    document.execCommand('copy');
    document.getElementById("text-keterangan").innerHTML = "Đã sao chép liên kết thành công";
    document.getElementById("text-keterangan").style.margin = "10px 0";
  }
  function download(){
    var linkUnduh = document.getElementById("output").value;
    window.open(linkUnduh,'_blank');
  }
  function reset(){
    window.location.href = window.location.href;
  }
  window.onload = function() {
    document.getElementById("driveID").focus(), document.getElementById("get-button").onclick = getButton, document.getElementById("copy").onclick = copy, document.getElementById("download").onclick = download, document.getElementById("reset").onclick = reset;
  };
//]]>
