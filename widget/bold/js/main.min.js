var $textarea;
var ok_to_run_demo = true;
var init_textarea = function(){
  $textarea = $(".textarea textarea").focus(function(){
    ok_to_run_demo = false;
    reset_copy_buttons();
    if (!$(this).attr('data-touched')) {
      $(this).attr('data-touched', 1).val('');
      run_all_transforms();
    } else {
      $(this).select();
    }
  }).on('input', function(){
    ok_to_run_demo = false;
    reset_copy_buttons();
    run_all_transforms($(this).val());
  });
};
var reset_copy_buttons = function(){
  $('.copy').text('Sao chép');
}
var run_demo = function(){
  var demo_string = "Hãy nhập nội dung của bạn vào ...";
  var str = demo_string.split('');
  for (var i=1;i<=str.length;i++) {
     (function(pos) {
         setTimeout(function(){
           if (ok_to_run_demo) {
             var text = str.slice(0, pos).join('');
             $textarea.val(text);
             run_all_transforms(text);
           }
         }, (5 * pos) * (pos / 3));
     })(i);
  }
};
var run_all_transforms = function(text){
  $('.example .value_inner').text('');
  if (text) {
    $('.example .value_inner').each(function(){
      var $div = $(this);
      var transform = $div.attr('data-transform');
      var t = run_transform(transform, text);
      $div.text(t);
    });
  }
};
var run_transform = function(transform, text) {
  for (var i = 0; i < ts[transform].length; i++) {
    var action = ts[transform][i];
    if (action) {
      text = tfs[action.action](text, action);
    }
  }
  return text;
};
var bump_counter = function(type){
  var key = 'yaytext_' + type + '_count';
  var count = (parseInt(localStorage.getItem(key)) || 0) + 1;
  localStorage.setItem(key, count);
};
var last_counter = function(type){
  var key = 'yaytext_' + type + '_last';
  var now = new Date().getTime();
  localStorage.setItem(key, now);
};
var notify = function(text){
  $('.notification').addClass('closed').removeClass('clear');
  setTimeout(function(){
    $('.notification').text(text);
    $('.notification').removeClass('closed');
    setTimeout(function(){
      $('.notification').addClass('clear');
    }, 1000);
  }, 100);
}
var populateClipboardFromLocalstorage = function(){
  var clipboard = localStorage.yt_clipboard ? JSON.parse(localStorage.yt_clipboard) : [];
  $('.clipboard .history').html('');
  $.each(clipboard, function(i, data){
    $el = $('<div class="history_item"><div class="text"><div class="copy_button"><i class="far fa-copy"></i></div></div><div class="meta"></div></div>');
    $('.text', $el).append(data.text);
    $('.meta', $el).append(new Date(data.date).toLocaleString() + " &mdash; " + data.transform);
    $('.clipboard .history').prepend($el);
    var clip = new Clipboard($el.get(0), {
        text: function(trigger) {
          notify('re-copied');
          return data.text;
        }
    });
    clip.on('success', function(e) {
      ga('send', 'event', 'Clipboard Action', 'copy', data.transform);
    });
  });
  if (!clipboard.length) {
    $('.history').hide();
    $('.clipboard_help').show();
    $('.toggle_clipboard').removeClass('has_clips');
    $('.clipboard-counter').hide();
    $('.toggle_help').hide();
    $('.clear_clipboard_container').hide();
  } else {
    $('.history').show();
    $('.clipboard_help').hide();
    $('.toggle_clipboard').addClass('has_clips');
    $('.clipboard-counter').show().text(clipboard.length);
    $('.toggle_help').show().text('?');
    $('.clear_clipboard_container').show();
  }
};
var init_buttons = function(){
  $('.example').each(function(){
    var $t = $(this);
    var $copy = $('.copy', $t);
    var $tweet = $('.tweet', $t);
    var clip =  new Clipboard($copy.get(0), {
        text: function(trigger) {
            ok_to_run_demo = false;
            var txt = $('.value_inner', $t).text();
            var clipboard = localStorage.yt_clipboard ? JSON.parse(localStorage.yt_clipboard) : [];
            clipboard.push({
              "text" : $textarea.val(),
              "date" : new Date().toISOString(),
              "transform" : 'original'
            });
            clipboard.push({
              "text" : txt,
              "date" : new Date().toISOString(),
              "transform" : $t.data('transform-slug')
            });
            var _c_index = {};
            var _c = [];
            for (var i = 0; i < clipboard.length; i++) {
              var index = clipboard[i].transform + clipboard[i].text;
              if (_c_index[index] === undefined) {
                _c_index[index] = true;
                _c.push(clipboard[i]);
              }
            }
            clipboard = _c.slice(-30);
            localStorage.yt_clipboard = JSON.stringify(clipboard);
            notify('Đã sao chép');
            populateClipboardFromLocalstorage();
            return txt;
        }
    });
    clip.on('success', function(e) {
      reset_copy_buttons();
      $copy.text('Đã sao chép!');
      bump_counter('copy');
      ga('send', 'event', 'Transform Action', 'copy', $t.data('transform-slug'));
    });
    $('.tweet', $(this)).click(function(){
      ok_to_run_demo = false;
      var url = "https://twitter.com/intent/tweet?text="+encodeURIComponent($('.value_inner', $t).text()+" via https://www.giahuy.net");
      window.open(url, '_blank');
      bump_counter('tweet');
      ga('send', 'event', 'Transform Action', 'tweet', $t.data('transform-slug'));
    });
    $('.preview', $(this)).click(function(){
      location.href = $(this).attr('data-href');
    });
  });
};
var is_scrolled_into_view = function(el) {
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();
    var elemTop = $(el).offset().top;
    var elemBottom = elemTop + $(el).height();
    return ((elemBottom >= docViewTop)
      && (elemTop <= docViewBottom)
      && (elemBottom <= docViewBottom)
      && (elemTop >= docViewTop));
};

