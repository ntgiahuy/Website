//<![CDATA[
/* Get download */ $(".action a.get").click(function(){var t=$(this).attr("name");localStorage.setItem("post_id",t),$.ajax({type:"GET",url:"/feeds/posts/summary/"+t,data:{alt:"json"},dataType:"jsonp",success:function(t){if(t.entry)
for(var e=0;e<t.entry.link.length;e++)
if("enclosure"==t.entry.link[e].rel&&"text/html"==t.entry.link[e].type){var n=t.entry.link[e].href;localStorage.setItem("download_link",n)}}});setTimeout(function(){window.open('/p/down.html','_blank');},1e3)});
//]]>
