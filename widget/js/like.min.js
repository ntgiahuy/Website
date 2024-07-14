var a = ghLikeFbase.sharedBy;
if ('www.giahuy.net' === a) {
  function intToString(e) {
    var t = {
      KCDAQ: function (e, t) {
        return e - t;
      },
      qRLHm: function (e, t) {
        return e > t;
      },
      XQyLQ: function (e, t) {
        return e >= t;
      },
      DDRMN: function (e, t) {
        return e + t;
      },
      QFoZb: function (e, t) {
        return e / t;
      },
    };
    if ((e = e.toString().replace(/[^0-9.]/g, '')) < 1e3) return e;
    let n,
      r = [
        { v: 1e3, s: 'K' },
        { v: 1e6, s: 'M' },
        { v: 1e9, s: 'B' },
        { v: 1e12, s: 'T' },
        { v: 1e15, s: 'P' },
        { v: 1e18, s: 'E' },
      ];
    for (n = t.KCDAQ(r.length, 1); t.qRLHm(n, 0) && !t.XQyLQ(e, r[n].v); n--);
    return t.DDRMN(
      t
        .QFoZb(e, r[n].v)
        .toFixed(2)
        .replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1'),
      r[n].s
    );
  }
  var ghLikePostId = document
    .querySelector('.gh-like-btn')
    .getAttribute('data-like')
    .split('/')[1];
  function getLiked() {
    var e = '#gh-liked',
      t = 'data-klik',
      e_buZKW = function (e, t) {
        return e === t;
      },
      n = 'pMyst',
      e_oCXUC = function (e, t) {
        return e === t;
      },
      r = new Firebase(
        ghLikeFbase.firebaseUrl +
          document.querySelector('.gh-like-btn').getAttribute('data-like')
      );
    r.once('value', function (i) {
      var c = e,
        u = t,
        o_zCofC = function (e, t) {
          return (function (e, t) {
            return e < t;
          })(e, t);
        };
      if (e_buZKW(n, n)) {
        var o = i.val();
        if (
          (e_buZKW(o, null) && (o = 0),
          r.set(o),
          e_oCXUC(ghLikeFbase.abbreviation, '0'))
        )
          !(function (e, t) {
            return e !== t;
          })('EtIci', 'xtKLC')
            ? _0x1f6c6b.querySelector(c).setAttribute(u, _0x42dae1)
            : document.querySelector(e).setAttribute('data-klik', o);
        else if (e_buZKW(ghLikeFbase.abbreviation, '1')) {
          if (e_oCXUC('qfqBG', 'oznYR')) return _0x205a68;
          document.querySelector(e).setAttribute(
            t,
            (function (e, t) {
              return e(t);
            })(intToString, o)
          );
        } else
          (function (e, t) {
            return e === t;
          })(ghLikeFbase.abbreviation, '2') &&
            document
              .querySelector('#gh-liked')
              .setAttribute(t, o.toLocaleString('id-ID'));
      } else for (var l = 1; o_zCofC(l, _0x380f96.length); l++) _0x5a615f[l].parentNode.removeChild(_0x2abf90[l]);
    });
  }
  function ghLike() {
    var e = {
        JrCiQ: function (e, t) {
          return e === t;
        },
        xkMwx: 'Algyi',
        wVURd: function (e, t) {
          return e != t;
        },
        PNdnu: function (e, t) {
          return e + t;
        },
        BxxNN: 'ghLike',
        YxnqK: '.gh-like-btn svg',
        sUETM: 'like',
        vdcsI: '#gh-liked',
        KyVmG: 'data-teks',
        JxkTr: 'data-after',
        Fstew: function (e, t) {
          return e === t;
        },
        MgQAu: function (e, t) {
          return e === t;
        },
        dJQhn: function (e, t) {
          return e !== t;
        },
        eGaKi: 'BHDPp',
        jQsfb: 'data-klik',
        mJdNP: function (e, t) {
          return e + t;
        },
        HmrtN: 'value',
      },
      t = new Firebase(
        e.mJdNP(
          ghLikeFbase.firebaseUrl,
          document.querySelector('.gh-like-btn').getAttribute('data-like')
        )
      );
    t.once(e.HmrtN, function (n) {
      var r = n.val();
      if (e.JrCiQ(r, null))
        if (e.xkMwx != e.xkMwx) {
          if (_0x4c87a7) {
            var i = _0x238979.apply(_0x513744, arguments);
            return (_0x4501e8 = null), i;
          }
        } else r = 0;
      else
        e.wVURd(
          localStorage.getItem(e.PNdnu(e.BxxNN, ghLikePostId)),
          ghLikePostId
        ) &&
          (r++,
          localStorage.setItem('ghLike' + ghLikePostId, ghLikePostId),
          document.querySelector(e.YxnqK).classList.add(e.sUETM),
          document
            .querySelector(e.vdcsI)
            .setAttribute(
              e.KyVmG,
              document.querySelector(e.vdcsI).getAttribute(e.JxkTr)
            ));
      if ((t.set(r), e.Fstew(ghLikeFbase.abbreviation, '0')))
        document.querySelector('#gh-liked').setAttribute('data-klik', r);
      else if (e.MgQAu(ghLikeFbase.abbreviation, '1')) {
        if (e.dJQhn(e.eGaKi, e.eGaKi)) {
          var c = _0x108c9c.apply(_0x5e78a9, arguments);
          return (_0x44f28b = null), c;
        }
        document.querySelector(e.vdcsI).setAttribute(e.jQsfb, intToString(r));
      } else
        '2' === ghLikeFbase.abbreviation &&
          document
            .querySelector(e.vdcsI)
            .setAttribute('data-klik', r.toLocaleString('id-ID'));
    });
  }
  !(function () {
    var e_efnXG = function (e, t) {
        return e !== t;
      },
      e_fACEV = function (e, t) {
        return e + t;
      },
      e_Fcehk = function (e, t) {
        return e === t;
      },
      e = 'CsKqx',
      e_VRhzq = function (e) {
        return e();
      },
      e_mjkfR = function (e) {
        return e();
      },
      e_PkNNf = function (e, t) {
        return e < t;
      },
      n = 'tEWUs',
      e_bzyZv = function (e, t, n) {
        return e(t, n);
      },
      e_anTom = function (e, t) {
        return e < t;
      },
      r = (function () {
        var n_YBrWa = function (e, t) {
            return e_Fcehk(e, t);
          },
          t = 'MfIFx';
        if (
          (function (e, t) {
            return e !== t;
          })(e, e)
        ) {
          var n = _0x5356ee
            ? function () {
                if (_0x11e51f) {
                  var e = _0x14b5db.apply(_0x26db82, arguments);
                  return (_0x57ea96 = null), e;
                }
              }
            : function () {};
          return (_0x42623f = !1), n;
        }
        var r = !0;
        return function (e, n) {
          if (!e_efnXG('cCZiP', 'cCZiP')) {
            var i = r
              ? function () {
                  if (n) {
                    if (n_YBrWa(t, 'MfIFx')) {
                      var r = n.apply(e, arguments);
                      return (n = null), r;
                    }
                    if (_0x547d12) {
                      var i = _0xe5d275.apply(_0x5ccbb8, arguments);
                      return (_0x491d74 = null), i;
                    }
                  }
                }
              : function () {};
            return (r = !1), i;
          }
          _0x48689a = puEZlL.vBplq(
            _0x108a03,
            puEZlL.PKLNH('return (function() ' + puEZlL.zGRZy, ');')
          )();
        };
      })();
    var c,
      u =
        ((c = !0),
        function (e, t) {
          var n = c
            ? function () {
                if (t) {
                  var n = t.apply(e, arguments);
                  return (t = null), n;
                }
              }
            : function () {};
          return (c = !1), n;
        }),
      o = e_bzyZv(u, this, function () {
        for (
          var e = e_mjkfR(function () {
              if (
                !(function (e, t) {
                  return e !== t;
                })('TAWVC', 'TAWVC')
              ) {
                var e;
                try {
                  e = Function(
                    e_fACEV(
                      e_fACEV(
                        'return (function() ',
                        '{}.constructor("return this")( )'
                      ),
                      ');'
                    )
                  )();
                } catch (t) {
                  e = window;
                }
                return e;
              }
              !(function (e) {
                e_VRhzq(e);
              })(_0x52a668);
            }),
            t = (e.console = e.console || {}),
            n = ['log', 'warn', 'info', 'error', 'exception', 'table', 'trace'],
            r = 0;
          e_PkNNf(r, n.length);
          r++
        ) {
          var i = u.constructor.prototype.bind(u),
            c = n[r],
            o = t[c] || i;
          (i.__proto__ = u.bind(u)),
            (i.toString = o.toString.bind(o)),
            (t[c] = i);
        }
      });
    !(function (e) {
      e();
    })(o);
    var l = 'https://cdn.firebase.com/js/client/2.2.1/firebase.js',
      f = document.querySelectorAll(
        (function (e, t) {
          return e + t;
        })(
          (function (e, t) {
            return e + t;
          })('script[src="', l),
          '"]'
        )
      );
    if (
      (function (e, t) {
        return e > t;
      })(f.length, 1)
    )
      for (var s = 1; e_anTom(s, f.length); s++)
        e_Fcehk('hNMSe', 'hNMSe')
          ? f[s].parentNode.removeChild(f[s])
          : (_0x5cf5e5 = _0x53c96a);
    var d = document.createElement('script');
    (d.async = !0),
      (d.src = l),
      (d.onload = function () {
        e_efnXG(n, n) || e_mjkfR(getLiked);
      });
    var b = document.body;
    b.parentNode.insertBefore(d, b);
  })(),
    document
      .querySelector('.gh-like-btn')
      .addEventListener('click', function () {
        ghLike();
      }),
    localStorage.getItem('ghLike' + ghLikePostId) === ghLikePostId &&
      (document.querySelector('.gh-like-btn svg').classList.add('like'),
      document
        .querySelector('#gh-liked')
        .setAttribute(
          'data-teks',
          document.querySelector('#gh-liked').getAttribute('data-after')
        ));
} else window.location.href = 'https://www.giahuy.net/p/credit.html';
