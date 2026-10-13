/**
 * GiaHuy Work — local store + multi-tab sync (BroadcastChannel)
 * Suitable for GitHub Pages static hosting.
 */
(function (global) {
  const KEY = "giahuy_work_v1";
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("giahuy_work")
      : null;

  const AVATAR_COLORS = [
    "#e17076",
    "#7bc862",
    "#e5ca3f",
    "#65aadd",
    "#ee7aae",
    "#6ec9cb",
    "#faa774",
    "#a695e7",
  ];

  function colorFor(id) {
    let h = 0;
    const s = String(id || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function initials(name) {
    const parts = String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Math.random().toString(36).slice(2, 9) +
      Date.now().toString(36).slice(-4)
    );
  }

  function now() {
    return Date.now();
  }

  const DEMO_USERS = [
    {
      id: "u_huy",
      name: "Nguyễn Gia Huy",
      role: "Quản lý dự án",
      company: "GiaHuy Construction",
      phone: "+84 90 000 0001",
    },
    {
      id: "u_lan",
      name: "Trần Thu Lan",
      role: "Kỹ sư kết cấu",
      company: "GiaHuy Construction",
      phone: "+84 90 000 0002",
    },
    {
      id: "u_minh",
      name: "Lê Văn Minh",
      role: "Giám sát công trường",
      company: "GiaHuy Construction",
      phone: "+84 90 000 0003",
    },
    {
      id: "u_hoa",
      name: "Phạm Thị Hoa",
      role: "Kế toán",
      company: "GiaHuy Construction",
      phone: "+84 90 000 0004",
    },
    {
      id: "u_duc",
      name: "Hoàng Đức",
      role: "Shop drawing",
      company: "GiaHuy Construction",
      phone: "+84 90 000 0005",
    },
  ];

  function seedMessages(chatId, items) {
    return items.map((m, i) => ({
      id: "m_seed_" + chatId + "_" + i,
      chatId,
      senderId: m.from,
      text: m.text,
      createdAt: now() - (items.length - i) * 3600000 - Math.random() * 600000,
      status: "read",
    }));
  }

  function buildSeed() {
    const users = DEMO_USERS.map((u) => ({
      ...u,
      color: colorFor(u.id),
      online: Math.random() > 0.4,
      lastSeen: now() - Math.floor(Math.random() * 86400000),
    }));

    const chats = [
      {
        id: "c_all",
        type: "group",
        title: "Công ty — Chung",
        memberIds: users.map((u) => u.id),
        adminIds: ["u_huy"],
        createdAt: now() - 86400000 * 30,
        pinned: true,
      },
      {
        id: "c_ketcau",
        type: "group",
        title: "Phòng Kết cấu",
        memberIds: ["u_huy", "u_lan", "u_duc"],
        adminIds: ["u_lan"],
        createdAt: now() - 86400000 * 20,
        pinned: false,
      },
      {
        id: "c_congtruong",
        type: "group",
        title: "Công trường Block A",
        memberIds: ["u_huy", "u_minh", "u_duc", "u_lan"],
        adminIds: ["u_minh"],
        createdAt: now() - 86400000 * 10,
        pinned: false,
      },
      {
        id: "c_ketoan",
        type: "group",
        title: "Kế toán & Nghiệm thu",
        memberIds: ["u_huy", "u_hoa", "u_minh"],
        adminIds: ["u_hoa"],
        createdAt: now() - 86400000 * 7,
        pinned: false,
      },
      {
        id: "c_dm_lan",
        type: "private",
        title: "",
        memberIds: ["u_huy", "u_lan"],
        adminIds: [],
        createdAt: now() - 86400000 * 5,
        pinned: false,
      },
      {
        id: "c_dm_minh",
        type: "private",
        title: "",
        memberIds: ["u_huy", "u_minh"],
        adminIds: [],
        createdAt: now() - 86400000 * 3,
        pinned: false,
      },
    ];

    const messages = [
      ...seedMessages("c_all", [
        { from: "u_huy", text: "Chào cả nhà, từ hôm nay dùng GiaHuy Work để trao đổi nội bộ." },
        { from: "u_lan", text: "Ok anh, nhóm kết cấu cũng vào đây luôn nhé." },
        { from: "u_minh", text: "Công trường Block A báo cáo tiến độ mỗi ngày trong nhóm riêng." },
        { from: "u_hoa", text: "Kế toán sẽ gửi biên bản nghiệm thu tại đây." },
        { from: "u_duc", text: "Shop drawing cập nhật xong sẽ ping nhóm Kết cấu." },
      ]),
      ...seedMessages("c_ketcau", [
        { from: "u_lan", text: "Mọi người check lại phương án thép sàn tầng 3." },
        { from: "u_duc", text: "Em đã xuất bản vẽ shop, link trong hub." },
        { from: "u_huy", text: "OK, chiều họp 15h chốt phương án." },
      ]),
      ...seedMessages("c_congtruong", [
        { from: "u_minh", text: "Sáng nay đổ bê tông trục A-B, xong 70%." },
        { from: "u_duc", text: "Chú Minh ơi, cần xác nhận kích thước lỗ chờ HVAC." },
        { from: "u_minh", text: "Đã đo lại, chiều gửi ảnh." },
      ]),
      ...seedMessages("c_ketoan", [
        { from: "u_hoa", text: "Đợt nghiệm thu tháng này cần biên bản ký trước thứ 6." },
        { from: "u_huy", text: "Ok chị, em nhắc giám sát." },
      ]),
      ...seedMessages("c_dm_lan", [
        { from: "u_lan", text: "Anh ơi, file thép dầm D3 đã cập nhật." },
        { from: "u_huy", text: "Cảm ơn Lan, anh xem ngay." },
      ]),
      ...seedMessages("c_dm_minh", [
        { from: "u_minh", text: "Anh Huy, cần thêm 2 thợ sắt chiều nay." },
        { from: "u_huy", text: "Được, anh gọi tổ 2 qua hỗ trợ." },
      ]),
    ];

    return {
      version: 1,
      company: "GiaHuy Construction",
      users,
      chats,
      messages,
      session: null,
      theme: "dark",
      unread: {},
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const seed = buildSeed();
        save(seed, false);
        return seed;
      }
      return JSON.parse(raw);
    } catch {
      const seed = buildSeed();
      save(seed, false);
      return seed;
    }
  }

  function save(state, broadcast) {
    localStorage.setItem(KEY, JSON.stringify(state));
    if (broadcast !== false && channel) {
      channel.postMessage({ type: "sync", at: now() });
    }
  }

  let state = load();
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  if (channel) {
    channel.onmessage = (ev) => {
      if (ev.data && ev.data.type === "sync") {
        state = load();
        emit();
      }
    };
  }

  window.addEventListener("storage", (ev) => {
    if (ev.key === KEY) {
      state = load();
      emit();
    }
  });

  function get() {
    return state;
  }

  function setSession(user) {
    state.session = user
      ? { userId: user.id, loggedAt: now() }
      : null;
    save(state);
    emit();
  }

  function currentUser() {
    if (!state.session) return null;
    return state.users.find((u) => u.id === state.session.userId) || null;
  }

  function setTheme(theme) {
    state.theme = theme === "light" ? "light" : "dark";
    save(state);
    emit();
  }

  function ensureUser(payload) {
    let user = state.users.find(
      (u) =>
        u.name.toLowerCase() === payload.name.trim().toLowerCase() &&
        u.company === (payload.company || state.company)
    );
    if (!user) {
      user = {
        id: uid("u"),
        name: payload.name.trim(),
        role: payload.role || "Nhân viên",
        company: payload.company || state.company,
        phone: payload.phone || "",
        color: colorFor(payload.name),
        online: true,
        lastSeen: now(),
      };
      state.users.push(user);
      // add to company-wide group
      const all = state.chats.find((c) => c.id === "c_all");
      if (all && !all.memberIds.includes(user.id)) {
        all.memberIds.push(user.id);
      }
      save(state);
    } else {
      user.online = true;
      user.lastSeen = now();
      save(state);
    }
    return user;
  }

  function chatsForUser(userId) {
    return state.chats
      .filter((c) => c.memberIds.includes(userId))
      .map((c) => enrichChat(c, userId))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt);
      });
  }

  function enrichChat(chat, userId) {
    const msgs = state.messages
      .filter((m) => m.chatId === chat.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    const last = msgs[msgs.length - 1] || null;
    let title = chat.title;
    let peer = null;
    if (chat.type === "private") {
      const otherId = chat.memberIds.find((id) => id !== userId) || chat.memberIds[0];
      peer = state.users.find((u) => u.id === otherId) || null;
      title = peer ? peer.name : "Cuộc trò chuyện";
    }
    return {
      ...chat,
      title,
      peer,
      lastMessage: last,
      unread: state.unread[chat.id] || 0,
      color: chat.type === "group" ? colorFor(chat.id) : peer?.color || colorFor(chat.id),
    };
  }

  function messagesOf(chatId) {
    return state.messages
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function sendMessage(chatId, text, senderId) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    const msg = {
      id: uid("m"),
      chatId,
      senderId,
      text: trimmed,
      createdAt: now(),
      status: "sent",
    };
    state.messages.push(msg);
    // mark unread for other members (simulated)
    const chat = state.chats.find((c) => c.id === chatId);
    if (chat) {
      // current user clears unread
      state.unread[chatId] = 0;
    }
    setTimeout(() => {
      const m = state.messages.find((x) => x.id === msg.id);
      if (m) {
        m.status = "delivered";
        save(state);
        emit();
      }
    }, 400);
    setTimeout(() => {
      const m = state.messages.find((x) => x.id === msg.id);
      if (m) {
        m.status = "read";
        save(state);
        emit();
      }
    }, 1200);
    save(state);
    emit();
    return msg;
  }

  function markRead(chatId) {
    state.unread[chatId] = 0;
    save(state);
    emit();
  }

  function bumpUnread(chatId, exceptUserId) {
    const me = currentUser();
    if (me && me.id === exceptUserId) return;
    state.unread[chatId] = (state.unread[chatId] || 0) + 1;
    save(state);
    emit();
  }

  function createGroup({ title, memberIds, adminId }) {
    const me = adminId;
    const members = Array.from(new Set([me, ...(memberIds || [])]));
    const chat = {
      id: uid("c"),
      type: "group",
      title: title.trim(),
      memberIds: members,
      adminIds: [me],
      createdAt: now(),
      pinned: false,
    };
    state.chats.push(chat);
    const sys = {
      id: uid("m"),
      chatId: chat.id,
      senderId: me,
      text: "đã tạo nhóm «" + chat.title + "»",
      createdAt: now(),
      status: "read",
      system: true,
    };
    state.messages.push(sys);
    save(state);
    emit();
    return chat;
  }

  function getOrCreatePrivate(userA, userB) {
    let chat = state.chats.find(
      (c) =>
        c.type === "private" &&
        c.memberIds.includes(userA) &&
        c.memberIds.includes(userB) &&
        c.memberIds.length === 2
    );
    if (!chat) {
      chat = {
        id: uid("c"),
        type: "private",
        title: "",
        memberIds: [userA, userB],
        adminIds: [],
        createdAt: now(),
        pinned: false,
      };
      state.chats.push(chat);
      save(state);
      emit();
    }
    return chat;
  }

  function resetDemo() {
    state = buildSeed();
    save(state);
    emit();
  }

  function usersExcept(userId) {
    return state.users.filter((u) => u.id !== userId);
  }

  function findUser(id) {
    return state.users.find((u) => u.id === id) || null;
  }

  function findChat(id) {
    return state.chats.find((c) => c.id === id) || null;
  }

  /** Lightweight auto-replies from demo colleagues for feel of live chat */
  const REPLY_POOL = [
    "Ok, mình nhận được rồi.",
    "Chiều họp nhé.",
    "Đang xử lý, xong sẽ báo.",
    "File đã cập nhật trên hub.",
    "Cảm ơn bạn!",
    "Mình check lại và phản hồi sau 15 phút.",
    "Đồng ý phương án này.",
    "Nhờ bạn gửi thêm ảnh hiện trường.",
  ];

  function maybeAutoReply(chatId, fromUserId) {
    const chat = findChat(chatId);
    if (!chat) return;
    const others = chat.memberIds.filter((id) => id !== fromUserId);
    if (!others.length) return;
    if (Math.random() > 0.45) return;
    const replyFrom = others[Math.floor(Math.random() * others.length)];
    const text = REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
    const delay = 1200 + Math.random() * 2500;
    setTimeout(() => {
      const msg = {
        id: uid("m"),
        chatId,
        senderId: replyFrom,
        text,
        createdAt: now(),
        status: "read",
      };
      state.messages.push(msg);
      const me = currentUser();
      if (me && me.id !== replyFrom) {
        // if user is viewing this chat, don't bump — UI decides; bump for now
        const active = global.__GHW_ACTIVE_CHAT__;
        if (active !== chatId) {
          state.unread[chatId] = (state.unread[chatId] || 0) + 1;
        }
      }
      save(state);
      emit();
    }, delay);
  }

  global.GHW = {
    get,
    subscribe,
    setSession,
    currentUser,
    setTheme,
    ensureUser,
    chatsForUser,
    enrichChat,
    messagesOf,
    sendMessage,
    markRead,
    bumpUnread,
    createGroup,
    getOrCreatePrivate,
    resetDemo,
    usersExcept,
    findUser,
    findChat,
    maybeAutoReply,
    demoUsers: DEMO_USERS,
    colorFor,
    initials,
    uid,
  };
})(window);
