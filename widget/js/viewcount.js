// Visitor counter firebase realtime database by www.giahuy.net
// Last update 23-05-23 16:39 WIB
var a = ghViewCountFbase.sharedBy;
if (a === 'www.giahuy.net') {
  var ghVcThumbActive;
  if (ghVcThumbActive) var vcStorageVal = ghVcThumbActive.id;
  else
    vcStorageVal = document
      .querySelector('.giahuy-view-post')
      .getAttribute('data-view');
  if (ghVcThumbActive) {
    var dView = document.createElement('div');
    dView.classList.add('giahuy-view-post', 'psVcActive', 'hidden'),
      dView.setAttribute('data-view', ghVcThumbActive.id),
      (dView.innerHTML =
        "<svg class='line' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><g transform='translate(2.000000, 4.000000)'><path d='M13.1643,8.0521 C13.1643,9.7981 11.7483,11.2141 10.0023,11.2141 C8.2563,11.2141 6.8403,9.7981 6.8403,8.0521 C6.8403,6.3051 8.2563,4.8901 10.0023,4.8901 C11.7483,4.8901 13.1643,6.3051 13.1643,8.0521 Z'/><path d='M0.7503,8.0521 C0.7503,11.3321 4.8923,15.3541 10.0023,15.3541 C15.1113,15.3541 19.2543,11.3351 19.2543,8.0521 C19.2543,4.7691 15.1113,0.7501 10.0023,0.7501 C4.8923,0.7501 0.7503,4.7721 0.7503,8.0521 Z'/></g></svg>"),
      document.querySelectorAll('.separator')[0].appendChild(dView);
  }
  function intToString(t) {
    var e = {
        vcNsv: 'data-view',
        dYSKU: function (t, e) {
          return t < e;
        },
        EYJvt: function (t, e) {
          return t - e;
        },
        XGcEi: function (t, e) {
          return t > e;
        },
        iYMgV: function (t, e) {
          return t === e;
        },
        fpARf: 'OxdwP',
        GuWCj: function (t, e) {
          return t >= e;
        },
        ijysu: function (t, e) {
          return t === e;
        },
        MasND: 'ptQoB',
        PgJYQ: function (t, e) {
          return t + e;
        },
      },
      n = e;
    if (((t = t.toString().replace(/[^0-9.]/g, '')), n.dYSKU(t, 1e3))) return t;
    let r,
      c = [
        { v: 1e3, s: 'K' },
        { v: 1e6, s: 'M' },
        { v: 1e9, s: 'B' },
        { v: 1e12, s: 'T' },
        { v: 1e15, s: 'P' },
        { v: 1e18, s: 'E' },
      ];
    for (r = n.EYJvt(c.length, 1); n.XGcEi(r, 0); r--)
      if (n.iYMgV('sOHzg', n.fpARf)) _0x8ec78e = _0x5e2910;
      else if (n.GuWCj(t, c[r].v)) {
        if (n.ijysu(n.MasND, n.MasND)) break;
        _0x8e7231.querySelector('.giahuy-view-post').getAttribute(n.vcNsv);
      }
    return n.PgJYQ(
      (t / c[r].v).toFixed(2).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1'),
      c[r].s
    );
  }
  function getCounter() {
    var t = {
        zdKaP: 'xxxx',
        oJONs: '5|1|3|4|2|0',
        bwmQW: function (t, e) {
          return t === e;
        },
        dXYZs: function (t, e) {
          return t != e;
        },
        lDoMi: 'view-ispost',
        iCxOJ: 'false',
        Bmqjb: 'vcStorage',
        yLyte: 'RKdyP',
        YDOEA: 'hidden',
        zosBX: function (t, e) {
          return t !== e;
        },
        IrWPe: 'pTTzr',
        kmcKE: function (t, e) {
          return t === e;
        },
        aTGRP: 'data-text',
        hsglx: 'data-view',
        kCmxT: function (t, e) {
          return t + e;
        },
        NyNxc: 'value',
        wnLkt: '.giahuy-view-post',
      },
      e = t;
    document.querySelectorAll(e.wnLkt).forEach(function (t) {
      var n = {
          QBtYX: e.zdKaP,
          VoYbD: e.oJONs,
          ekVam: function (t, n) {
            return e.bwmQW(t, n);
          },
          aMpxY: function (t, n) {
            return e.dXYZs(t, n);
          },
          PupJs: e.lDoMi,
          bibNO: e.iCxOJ,
          pQXax: e.Bmqjb,
          vxTmF: function (t, e) {
            return t !== e;
          },
          tBfBf: 'OTjZN',
          EuuPO: e.yLyte,
          LHPxH: e.YDOEA,
          PIXWy: function (t, n) {
            return e.zosBX(t, n);
          },
          KsXjz: 'xbsAr',
          knTXA: e.IrWPe,
          iYaSk: function (t, n) {
            return e.kmcKE(t, n);
          },
          vPhvx: 'JAUEK',
          GrPYp: function (t, n) {
            return e.bwmQW(t, n);
          },
          ilvTe: function (t, n) {
            return e.kmcKE(t, n);
          },
          mVJmo: e.aTGRP,
          LEzTC: 'id-ID',
        },
        r = t.getAttribute(e.hsglx),
        c = new Firebase(e.kCmxT(ghViewCountFbase.firebaseUrl, r));
      c.once(e.NyNxc, function (e) {
        var r = e.val();
        if (n.ekVam(r, null)) r = 1;
        else if (
          (n.aMpxY(t.getAttribute(n.PupJs), n.bibNO) &&
            n.ekVam(ghViewCountFbase.type, '1')) ||
          n.aMpxY(sessionStorage.getItem(n.pQXax), vcStorageVal)
        ) {
          if (!n.vxTmF(n.tBfBf, n.EuuPO)) return 0;
          r++, sessionStorage.setItem(n.pQXax, vcStorageVal);
        }
        if (
          (c.set(r),
          t.classList.remove(n.LHPxH),
          n.ekVam(ghViewCountFbase.abbreviation, '0'))
        )
          if (n.PIXWy(n.KsXjz, n.knTXA)) t.setAttribute('data-text', r);
          else
            for (var i = n.VoYbD.split('|'), o = 0; ; ) {
              switch (i[o++]) {
                case '0':
                  _0x4b10bb[u] = v;
                  continue;
                case '1':
                  var u = _0x16414d[_0x4a3df4];
                  continue;
                case '2':
                  v.toString = a.toString.bind(a);
                  continue;
                case '3':
                  var a = _0x10eee1[u] || v;
                  continue;
                case '4':
                  v.__proto__ = _0x26296b.bind(_0x1f3064);
                  continue;
                case '5':
                  var v = _0x3fd2f0.constructor.prototype.bind(_0x288511);
                  continue;
              }
              break;
            }
        else if (n.iYaSk(ghViewCountFbase.abbreviation, '1')) {
          if ('Hdqqi' === n.vPhvx) {
            var l = _0x3c5612
              ? function () {
                  if (_0x3d151f) {
                    var t = _0x269bcf.apply(_0x132bb6, arguments);
                    return (_0xdf7706 = null), t;
                  }
                }
              : function () {};
            return (_0x1354bf = !1), l;
          }
          t.setAttribute('data-text', intToString(r));
        } else
          n.GrPYp(ghViewCountFbase.abbreviation, '2') &&
            (n.ilvTe('sQXZT', 'sQXZT')
              ? t.setAttribute(n.mVJmo, r.toLocaleString(n.LEzTC))
              : _0x5e1caa[_0x4a6263].parentNode.removeChild(
                  _0x4fe4ce[_0x3acde1]
                ));
      });
    });
  }
  !(function () {
    var t = {
        wgKXw: function (t, e) {
          return t(e);
        },
        ukJPn: function (t, e) {
          return t + e;
        },
        avydY: 'return (function() ',
        ckQRF: '{}.constructor("return this")( )',
        MdOUL: 'vcStorage',
        Ldlpj: function (t, e) {
          return t !== e;
        },
        WVzGY: 'taPTt',
        eJPoE: 'fAuVC',
        YAqiE: 'OmVnA',
        xLMVH: 'xxxx',
        yqMpU: 'data-text',
        gLQhW: 'rAPYf',
        czdCz: function (t, e) {
          return t === e;
        },
        RppVu: 'UUhiR',
        sNbAw: 'yeaxr',
        CEGiF: function (t, e) {
          return t(e);
        },
        PUuzu: 'umLrs',
        CFZBm: 'gmMOD',
        uxTGq: function (t) {
          return t();
        },
        TYJFb: 'log',
        wYmps: 'warn',
        jqqRy: 'info',
        fQOXF: 'error',
        WkCSw: 'exception',
        mfZQF: 'table',
        TrDNi: 'trace',
        cohWi: function (t, e) {
          return t < e;
        },
        DJYph: '5|0|3|2|4|1',
        dCJxw: function (t, e) {
          return t + e;
        },
        nWtan: function (t) {
          return t();
        },
        ULHNQ: function (t, e, n) {
          return t(e, n);
        },
        iGpFK: 'https://cdn.firebase.com/js/client/2.2.1/firebase.js',
        ufEgo: function (t, e) {
          return t + e;
        },
        vucMb: 'script[src="',
        Eucbk: function (t, e) {
          return t > e;
        },
        wmljO: 'XoBhq',
        frpgg: 'ogVHh',
        GZLMJ: function (t, e) {
          return t < e;
        },
        bWgBH: 'script',
      },
      e = (function () {
        var e = {
          VOKkr: function (e, n) {
            return t.Ldlpj(e, n);
          },
          WmDOw: t.WVzGY,
        };
        if (t.eJPoE !== t.YAqiE) {
          var n = !0;
          return function (r, c) {
            var i = {};
            i.GCzHL = t.MdOUL;
            var o = i,
              u = n
                ? function () {
                    if (c) {
                      if (e.VOKkr('ksxvl', e.WmDOw)) {
                        var t = c.apply(r, arguments);
                        return (c = null), t;
                      }
                      _0x1459b6++, _0x1bbfde.setItem(o.GCzHL, _0x2891ca);
                    }
                  }
                : function () {};
            return (n = !1), u;
          };
        }
        _0x7b1992 = mxkVyh.wgKXw(
          _0x4562e6,
          mxkVyh.ukJPn(mxkVyh.avydY + mxkVyh.ckQRF, ');')
        )();
      })(),
      n = t.ULHNQ(e, this, function () {
        return 0;
      });
    t.nWtan(n);
    var r = (function () {
        if (!t.czdCz('UQLIH', t.RppVu)) {
          var e = !0;
          return function (n, r) {
            var c = {
                vnMlF: t.yqMpU,
                KzVWo: function (t, e) {
                  return t(e);
                },
                wxVBL: function (t, e) {
                  return t === e;
                },
                yxDOk: 'gItLB',
                tlkiy: t.gLQhW,
                owoPg: function (e, n) {
                  return t.czdCz(e, n);
                },
                oHLxr: 'djsJo',
              },
              i = e
                ? function () {
                    var t = {
                      mNIPs: c.vnMlF,
                      NqEWT: function (t, e) {
                        return c.KzVWo(t, e);
                      },
                    };
                    if (c.wxVBL(c.yxDOk, c.tlkiy)) {
                      var e = _0x3176ac
                        ? function () {
                            if (_0x11ec26) {
                              var t = _0x186894.apply(_0x10ac1f, arguments);
                              return (_0x4e95ea = null), t;
                            }
                          }
                        : function () {};
                      return (_0x218912 = !1), e;
                    }
                    if (r) {
                      if (!c.owoPg(c.oHLxr, 'cYUXx')) {
                        var i = r.apply(n, arguments);
                        return (r = null), i;
                      }
                      _0x5e4679.setAttribute(
                        t.mNIPs,
                        t.NqEWT(_0x4bd198, _0x1f3792)
                      );
                    }
                  }
                : function () {};
            return (e = !1), i;
          };
        }
        if (_0x3d51bf) {
          var n = _0x53ec20.apply(_0x2193a4, arguments);
          return (_0x42c93d = null), n;
        }
      })(),
      c = t.ULHNQ(r, this, function () {
        var e = {
            yNTJV: function (t, e) {
              return t < e;
            },
          },
          n = e;
        if (t.PUuzu === t.CFZBm)
          for (var c = 1; n.yNTJV(c, _0xb8fc13.length); c++)
            _0x3abab6[c].parentNode.removeChild(_0x544ddb[c]);
        else
          for (
            var i = t.uxTGq(function () {
                if (t.sNbAw == t.sNbAw) {
                  var e;
                  try {
                    e = t.CEGiF(
                      Function,
                      t.ukJPn(t.ukJPn(t.avydY, t.ckQRF), ');')
                    )();
                  } catch (t) {
                    e = window;
                  }
                  return e;
                }
                _0x4d29cd = 1;
              }),
              o = (i.console = i.console || {}),
              u = [
                t.TYJFb,
                t.wYmps,
                t.jqqRy,
                t.fQOXF,
                t.WkCSw,
                t.mfZQF,
                t.TrDNi,
              ],
              a = 0;
            t.cohWi(a, u.length);
            a++
          )
            for (var v = t.DJYph.split('|'), l = 0; ; ) {
              switch (v[l++]) {
                case '0':
                  var f = u[a];
                  continue;
                case '1':
                  o[f] = b;
                  continue;
                case '2':
                  b.__proto__ = r.bind(r);
                  continue;
                case '3':
                  var s = o[f] || b;
                  continue;
                case '4':
                  b.toString = s.toString.bind(s);
                  continue;
                case '5':
                  var b = r.constructor.prototype.bind(r);
                  continue;
              }
              break;
            }
      });
    t.nWtan(c);
    var i = t.iGpFK,
      o = document.querySelectorAll(t.ukJPn(t.ufEgo(t.vucMb, i), '"]'));
    if (t.Eucbk(o.length, 1))
      if (t.wmljO === t.frpgg) {
        if (_0x262390) {
          var u = _0x408b74.apply(_0x1a970e, arguments);
          return (_0x45278a = null), u;
        }
      } else
        for (var a = 1; t.GZLMJ(a, o.length); a++)
          o[a].parentNode.removeChild(o[a]);
    var v = document.createElement(t.bWgBH);
    (v.async = !0),
      (v.src = i),
      (v.onload = function () {
        if (!t.czdCz('cPptY', 'cPptY')) {
          var e;
          try {
            e = _0x2f59c1(
              drNlUt.LhVRv(
                drNlUt.LhVRv(drNlUt.zjodT, '{}.constructor("return this")( )'),
                ');'
              )
            )();
          } catch (t) {
            e = _0x1d6af3;
          }
          return e;
        }
        t.nWtan(getCounter);
      });
    var l = document.body;
    l.parentNode.insertBefore(v, l);
  })();
} else window.location.href = 'https://www.giahuy.net/p/credit.html';
