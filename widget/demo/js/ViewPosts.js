/*<![CDATA[*/
  (() => {
  const config = {
    databaseUrl: 'https://giahuy-f6d52-default-rtdb.firebaseio.com',
    abbreviation: true,
    lazyload: true,
  };

  const loadJs=(r,e,n,t)=>{const u=document.createElement('script');e&&(u.id=e),(u.async=n),(u.src=r),t&&(u.onload=t),document.getElementsByTagName('head')[0].appendChild(u)},abvr=(r)=>{var e=Math.sign(Number(r));return 1e9<=Math.abs(Number(r))?e*(Math.abs(Number(r))/1e9).toFixed(2)+'B':1e6<=Math.abs(Number(r))?e*(Math.abs(Number(r))/1e6).toFixed(2)+'M':1e3<=Math.abs(Number(r))?e*(Math.abs(Number(r))/1e3).toFixed(2)+'K':Math.abs(Number(r))},postVw=()=>{loadJs('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js','fb-app',!0,()=>{loadJs('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js','fb-db',!0,()=>{if(config.databaseUrl){var e={};e.databaseURL=config.databaseUrl;const a=firebase.initializeApp(e,'Realtime Post View Counter by GiaHuy');for(var n=document.querySelectorAll('.GH_vw'),t=a.database(),o=0;o<n.length;o++){var u=(n=n[o]).getAttribute('data-path');(u=t.ref(u)).once('value',(function(n,t){return function(r){0<(r=r.exists()?r.val():0)&&(n.setAttribute('data-view',config.abbreviation?abvr(r):r),n.classList.remove('hidden')),'true'==n.getAttribute('data-incr')&&(n.setAttribute('data-incr',!1),(r=parseInt(r)+1),t.set(r))}})(n,u))}}})})};(()=>{if(!0===config.lazyload){var arLz=[],arSc=[];const da=()=>{0==arLz.length&&null==localStorage.getItem('LZ_VIEW')&&(localStorage.setItem('LZ_VIEW',1),postVw())};window.addEventListener('scroll',(r)=>{((0!=document.documentElement.scrollTop&&0==arSc.length)||(0!=document.body.scrollTop&&0==arSc.length))&&da()},!0),document.getElementsByTagName('body')[0].addEventListener('click',(r)=>{da()}),localStorage.getItem('LZ_VIEW')&&postVw()}else postVw()})()})()
  /*]]>*/
