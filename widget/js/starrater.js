StarRatingGenerator =
  typeof StarRatingGenerator == 'undefined' ? 0x0 : StarRatingGenerator + 0x1;
(function (_0x2292f9) {
  if (
    _0x2292f9 === 0x0 &&
    !document.querySelector(
      'script[src="https://www.gstatic.com/firebasejs/8.1.1/firebase-database.js"]'
    )
  ) {
    let _0x1fde4d = document.createElement('script');
    _0x1fde4d.src = 'https://www.gstatic.com/firebasejs/8.1.1/firebase-app.js';
    document.head.appendChild(_0x1fde4d);
    _0x1fde4d.onload = function () {
      let _0x164754 = document.createElement('script');
      _0x164754.src =
        'https://www.gstatic.com/firebasejs/8.1.1/firebase-database.js';
      document.head.appendChild(_0x164754);
    };
    let _0x499ff6 = document.createElement('style');
    _0x499ff6.innerHTML =
      '@keyframes dawaj {0% {transform: rotate(0deg);} 100% {transform:rotate(360deg);}} .kozyr-SRS-loader ~ div{visibility:hidden;}';
    document.head.appendChild(_0x499ff6);
  }
  function _0x21c392(_0x55214d, _0x3b1b6e, _0x4c6b0c) {
    let _0x1c7d22 = _0x55214d.getElementsByTagName('SRSstar');
    for (let _0x55d48e = 0x0; _0x55d48e < _0x1c7d22.length; _0x55d48e++) {
      if (_0x55d48e <= _0x3b1b6e) {
        if (_0x55d48e < Math.floor(_0x3b1b6e)) {
          _0x1c7d22[_0x55d48e].querySelector('full').style.width = '100%';
          _0x1c7d22[_0x55d48e].querySelector('empty').style.width = '0%';
        } else {
          let _0x2c5cf0 = _0x3b1b6e - Math.floor(_0x3b1b6e);
          let _0x5bd454 = _0x55214d.getElementsByTagName('SRSstar')[_0x55d48e];
          let _0x17e08f = Math.round(_0x2c5cf0 * _0x4c6b0c);
          _0x5bd454.querySelector('full').style.width = _0x17e08f + 'px';
          _0x5bd454.querySelector('empty').style.width =
            _0x4c6b0c - _0x17e08f + 'px';
          _0x5bd454.querySelector('empty').querySelector('img').style.margin =
            '0 0 0 -' + _0x17e08f + 'px';
        }
      } else if (_0x55d48e > _0x3b1b6e) {
        _0x1c7d22[_0x55d48e].querySelector('full').style.width = '0%';
        _0x1c7d22[_0x55d48e].querySelector('empty').style.width = '100%';
        _0x1c7d22[_0x55d48e]
          .querySelector('empty')
          .querySelector('img').style.margin = '0 0 0 0';
      }
      _0x1c7d22[_0x55d48e].querySelector('hover').style.width = '0%';
    }
  }
  function _0x974e9e(_0x9ce11c, _0x395cf9, _0x2ffed1) {
    let _0x593d85 = document.createElement('div');
    _0x593d85.innerHTML = _0x9ce11c.replace(/\$userRating\$/g, _0x2ffed1);
    _0x593d85.style.position = 'absolute';
    _0x593d85.style.background = 'black';
    _0x593d85.style.color = 'white';
    _0x593d85.style.border = '1px solid #e0e0e0';
    _0x593d85.style.borderRadius = '7px';
    _0x593d85.style.padding = '3px 7px';
    _0x593d85.style.lineHeight = '1.2';
    _0x593d85.style.textAlign = 'center';
    _0x593d85.style.opacity = '0';
    _0x593d85.style.transition = 'opacity 1s';
    _0x593d85.style.width = '200px';
    _0x593d85.style.boxSizing = 'border-box';
    _0x593d85.style.zIndex = '9999999';
    _0x593d85.style.fontFamily =
      "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
    document.body.appendChild(_0x593d85);
    let _0x116727 = _0x395cf9.getBoundingClientRect();
    setTimeout(function () {
      _0x593d85.style.opacity = '1';
      if (_0x395cf9.style.textAlign === 'right') {
        _0x593d85.style.left =
          window.scrollX + _0x116727.left + _0x395cf9.offsetWidth - 0xc8 + 'px';
      } else if (_0x395cf9.style.textAlign === 'center') {
        _0x593d85.style.left =
          window.scrollX +
          _0x116727.left +
          _0x395cf9.offsetWidth / 0x2 -
          0x64 +
          'px';
      } else {
        _0x593d85.style.left = window.scrollX + _0x116727.left + 'px';
      }
      _0x593d85.style.top =
        (_0x116727.top > _0x593d85.offsetHeight
          ? window.scrollY + _0x116727.top - _0x593d85.offsetHeight
          : window.scrollY + _0x116727.top + _0x593d85.offsetHeight) + 'px';
    }, 0xa);
    setTimeout(function () {
      _0x593d85.style.opacity = '0';
      setTimeout(function () {
        document.body.removeChild(_0x593d85);
      }, 0x3e8);
    }, 0xdac);
  }
  function _0x44b558(_0x3bc1b1) {
    let _0x58bcd1 = document.querySelectorAll(
      'script[src="https://cdn.giahuy.net/widget/js/starrater.js"]'
    )[_0x3bc1b1];
    let _0x4a2f7c = location.host
      .replace('www.', '')
      .replace(/\./g, '_')
      .replace(/\//g, '__');
    if (_0x4a2f7c === '') {
      _0x4a2f7c = 'other';
    }
    let _0x27114b = _0x58bcd1.getAttribute('ratingName');
    if (!_0x27114b || _0x27114b === 'auto') {
      let _0x1b3097 = location.href
        .split('?')[0x0]
        .split('#')[0x0]
        .replace(location.protocol + '//', '')
        .replace('www.', '');
      if (
        _0x1b3097.substring(_0x1b3097.length - 0x1) === '/' ||
        _0x1b3097.substring(_0x1b3097.length - 0x1) === '.'
      ) {
        _0x1b3097 = _0x1b3097.substring(0x0, _0x1b3097.length - 0x1);
      }
      _0x1b3097 = _0x1b3097
        .replace(/\./g, '_')
        .replace(/\//g, '__')
        .replace(/\,/g, '___')
        .replace(/\s/g, '');
      _0x27114b = _0x1b3097;
    }
    _0x27114b = _0x27114b
      .replace(/\s/g, '_')
      .replace(/\#/g, '-')
      .replace(/\./g, '-')
      .replace(/\@/g, '-')
      .replace(/\!/g, '-')
      .replace(/\$/g, '-')
      .replace(/\%/g, '-')
      .replace(/\&/g, '-')
      .replace(/\(/g, '-')
      .replace(/\)/g, '-');
    let _0x16c422 = _0x58bcd1.getAttribute('emptyStarImg')
      ? _0x58bcd1.getAttribute('emptyStarImg')
      : 'https://1.bp.blogspot.com/-pOr9XGwtSJc/Wsjf8ULOIqI/AAAAAAAAAKE/KBh-LUDIn0YzASKf-t7mQo8UNpdHhr2SgCLcBGAs/s1600/pusta.png';
    let _0x38a5a0 = _0x58bcd1.getAttribute('fullStarImg')
      ? _0x58bcd1.getAttribute('fullStarImg')
      : 'https://3.bp.blogspot.com/-QSNdWP4Ijx4/Wsjf7QOUZ4I/AAAAAAAAAJ8/F2nReVG5WfA1rLV3dGcAFMsPOnIQck4YwCLcBGAs/s1600/pelna.png';
    let _0x380159 = _0x58bcd1.getAttribute('hoverStarImg');
    if (_0x380159 === null || _0x380159 == '') {
      _0x380159 = _0x38a5a0;
    }
    let _0x2a37ea = _0x58bcd1.getAttribute('starSize');
    if (!_0x2a37ea || Number(_0x2a37ea) < 0x0 || isNaN(_0x2a37ea)) {
      _0x2a37ea = 0x19;
    }
    _0x2a37ea = Number(_0x2a37ea);
    let _0x580744 = _0x58bcd1.getAttribute('blockingText');
    if (_0x580744 === null) {
      _0x580744 =
        'You have already cast your vote, your rating is $userRating$.';
    }
    let _0xe6cb5e = _0x58bcd1.getAttribute('align');
    if (_0xe6cb5e !== 'right' && _0xe6cb5e !== 'left') {
      _0xe6cb5e = 'center';
    }
    let _0x4842c3 = _0x58bcd1.getAttribute('textSize');
    if (!_0x4842c3 || Number(_0x4842c3) < 0x0 || isNaN(_0x4842c3)) {
      _0x4842c3 = 0xf;
    }
    _0x4842c3 = Number(_0x4842c3);
    let _0x3ecbbe = _0x58bcd1.getAttribute('textColor')
      ? _0x58bcd1.getAttribute('textColor')
      : 'inherit';
    let _0xf196b1 = _0x58bcd1.getAttribute('fontFamily');
    if (_0xf196b1 == 'Georgia' || _0xf196b1 == 'Georgia, serif') {
      _0xf196b1 = 'Georgia, serif';
    } else {
      if (
        _0xf196b1 == 'Palatino' ||
        _0xf196b1 == "'Palatino Linotype', 'Book Antiqua', Palatino, serif"
      ) {
        _0xf196b1 = '"Palatino Linotype", "Book Antiqua", Palatino, serif';
      } else {
        if (
          _0xf196b1 == 'Times New Roman' ||
          _0xf196b1 == "'Times New Roman', Times, serif"
        ) {
          _0xf196b1 = '"Times New Roman", Times, serif';
        } else {
          if (
            _0xf196b1 == 'Arial' ||
            _0xf196b1 == 'Arial, Helvetica, sans-serif'
          ) {
            _0xf196b1 = 'Arial, Helvetica, sans-serif';
          } else {
            if (
              _0xf196b1 == 'Arial Black' ||
              _0xf196b1 == "'Arial Black', Gadget, sans-serif"
            ) {
              _0xf196b1 = '"Arial Black", Gadget, sans-serif';
            } else {
              if (
                _0xf196b1 == 'Comic Sans' ||
                _0xf196b1 == "'Comic Sans MS', cursive, sans-serif"
              ) {
                _0xf196b1 = '"Comic Sans MS", cursive, sans-serif';
              } else {
                if (
                  _0xf196b1 == 'Impact' ||
                  _0xf196b1 == 'Impact, Charcoal, sans-serif'
                ) {
                  _0xf196b1 = 'Impact, Charcoal, sans-serif';
                } else {
                  if (
                    _0xf196b1 == 'Lucida Sans' ||
                    _0xf196b1 ==
                      "'Lucida Sans Unicode', 'Lucida Grande', sans-serif"
                  ) {
                    _0xf196b1 =
                      '"Lucida Sans Unicode", "Lucida Grande", sans-serif';
                  } else {
                    if (
                      _0xf196b1 == 'Tahoma' ||
                      _0xf196b1 == 'Tahoma, Geneva, sans-serif'
                    ) {
                      _0xf196b1 = 'Tahoma, Geneva, sans-serif';
                    } else {
                      if (
                        _0xf196b1 == 'Trebuchet' ||
                        _0xf196b1 == "'Trebuchet MS', Helvetica, sans-serif"
                      ) {
                        _0xf196b1 = '"Trebuchet MS", Helvetica, sans-serif';
                      } else {
                        if (
                          _0xf196b1 == 'Verdana' ||
                          _0xf196b1 == 'Verdana, Geneva, sans-serif'
                        ) {
                          _0xf196b1 = 'Verdana, Geneva, sans-serif';
                        } else {
                          if (
                            _0xf196b1 == 'Courier New' ||
                            _0xf196b1 == "'Courier New', Courier, monospace"
                          ) {
                            _0xf196b1 = '"Courier New", Courier, monospace';
                          } else if (
                            _0xf196b1 == 'Lucida Console' ||
                            _0xf196b1 == "'Lucida Console', Monaco, monospace"
                          ) {
                            _0xf196b1 = '"Lucida Console", Monaco, monospace';
                          } else {
                            _0xf196b1 = 'Inherit';
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    let _0x1d2a25 = !!(_0x58bcd1.getAttribute('status') === 'readonly');
    let _0x34a28a =
      _0x58bcd1.getAttribute('topText') !== null
        ? _0x58bcd1.getAttribute('topText')
        : 'Rating:';
    let _0x2ba1ad =
      _0x58bcd1.getAttribute('bottomText') !== null
        ? _0x58bcd1.getAttribute('bottomText')
        : 'Average: <b>$average$</b> / $max$ (<b>$votes$</b> votes)';
    let _0x39df01 = Number(_0x58bcd1.getAttribute('numberOfStars'));
    if (_0x39df01 < 0x1 || isNaN(_0x39df01)) {
      _0x39df01 = 0x5;
    }
    let _0x137f57 =
      _0x58bcd1.getAttribute('thankYouText') !== null
        ? _0x58bcd1.getAttribute('thankYouText')
        : 'Thanks for voting';
    let _0x5b42f7 = document.createElement('div');
    _0x5b42f7.setAttribute('ratingName', _0x27114b);
    _0x58bcd1.parentNode.insertBefore(_0x5b42f7, _0x58bcd1);
    _0x5b42f7.style.textAlign = _0xe6cb5e;
    _0x5b42f7.style.position = 'relative';
    _0x5b42f7.oncontextmenu = function (_0x4783a6) {
      _0x4783a6.preventDefault();
      return false;
    };
    let _0x4556e7 = document.createElement('div');
    _0x4556e7.setAttribute('class', 'kozyr-SRS-loader');
    _0x4556e7.style.border = '6px solid #f3f3f3';
    _0x4556e7.style.borderRadius = '50%';
    _0x4556e7.style.borderTop = '6px solid #3498db';
    _0x4556e7.style.width = '25px';
    _0x4556e7.style.height = '25px';
    _0x4556e7.style.animation = 'dawaj 1s linear infinite';
    if (_0xe6cb5e === 'center') {
      _0x4556e7.style.margin = 'auto';
    } else if (_0xe6cb5e === 'right') {
      _0x4556e7.style.marginLeft =
        'calc(100% - ' + _0x2a37ea * _0x39df01 + 'px)';
    }
    _0x5b42f7.appendChild(_0x4556e7);
    let _0x48f72d = document.createElement('div');
    let _0x53e55b = document.createElement('div');
    _0x2ba1ad = _0x2ba1ad
      .replace(/\$average\$/g, '<span class="kozyr-SRS-average">0</span>')
      .replace(/\$votes\$/g, '<span class="kozyr-SRS-votes">0</span>')
      .replace(/\$max\$/g, _0x39df01);
    _0x48f72d.innerHTML = _0x34a28a;
    _0x48f72d.style.fontSize = _0x4842c3 + 'px';
    _0x48f72d.style.lineHeight = '1.2';
    _0x48f72d.style.fontFamily = _0xf196b1;
    _0x48f72d.style.textAlign = _0xe6cb5e;
    _0x48f72d.style.color = _0x3ecbbe;
    _0x5b42f7.appendChild(_0x48f72d);
    _0x53e55b.style.fontSize = _0x4842c3 + 'px';
    _0x53e55b.style.lineHeight = '1.2';
    _0x53e55b.style.fontFamily = _0xf196b1;
    _0x53e55b.style.textAlign = _0xe6cb5e;
    _0x53e55b.style.color = _0x3ecbbe;
    _0x53e55b.innerHTML = _0x2ba1ad;
    let _0x476024 = _0x58bcd1.getAttribute('firebaseURL');
    if (_0x476024 === null) {
      _0x476024 =
        'Firebase error. Add attribute firebaseURL="https://YOUR-FIREBASE.firebaseio.com" to your rating script.';
    } else {
      if (_0x476024 == '') {
        _0x476024 =
          'Firebase error. Enter the URL adress of your Firebase to "firebaseURL" attribute in your rating script.';
      } else {
        if (_0x476024.indexOf('https://') !== 0x0) {
          _0x476024 = 'Firebase error. Invalid Fierabse URL';
        } else {
          if (_0x476024.lastIndexOf('firebaseio.com') < 0x5) {
            _0x476024 = 'Firebase error. Invalid Fierabse URL';
          } else if (_0x476024.lastIndexOf('/') !== _0x476024.length - 0x1) {
            _0x476024 = _0x476024 + '/';
          }
        }
      }
    }
    let _0x288cf6 = document.createElement('div');
    _0x288cf6.style.width = _0x2a37ea * _0x39df01 + 'px';
    _0x288cf6.style.display = 'inline-block';
    _0x5b42f7.appendChild(_0x288cf6);
    for (let _0x33f44a = 0x1; _0x33f44a <= _0x39df01; _0x33f44a++) {
      let _0x59ecc2 = document.createElement('SRSstar');
      _0x59ecc2.style.display = 'inline-block';
      _0x59ecc2.style.width = _0x2a37ea + 'px';
      _0x59ecc2.style.cursor =
        !localStorage['bsrgl_' + _0x27114b] && !_0x1d2a25
          ? 'pointer'
          : 'default';
      if (!_0x1d2a25) {
        _0x59ecc2.onmouseenter = function () {
          if (!localStorage['bsrgl_' + _0x27114b]) {
            let _0x3d1622 = _0x5b42f7.getElementsByTagName('SRSstar');
            for (
              let _0x405a32 = 0x0;
              _0x405a32 < _0x3d1622.length;
              _0x405a32++
            ) {
              if (_0x405a32 < _0x33f44a) {
                _0x3d1622[_0x405a32].querySelector('full').style.width = '0%';
                _0x3d1622[_0x405a32].querySelector('empty').style.width = '0%';
                _0x3d1622[_0x405a32].querySelector('hover').style.width =
                  '100%';
              } else {
                _0x3d1622[_0x405a32].querySelector('full').style.width = '0%';
                _0x3d1622[_0x405a32].querySelector('hover').style.width = '0%';
                _0x3d1622[_0x405a32].querySelector('empty').style.width =
                  '100%';
                _0x3d1622[_0x405a32]
                  .querySelector('empty')
                  .querySelector('img').style.margin = '0 0 0 0';
              }
            }
            if (_0x34a28a != '') {
              _0x48f72d.innerHTML = _0x33f44a + ' / ' + _0x39df01;
            }
          } else {
            _0x5b42f7.title = _0x580744.replace(
              /\$userRating\$/g,
              localStorage['bsrgl_' + _0x27114b]
            );
            _0x5b42f7.style.cursor = 'default';
          }
        };
      }
      _0x59ecc2.setAttribute('wartosc', _0x33f44a);
      let _0x396c71 = document.createElement('full');
      _0x396c71.style.display = 'inline-block';
      _0x396c71.style.overflow = 'hidden';
      let _0x15c73e = document.createElement('empty');
      _0x15c73e.style.display = 'inline-block';
      _0x15c73e.style.overflow = 'hidden';
      let _0x3f9741 = document.createElement('hover');
      _0x3f9741.style.display = 'inline-block';
      _0x3f9741.style.overflow = 'hidden';
      let _0xa36f1b = document.createElement('img');
      _0xa36f1b.style.background = 'transparent';
      _0xa36f1b.style.border = '0';
      _0xa36f1b.style.padding = '0';
      _0xa36f1b.style.margin = '0';
      _0xa36f1b.style.maxWidth = 'none';
      let _0x26b460 = document.createElement('img');
      _0x26b460.style.background = 'transparent';
      _0x26b460.style.border = '0';
      _0x26b460.style.padding = '0';
      _0x26b460.style.margin = '0';
      _0x26b460.style.maxWidth = 'none';
      let _0x40f737 = document.createElement('img');
      _0x40f737.style.background = 'transparent';
      _0x40f737.style.border = '0';
      _0x40f737.style.padding = '0';
      _0x40f737.style.margin = '0';
      _0x40f737.style.maxWidth = 'none';
      _0xa36f1b.src = _0x16c422;
      _0x26b460.src = _0x38a5a0;
      _0x40f737.src = _0x380159;
      _0xa36f1b.style.width = _0x2a37ea + 'px';
      _0x26b460.style.width = _0x2a37ea + 'px';
      _0x40f737.style.width = _0x2a37ea + 'px';
      _0x59ecc2.style.lineHeight = '0';
      _0x396c71.appendChild(_0x26b460);
      _0x15c73e.appendChild(_0xa36f1b);
      _0x3f9741.appendChild(_0x40f737);
      _0x59ecc2.appendChild(_0x396c71);
      _0x59ecc2.appendChild(_0x15c73e);
      _0x59ecc2.appendChild(_0x3f9741);
      _0x288cf6.appendChild(_0x59ecc2);
    }
    _0x5b42f7.appendChild(_0x53e55b);
    _0x21c392(_0x5b42f7, 0x0, _0x2a37ea);
    if (_0x476024.indexOf('Firebase error') < 0x0) {
      const _0x2a88e5 = {
        databaseURL: _0x476024,
      };
      let _0x34428f = firebase.initializeApp(_0x2a88e5, _0x27114b + _0x2292f9);
      let _0x1d4f1f = _0x34428f
        .database()
        .ref('StarRatingSystem/' + _0x4a2f7c + '/' + _0x27114b);
      _0x1d4f1f.on('value', (_0x3a4f82) => {
        let _0x16c0cc = _0x3a4f82.val();
        if (!_0x16c0cc) {
          const _0x4ab66b = {
            OO: 0x0,
            O0: 0x0,
          };
          _0x16c0cc = _0x4ab66b;
        }
        _0x21c392(_0x5b42f7, _0x16c0cc.OO * _0x39df01, _0x2a37ea);
        if (_0x5b42f7.contains(_0x4556e7)) {
          _0x4556e7.remove();
        }
        _0x288cf6.onmouseleave = function () {
          _0x21c392(_0x5b42f7, _0x16c0cc.OO * _0x39df01, _0x2a37ea);
          _0x48f72d.innerHTML = _0x34a28a;
        };
        _0x5b42f7
          .querySelectorAll('.kozyr-SRS-average')
          .forEach(
            (_0x402b7f) =>
              (_0x402b7f.textContent =
                Math.round(_0x16c0cc.OO * _0x39df01 * 0x64) / 0x64)
          );
        _0x5b42f7
          .querySelectorAll('.kozyr-SRS-votes')
          .forEach((_0x38e051) => (_0x38e051.textContent = _0x16c0cc.O0));
        if (!_0x1d2a25) {
          _0x5b42f7
            .querySelectorAll('SRSstar')
            .forEach((_0x37b286, _0x5c4fa2) => {
              _0x37b286.onclick = function () {
                if (!localStorage['bsrgl_' + _0x27114b]) {
                  var _0x20a64f =
                    (_0x16c0cc.OO * _0x16c0cc.O0 +
                      (_0x5c4fa2 + 0x1) / _0x39df01) /
                    (_0x16c0cc.O0 + 0x1);
                  const _0x4acb9f = {
                    OO: _0x20a64f,
                    O0: _0x16c0cc.O0 + 0x1,
                  };
                  _0x1d4f1f.set(_0x4acb9f);
                  localStorage['bsrgl_' + _0x27114b] = _0x5c4fa2 + 0x1;
                  _0x5b42f7
                    .querySelectorAll('SRSstar')
                    .forEach(
                      (_0x336e73) => (_0x336e73.style.cursor = 'default')
                    );
                  _0x974e9e(_0x137f57, _0x5b42f7, _0x5c4fa2 + 0x1);
                  _0x48f72d.innerHTML = _0x34a28a;
                } else {
                  _0x974e9e(
                    _0x580744,
                    _0x5b42f7,
                    localStorage['bsrgl_' + _0x27114b]
                  );
                }
              };
            });
        }
      });
    } else {
      _0x5b42f7.innerHTML = _0x476024;
    }
  }
  function _0xc47106(_0x148a3a) {
    if (
      typeof firebase == 'object' &&
      typeof firebase.database == 'function' &&
      typeof firebase.initializeApp == 'function'
    ) {
      _0x44b558(_0x148a3a);
    } else {
      setTimeout(function () {
        _0xc47106(_0x148a3a);
      }, 0x32);
    }
  }
  _0xc47106(_0x2292f9);
})(StarRatingGenerator);
