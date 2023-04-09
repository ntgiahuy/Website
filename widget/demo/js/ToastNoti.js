/*<![CDATA[*/ 
/**
 * Description: Toast Notification
 * Author: GiaHuy Design
 * Author URL: www.giahuy.net
*/
for(var preClick=document.getElementsByTagName("pre"),i=0;i<preClick.length;i++)preClick[i].addEventListener("dblclick",function(){var e=getSelection(),o=document.createRange();o.selectNodeContents(this),e.removeAllRanges(),e.addRange(o),document.execCommand("copy"),e.removeAllRanges(),document.querySelector("#toastNotif").innerHTML="<span>Copied to clipboard!</span>"},!1); /*]]>*/
