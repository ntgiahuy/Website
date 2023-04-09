/*<![CDATA[*/
  /**
 * Description: Count Download
 * Author: GiaHuy Design
 * Author URL: www.giahuy.net
*/
  function download(link, time, newtab, id){
    var dldCo = document.querySelector(id),
        dldMe = document.querySelector(id + ' .dldMe'),
        dldPg = document.querySelector(id + ' .dldPg'),
        dldDl = document.querySelector(id + ' .dldDl'),
        dldRt = document.querySelector(id + ' .dldRt'),
        dldLf = time;
    
    dldMe.innerHTML = 'Starting Download in <span>' + dldLf + '</span> seconds...';
    dldCo.classList.add('dldAlt');
    
    var downloadTimer = setInterval(function timeCount(){
        dldLf -= 1;
        dldMe.innerHTML = 'Starting Download in <span>' + dldLf + '</span> seconds...';
        dldPg.style.strokeDashoffset = Math.floor((dldLf / time) * 100);

      if(dldLf <= 0){
        clearInterval(downloadTimer);
        dldMe.innerHTML = 'Please wait...';
        
        if (newtab == 'true'){
          window.open(link, '_blank');
        } else {
          window.location.href = link;
        };
        
        dldRt.onclick = function (){
          if (newtab == 'true'){
            window.open(link, '_blank');
          } else {
            window.location.href = link;
          }
        };
        
        setTimeout(() => {
          dldCo.classList.remove('dldAlt');
          dldCo.classList.add('dldRty');
        }, 4000);
      }
    }, 1000);
  };
  /*]]>*/
