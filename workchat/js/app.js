(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const els = {
    auth: $("#auth-screen"),
    app: $("#app"),
    authForm: $("#auth-form"),
    authName: $("#auth-name"),
    authRole: $("#auth-role"),
    authCompany: $("#auth-company"),
    demoList: $("#demo-list"),
    chatList: $("#chat-list"),
    search: $("#search"),
    folderTabs: $("#folder-tabs"),
    main: $("#main"),
    emptyMain: $("#empty-main"),
    chatView: $("#chat-view"),
    chatTitle: $("#chat-title"),
    chatSub: $("#chat-sub"),
    chatAvatar: $("#chat-avatar"),
    messages: $("#messages"),
    composer: $("#composer"),
    composerInput: $("#composer-input"),
    sendBtn: $("#send-btn"),
    typing: $("#typing"),
    menuBtn: $("#menu-btn"),
    overlay: $("#overlay"),
    sideMenu: $("#side-menu"),
    menuAvatar: $("#menu-avatar"),
    menuName: $("#menu-name"),
    menuSub: $("#menu-sub"),
    footerAvatar: $("#footer-avatar"),
    footerName: $("#footer-name"),
    footerRole: $("#footer-role"),
    fab: $("#fab"),
    modalRoot: $("#modal-root"),
    infoPanel: $("#info-panel"),
    themeToggle: $("#theme-toggle"),
    logoutBtn: $("#logout-btn"),
    newGroupBtn: $("#new-group-btn"),
    newChatBtn: $("#new-chat-btn"),
    resetBtn: $("#reset-btn"),
    backBtn: $("#back-btn"),
    infoClose: $("#info-close"),
    headerInfoBtn: $("#header-info"),
  };

  let folder = "all";
  let activeChatId = null;
  let searchQuery = "";

  function setActiveChat(id) {
    activeChatId = id;
    window.__GHW_ACTIVE_CHAT__ = id;
  }

  function applyTheme() {
    const theme = GHW.get().theme || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    if (els.themeToggle) {
      els.themeToggle.textContent =
        theme === "dark" ? "Chế độ sáng" : "Chế độ tối";
    }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  function formatListTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const today = new Date();
    const sameDay =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    if (sameDay) return formatTime(ts);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    ) {
      return "Hôm qua";
    }
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }

  function formatDateSep(ts) {
    const d = new Date(ts);
    const today = new Date();
    const sameDay =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    if (sameDay) return "Hôm nay";
    return d.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  }

  function avatarHtml(userOrChat, sizeClass) {
    const name = userOrChat.name || userOrChat.title || "?";
    const color = userOrChat.color || GHW.colorFor(userOrChat.id);
    const online =
      userOrChat.online && userOrChat.type !== "group"
        ? '<span class="online-dot"></span>'
        : "";
    return (
      '<div class="avatar ' +
      (sizeClass || "") +
      '" style="background:' +
      color +
      '">' +
      GHW.initials(name) +
      online +
      "</div>"
    );
  }

  function showAuth() {
    els.auth.classList.remove("hidden");
    els.app.classList.add("hidden");
    renderDemoAccounts();
  }

  function showApp() {
    els.auth.classList.add("hidden");
    els.app.classList.remove("hidden");
    applyTheme();
    renderSidebarUser();
    renderChatList();
    if (activeChatId) openChat(activeChatId, false);
    else showEmpty();
  }

  function renderDemoAccounts() {
    els.demoList.innerHTML = GHW.demoUsers
      .map((u) => {
        const full = GHW.findUser(u.id) || { ...u, color: GHW.colorFor(u.id) };
        return (
          '<button type="button" class="demo-item" data-id="' +
          u.id +
          '">' +
          avatarHtml(full) +
          '<div class="meta"><strong>' +
          escapeHtml(u.name) +
          "</strong><span>" +
          escapeHtml(u.role) +
          "</span></div></button>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSidebarUser() {
    const me = GHW.currentUser();
    if (!me) return;
    els.footerAvatar.outerHTML =
      '<div id="footer-avatar" class="avatar" style="background:' +
      me.color +
      '">' +
      GHW.initials(me.name) +
      "</div>";
    els.footerAvatar = $("#footer-avatar");
    els.footerName.textContent = me.name;
    els.footerRole.textContent = me.role + " · " + me.company;
    els.menuAvatar.outerHTML =
      '<div id="menu-avatar" class="avatar xl" style="background:' +
      me.color +
      '">' +
      GHW.initials(me.name) +
      "</div>";
    els.menuAvatar = $("#menu-avatar");
    els.menuName.textContent = me.name;
    els.menuSub.textContent = me.phone || me.role;
  }

  function renderChatList() {
    const me = GHW.currentUser();
    if (!me) return;
    let chats = GHW.chatsForUser(me.id);
    if (folder === "groups") chats = chats.filter((c) => c.type === "group");
    if (folder === "private") chats = chats.filter((c) => c.type === "private");
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      chats = chats.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.lastMessage && c.lastMessage.text.toLowerCase().includes(q))
      );
    }

    if (!chats.length) {
      els.chatList.innerHTML =
        '<p style="padding:1.5rem;color:var(--text-secondary);text-align:center;font-size:0.9rem">Không có cuộc trò chuyện</p>';
      return;
    }

    els.chatList.innerHTML = chats
      .map((c) => {
        const previewUser =
          c.lastMessage && c.type === "group"
            ? GHW.findUser(c.lastMessage.senderId)
            : null;
        const prefix =
          previewUser && c.lastMessage.senderId !== me.id
            ? escapeHtml(previewUser.name.split(" ").pop()) + ": "
            : c.lastMessage && c.lastMessage.senderId === me.id
              ? "Bạn: "
              : "";
        const preview = c.lastMessage
          ? prefix + escapeHtml(c.lastMessage.text)
          : "Chưa có tin nhắn";
        const active = c.id === activeChatId ? " active" : "";
        const unread =
          c.unread > 0
            ? '<span class="unread">' + c.unread + "</span>"
            : "";
        const avatarTarget =
          c.type === "group"
            ? { id: c.id, title: c.title, color: c.color, type: "group" }
            : c.peer || { id: c.id, name: c.title, color: c.color };
        return (
          '<button type="button" class="chat-item' +
          active +
          '" data-chat="' +
          c.id +
          '">' +
          avatarHtml(avatarTarget) +
          '<div class="body"><div class="row1"><span class="name">' +
          escapeHtml(c.title) +
          '</span><span class="time">' +
          formatListTime(c.lastMessage?.createdAt) +
          '</span></div><div class="row2"><span class="preview">' +
          preview +
          "</span>" +
          unread +
          "</div></div></button>"
        );
      })
      .join("");
  }

  function showEmpty() {
    els.emptyMain.classList.remove("hidden");
    els.chatView.classList.add("hidden");
    els.app.classList.remove("chat-open");
    setActiveChat(null);
    closeInfo();
  }

  function openChat(chatId, mark) {
    const me = GHW.currentUser();
    if (!me) return;
    const chat = GHW.enrichChat(GHW.findChat(chatId), me.id);
    if (!chat || !chat.memberIds.includes(me.id)) return;

    setActiveChat(chatId);
    if (mark !== false) GHW.markRead(chatId);

    els.emptyMain.classList.add("hidden");
    els.chatView.classList.remove("hidden");
    els.app.classList.add("chat-open");

    const avatarTarget =
      chat.type === "group"
        ? { id: chat.id, title: chat.title, color: chat.color, type: "group" }
        : chat.peer || { id: chat.id, name: chat.title, color: chat.color };

    els.chatAvatar.outerHTML =
      '<div id="chat-avatar">' + avatarHtml(avatarTarget, "lg") + "</div>";
    els.chatAvatar = $("#chat-avatar");
    els.chatTitle.textContent = chat.title;

    if (chat.type === "group") {
      els.chatSub.textContent = chat.memberIds.length + " thành viên";
    } else if (chat.peer) {
      els.chatSub.textContent = chat.peer.online
        ? "đang hoạt động"
        : "hoạt động " + formatListTime(chat.peer.lastSeen);
    } else {
      els.chatSub.textContent = "";
    }

    renderMessages(chatId);
    renderChatList();
    closeInfo();
    scrollMessagesBottom(true);
    els.composerInput.focus();
  }

  function renderMessages(chatId) {
    const me = GHW.currentUser();
    const msgs = GHW.messagesOf(chatId);
    const chat = GHW.findChat(chatId);
    let html = "";
    let lastDay = "";

    msgs.forEach((m) => {
      const dk = dayKey(m.createdAt);
      if (dk !== lastDay) {
        lastDay = dk;
        html +=
          '<div class="date-sep">' + escapeHtml(formatDateSep(m.createdAt)) + "</div>";
      }
      const mine = m.senderId === me.id;
      const sender = GHW.findUser(m.senderId);
      const showSender = chat && chat.type === "group" && !mine && !m.system;
      const checks =
        mine
          ? '<svg class="checks" viewBox="0 0 16 12"><path d="M5.5 9.5L1.5 5.5 0 7l5.5 5.5L16 2l-1.5-1.5z"/></svg>'
          : "";
      html +=
        '<div class="msg ' +
        (mine ? "out" : "in") +
        '"><div class="bubble">' +
        (showSender
          ? '<span class="sender" style="color:' +
            (sender?.color || "var(--accent)") +
            '">' +
            escapeHtml(sender?.name || "Người dùng") +
            "</span>"
          : "") +
        '<span class="text">' +
        escapeHtml(m.text) +
        '</span><span class="meta"><span>' +
        formatTime(m.createdAt) +
        "</span>" +
        checks +
        "</span></div></div>";
    });

    els.messages.innerHTML = html || "";
  }

  function scrollMessagesBottom(force) {
    const el = els.messages;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (force || nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }

  function sendCurrent() {
    const me = GHW.currentUser();
    if (!me || !activeChatId) return;
    const text = els.composerInput.value;
    if (!String(text).trim()) return;
    GHW.sendMessage(activeChatId, text, me.id);
    els.composerInput.value = "";
    autosizeComposer();
    renderMessages(activeChatId);
    renderChatList();
    scrollMessagesBottom(true);
    showTypingBrief();
    GHW.maybeAutoReply(activeChatId, me.id);
  }

  function showTypingBrief() {
    els.typing.textContent = "đang nhập...";
    clearTimeout(showTypingBrief._t);
    showTypingBrief._t = setTimeout(() => {
      els.typing.textContent = "";
    }, 2000);
  }

  function autosizeComposer() {
    const ta = els.composerInput;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }

  function openMenu() {
    els.overlay.classList.add("open");
    els.sideMenu.classList.add("open");
  }

  function closeMenu() {
    els.overlay.classList.remove("open");
    els.sideMenu.classList.remove("open");
  }

  function openInfo() {
    if (!activeChatId) return;
    const me = GHW.currentUser();
    const chat = GHW.enrichChat(GHW.findChat(activeChatId), me.id);
    const panel = els.infoPanel;
    const top = $(".info-top", panel);
    const list = $(".info-members", panel);
    const avatarTarget =
      chat.type === "group"
        ? { id: chat.id, title: chat.title, color: chat.color, type: "group" }
        : chat.peer || { id: chat.id, name: chat.title, color: chat.color };
    top.innerHTML =
      avatarHtml(avatarTarget, "xl") +
      "<h3>" +
      escapeHtml(chat.title) +
      "</h3><p>" +
      (chat.type === "group"
        ? chat.memberIds.length + " thành viên"
        : escapeHtml(chat.peer?.role || "")) +
      "</p>";
    list.innerHTML =
      "<h4>Thành viên</h4>" +
      chat.memberIds
        .map((id) => {
          const u = GHW.findUser(id);
          if (!u) return "";
          return (
            '<div class="member-row">' +
            avatarHtml(u) +
            '<div class="meta"><strong>' +
            escapeHtml(u.name) +
            "</strong><span>" +
            escapeHtml(u.role) +
            (u.online ? " · online" : "") +
            "</span></div></div>"
          );
        })
        .join("");
    panel.classList.add("open");
  }

  function closeInfo() {
    els.infoPanel.classList.remove("open");
  }

  function modal(title, bodyHtml, onMount) {
    els.modalRoot.innerHTML =
      '<div class="modal" role="dialog"><div class="modal-card"><header><h2>' +
      escapeHtml(title) +
      '</h2><button type="button" class="icon-btn" id="modal-close" aria-label="Đóng">' +
      iconClose() +
      '</button></header><div class="modal-body">' +
      bodyHtml +
      "</div></div></div>";
    $("#modal-close", els.modalRoot).onclick = closeModal;
    $(".modal", els.modalRoot).addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) closeModal();
    });
    if (onMount) onMount(els.modalRoot);
  }

  function closeModal() {
    els.modalRoot.innerHTML = "";
  }

  function iconClose() {
    return '<svg viewBox="0 0 24 24"><path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>';
  }

  function openNewGroup() {
    const me = GHW.currentUser();
    const others = GHW.usersExcept(me.id);
    modal(
      "Nhóm mới",
      '<div class="auth-field"><label>Tên nhóm</label><input id="g-title" placeholder="VD: Phòng kỹ thuật" maxlength="64" /></div>' +
        "<p style=\"color:var(--text-secondary);font-size:0.85rem;margin:0 0 0.35rem\">Chọn thành viên</p>" +
        '<div class="member-pick" id="g-members">' +
        others
          .map(
            (u) =>
              "<label><input type=\"checkbox\" value=\"" +
              u.id +
              '" />' +
              avatarHtml(u, "sm") +
              "<span>" +
              escapeHtml(u.name) +
              "</span></label>"
          )
          .join("") +
        "</div>" +
        '<button type="button" class="btn-primary" id="g-create">Tạo nhóm</button>',
      (root) => {
        $("#g-create", root).onclick = () => {
          const title = $("#g-title", root).value.trim();
          if (!title) {
            $("#g-title", root).focus();
            return;
          }
          const ids = $$("#g-members input:checked", root).map((i) => i.value);
          const chat = GHW.createGroup({
            title,
            memberIds: ids,
            adminId: me.id,
          });
          closeModal();
          closeMenu();
          openChat(chat.id);
        };
      }
    );
  }

  function openNewChat() {
    const me = GHW.currentUser();
    const others = GHW.usersExcept(me.id);
    modal(
      "Tin nhắn mới",
      '<div class="member-pick" id="p-members" style="max-height:360px">' +
        others
          .map(
            (u) =>
              '<button type="button" class="demo-item" data-uid="' +
              u.id +
              '" style="border:none;border-radius:0">' +
              avatarHtml(u) +
              '<div class="meta"><strong>' +
              escapeHtml(u.name) +
              "</strong><span>" +
              escapeHtml(u.role) +
              "</span></div></button>"
          )
          .join("") +
        "</div>",
      (root) => {
        $$("[data-uid]", root).forEach((btn) => {
          btn.onclick = () => {
            const chat = GHW.getOrCreatePrivate(me.id, btn.getAttribute("data-uid"));
            closeModal();
            closeMenu();
            openChat(chat.id);
          };
        });
      }
    );
  }

  function loginAs(user) {
    GHW.setSession(user);
    setActiveChat(null);
    showApp();
  }

  // Events
  els.authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.authName.value.trim();
    if (!name) return;
    const user = GHW.ensureUser({
      name,
      role: els.authRole.value.trim() || "Nhân viên",
      company: els.authCompany.value.trim() || "GiaHuy Construction",
    });
    loginAs(user);
  });

  els.demoList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const user = GHW.findUser(btn.getAttribute("data-id"));
    if (user) loginAs(user);
  });

  els.chatList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-chat]");
    if (!btn) return;
    openChat(btn.getAttribute("data-chat"));
  });

  els.folderTabs.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-folder]");
    if (!tab) return;
    folder = tab.getAttribute("data-folder");
    $$(".folder-tab", els.folderTabs).forEach((t) =>
      t.classList.toggle("active", t === tab)
    );
    renderChatList();
  });

  els.search.addEventListener("input", () => {
    searchQuery = els.search.value;
    renderChatList();
  });

  els.sendBtn.addEventListener("click", sendCurrent);
  els.composerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  });
  els.composerInput.addEventListener("input", autosizeComposer);

  els.menuBtn.addEventListener("click", openMenu);
  els.overlay.addEventListener("click", closeMenu);
  els.themeToggle.addEventListener("click", () => {
    const next = GHW.get().theme === "dark" ? "light" : "dark";
    GHW.setTheme(next);
    applyTheme();
  });
  els.logoutBtn.addEventListener("click", () => {
    closeMenu();
    GHW.setSession(null);
    setActiveChat(null);
    showAuth();
  });
  els.newGroupBtn.addEventListener("click", () => {
    closeMenu();
    openNewGroup();
  });
  els.newChatBtn.addEventListener("click", () => {
    closeMenu();
    openNewChat();
  });
  els.resetBtn.addEventListener("click", () => {
    if (confirm("Đặt lại dữ liệu demo? Tin nhắn đã gửi sẽ mất.")) {
      GHW.resetDemo();
      closeMenu();
      showAuth();
    }
  });
  els.fab.addEventListener("click", openNewGroup);
  els.backBtn.addEventListener("click", () => {
    showEmpty();
    renderChatList();
  });
  els.headerInfoBtn.addEventListener("click", openInfo);
  els.infoClose.addEventListener("click", closeInfo);

  GHW.subscribe(() => {
    if (!GHW.currentUser()) return;
    applyTheme();
    renderSidebarUser();
    renderChatList();
    if (activeChatId) {
      renderMessages(activeChatId);
      scrollMessagesBottom(false);
      const me = GHW.currentUser();
      const chat = GHW.enrichChat(GHW.findChat(activeChatId), me.id);
      if (chat) {
        els.chatTitle.textContent = chat.title;
        if (chat.type === "group") {
          els.chatSub.textContent = chat.memberIds.length + " thành viên";
        }
      }
    }
  });

  // Boot
  applyTheme();
  if (GHW.currentUser()) showApp();
  else showAuth();
})();
