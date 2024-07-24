let StarRatingGenerator=typeof StarRatingGenerator=='undefined'?0x0:StarRatingGenerator+0x1;(function(ratingIndex){if(ratingIndex===0x0&&!document.querySelector('script[src="https://www.gstatic.com/firebasejs/8.1.1/firebase-database.js"]')){let firebaseAppScript=document.createElement('script');firebaseAppScript.src='https://www.gstatic.com/firebasejs/8.1.1/firebase-app.js';document.head.appendChild(firebaseAppScript);firebaseAppScript.onload=function(){let firebaseDatabaseScript=document.createElement('script');firebaseDatabaseScript.src='https://www.gstatic.com/firebasejs/8.1.1/firebase-database.js';document.head.appendChild(firebaseDatabaseScript)};let styles=document.createElement('style');styles.innerHTML='@keyframes dawaj {0% {transform: rotate(0deg);} 100% {transform:rotate(360deg);}} .kozyr-SRS-loader ~ div{visibility:hidden;}';document.head.appendChild(styles)}function updateStars(starContainer,rating,starSize){let stars=starContainer.getElementsByTagName('SRSstar');for(let i=0;i<stars.length;i++){if(i<=rating){if(i<Math.floor(rating)){stars[i].querySelector('full').style.width='100%';stars[i].querySelector('empty').style.width='0%'}else{let partialWidth=rating-Math.floor(rating);let star=stars[i];let fullWidth=Math.round(partialWidth*starSize);star.querySelector('full').style.width=fullWidth+'px';star.querySelector('empty').style.width=starSize-fullWidth+'px';star.querySelector('empty').querySelector('img').style.margin='0 0 0 -'+fullWidth+'px'}}else{stars[i].querySelector('full').style.width='0%';stars[i].querySelector('empty').style.width='100%';stars[i].querySelector('empty').querySelector('img').style.margin='0 0 0 0'}stars[i].querySelector('hover').style.width='0%'}}function showTooltip(tooltipContent,starElement,userRating){let tooltip=document.createElement('div');tooltip.innerHTML=tooltipContent.replace(/\$userRating\$/g,userRating);tooltip.style.position='absolute';tooltip.style.background='black';tooltip.style.color='white';tooltip.style.border='1px solid #e0e0e0';tooltip.style.borderRadius='7px';tooltip.style.padding='3px 7px';tooltip.style.lineHeight='1.2';tooltip.style.textAlign='center';tooltip.style.opacity='0';tooltip.style.transition='opacity 1s';tooltip.style.width='200px';tooltip.style.boxSizing='border-box';tooltip.style.zIndex='9999999';tooltip.style.fontFamily="'Palatino Linotype', 'Book Antiqua', Palatino, serif";document.body.appendChild(tooltip);let starRect=starElement.getBoundingClientRect();setTimeout(()=>{tooltip.style.opacity='1';if(starElement.style.textAlign==='right'){tooltip.style.left=window.scrollX+starRect.left+starElement.offsetWidth-200+'px'}else if(starElement.style.textAlign==='center'){tooltip.style.left=window.scrollX+starRect.left+starElement.offsetWidth/2-100+'px'}else{tooltip.style.left=window.scrollX+starRect.left+'px'}tooltip.style.top=(starRect.top>tooltip.offsetHeight?window.scrollY+starRect.top-tooltip.offsetHeight:window.scrollY+starRect.top+tooltip.offsetHeight)+'px'},10);setTimeout(()=>{tooltip.style.opacity='0';setTimeout(()=>{document.body.removeChild(tooltip)},1000)},3500)}function setupStarRating(index){let ratingScript=document.querySelectorAll('script[src="https://cdn.giahuy.net/widget/js/rating-widget.js"]')[index];let hostName=location.host.replace('www.','').replace(/\./g,'_').replace(/\//g,'__');if(hostName===''){hostName='other'}let ratingName=ratingScript.getAttribute('ratingName');if(!ratingName||ratingName==='auto'){let pageUrl=location.href.split('?')[0].split('#')[0].replace(location.protocol+'//','').replace('www.','');if(pageUrl.slice(-1)==='/'||pageUrl.slice(-1)==='.'){pageUrl=pageUrl.slice(0,-1)}ratingName=pageUrl.replace(/\./g,'_').replace(/\//g,'__').replace(/\,/g,'___').replace(/\s/g,'')}ratingName=ratingName.replace(/\s/g,'_').replace(/\#/g,'-').replace(/\./g,'-').replace(/\@/g,'-').replace(/\!/g,'-').replace(/\$/g,'-').replace(/\%/g,'-').replace(/\&/g,'-').replace(/\(/g,'-').replace(/\)/g,'-');let emptyStarImg=ratingScript.getAttribute('emptyStarImg')||'https://1.bp.blogspot.com/-pOr9XGwtSJc/Wsjf8ULOIqI/AAAAAAAAAKE/KBh-LUDIn0YzASKf-t7mQo8UNpdHhr2SgCLcBGAs/s1600/pusta.png';let fullStarImg=ratingScript.getAttribute('fullStarImg')||'https://3.bp.blogspot.com/-QSNdWP4Ijx4/Wsjf7QOUZ4I/AAAAAAAAAJ8/F2nReVG5WfA1rLV3dGcAFMsPOnIQck4YwCLcBGAs/s1600/pelna.png';let hoverStarImg=ratingScript.getAttribute('hoverStarImg')||fullStarImg;let starSize=Number(ratingScript.getAttribute('starSize'))||25;let blockingText=ratingScript.getAttribute('blockingText')||'You have already cast your vote, your rating is $userRating$.';let align=ratingScript.getAttribute('align')||'center';let textSize=Number(ratingScript.getAttribute('textSize'))||15;let textColor=ratingScript.getAttribute('textColor')||'inherit';let fontFamily=ratingScript.getAttribute('fontFamily')||'Inherit';let readonly=!!(ratingScript.getAttribute('status')==='readonly');let topText=ratingScript.getAttribute('topText')||'Rating:';let bottomText=ratingScript.getAttribute('bottomText')||'Average: <b>$average$</b> / $max$ (<b>$votes$</b> votes)';let votesToShow=Number(ratingScript.getAttribute('votesToShow'))||3;let ratingDatabase=ratingScript.getAttribute('firebaseURL');if(!ratingDatabase){throw new Error("Missing attribute 'firebaseURL' in the tag. Please refer to the documentation.")}let starContainer=document.createElement('div');starContainer.style.display='block';starContainer.style.textAlign=align;starContainer.style.fontSize=textSize+'px';starContainer.style.color=textColor;starContainer.style.fontFamily=fontFamily;starContainer.innerHTML=`<div>${topText}</div><div class="kozyr-SRS-stars"style="position:relative;display:inline-block;line-height:0;padding:0;">${[...Array(5)].map((_,i)=>`<SRSstar style="display:inline-block;position:relative;width:${starSize}px;height:${starSize}px;margin:0;cursor:pointer;"><full style="position:absolute;width:100%;height:100%;overflow:hidden;"><img src="${fullStarImg}"style="width:${starSize}px;height:${starSize}px;"></full><empty style="position:absolute;width:100%;height:100%;overflow:hidden;"><img src="${emptyStarImg}"style="width:${starSize}px;height:${starSize}px;"></empty><hover style="position:absolute;width:0%;height:100%;overflow:hidden;"><img src="${hoverStarImg}"style="width:${starSize}px;height:${starSize}px;"></hover></SRSstar>`).join('')}</div><div class="kozyr-SRS-bottomText">${bottomText}</div>`;let loader=document.createElement('div');loader.classList.add('kozyr-SRS-loader');loader.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" style="margin:auto;background:transparent;display:block;shape-rendering:auto" width="40px" height="40px" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid"><circle cx="50" cy="50" fill="none" stroke="#000" stroke-width="10" r="30" stroke-dasharray="141.37166941154067 49.12388980384689"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="0.5s" keyTimes="0;1" values="0 50 50;360 50 50"></animateTransform></circle></svg>';loader.style.position='absolute';loader.style.width=starSize+'px';loader.style.height=starSize+'px';loader.style.left='0';loader.style.right='0';loader.style.top='0';loader.style.bottom='0';loader.style.margin='auto';starContainer.appendChild(loader);let userHasRated=false;ratingScript.parentNode.insertBefore(starContainer,ratingScript);updateStars(starContainer,fetchedRating,starSize)}setupStarRating(StarRatingGenerator)}(StarRatingGenerator));