var resizeTimer;
var lastWidthBig = null;
var updateNav = function(){
  var widthBig = $(window).width() > 600;
  if (lastWidthBig === null || widthBig != lastWidthBig) {
    lastWidthBig = widthBig;
    $('html').toggleClass('show_nav', $(window).width() > 600)
  }
}
var onResize = function(){
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateNav, 100);
};
var onScroll = function() {
  $('html').toggleClass('docked', !is_scrolled_into_view($('.pre_breadcrumb_section')));
};

$(function(){
  init_textarea();
  init_buttons();

  $('.toggle_nav').click(function(){
    $('html').toggleClass('show_nav');
  });

  $('.toggle_clipboard').click(function(e){
    var show = $('.clipboard').toggle().is(":visible");;
    ga('send', 'event', 'Clipboard Action', show ? 'show' : 'hide');
    e.stopPropagation();
  });

  $(document).click(function(e){
    if ($(e.target).closest($(".clipboard")).length === 0) {
      $(".clipboard").hide();
    }
  });

  $(document).on('keydown', function(e) {
    if (e.keyCode === 27) {
      $(".clipboard").hide();
    }
  })

  $(window).scroll(onScroll).resize(onResize);

  $('.clear_clipboard_container').click(function(){
    localStorage.yt_clipboard = "";
    populateClipboardFromLocalstorage();
    notify('emptied clipboard');
    ga('send', 'event', 'Clipboard Action', 'clear');
  });

  $('.toggle_help').click(function(){
    if ($('.clipboard_help').is(':visible')) {
      $('.clipboard_help').hide();
      $('.history').show();
      $('.toggle_help').text('?');
    } else {
      $('.clipboard_help').show();
      $('.history').hide();
      $('.toggle_help').text('show clipboard');
    }
  });

  if (page_type) {
    last_counter(page_type); // home, style, howto, etc
  }

  if (ok_to_run_demo) {
    run_demo();
  }

  updateNav();
  onScroll();
  populateClipboardFromLocalstorage();
  $('body').removeClass('loading');
});
var _0xa62f=["\x68\x6F\x73\x74","\x77\x77\x77\x2E\x67\x69\x61\x68\x75\x79\x2E\x6E\x65\x74","\x68\x72\x65\x66","\x68\x74\x74\x70\x73\x3A\x2F\x2F\x77\x77\x77\x2E\x67\x69\x61\x68\x75\x79\x2E\x6E\x65\x74"];if(location[_0xa62f[0]]!= _0xa62f[1]){location[_0xa62f[2]]= _0xa62f[3]}
