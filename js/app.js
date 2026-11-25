/* ==========================================================================
   《陌上桑》互動影音公開觀課教室 - 主控邏輯 (app.js)
   ========================================================================== */

(function () {
  const DATA = window.MOSHANGSANG_DATA;
  const AUDIO = window.yuefuAudio;

  // ---------- 全域狀態 ----------
  const state = {
    theaterIndex: 0,
    theaterPlaying: false,
    voiceMode: "humor", // "humor" | "classic"
    danmakuOn: true,
    danmakuTimers: [],
    speedIndex: 1,
    speeds: [0.8, 1.0, 1.2],
    activeAct: "act1",
    showZhuyin: true,
    showTrans: true,
    showHumor: true,
    showTech: true,
    chatVisibleCount: 2,
    pollVotes: { real: 12, fake: 21 }, // 預設示範票數，課堂可點擊歸零或現場投票
    activeTrack: "design",
    storyNode: "start",
    collectedEndings: new Set(),
    quizIdx: 0,
    quizScore: 0,
    quizStreak: 0,
    quizAnswered: false,
    // Teacher tools
    timerSeconds: 180,
    timerRunning: false,
    timerHandle: null,
    pickedNumbers: []
  };

  // ---------- 工具函式 ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- 1. Header Scroll + Global BGM & Projector Mode ----------
  function initHeaderTools() {
    window.addEventListener("scroll", () => {
      $("#siteHeader").classList.toggle("scrolled", window.scrollY > 12);
    });

    const syncBgmButtons = (on) => {
      $("#btnBgmGlobal").classList.toggle("active", on);
      $("#btnBgmGlobal").textContent = on ? "🎵 古箏配樂：開" : "🎵 古箏配樂";
      $("#btnTheaterBgm").classList.toggle("active", on);
      $("#btnTheaterBgm").textContent = on ? "🎵 古箏BGM：開" : "🎵 古箏BGM：關";
    };

    $("#btnBgmGlobal").addEventListener("click", () => {
      const on = AUDIO.toggleBgm();
      syncBgmButtons(on);
    });

    $("#btnTheaterBgm").addEventListener("click", () => {
      const on = AUDIO.toggleBgm();
      syncBgmButtons(on);
    });

    $("#btnProjector").addEventListener("click", (e) => {
      document.body.classList.toggle("projector-mode");
      const active = document.body.classList.contains("projector-mode");
      e.currentTarget.classList.toggle("active", active);
      e.currentTarget.textContent = active ? "📽️ 投影大字：開" : "📽️ 投影大字";
    });

    // Quick Play from Hero
    const jumpAndPlay = () => {
      document.querySelector("#theater").scrollIntoView({ behavior: "smooth" });
      if (!AUDIO.bgmRunning) {
        const on = AUDIO.toggleBgm(true);
        syncBgmButtons(on);
      }
      startTheaterSequence(0);
    };
    $("#heroQuickPlay").addEventListener("click", jumpAndPlay);
    $("#heroStartTheater").addEventListener("click", (e) => {
      e.preventDefault();
      jumpAndPlay();
    });
  }

  // ---------- 2. 互動動態有聲劇場 ----------
  function renderTheaterTimeline() {
    const container = $("#theaterTimeline");
    container.innerHTML = DATA.theaterScenes.map((s, idx) => `
      <button class="scene-step-btn ${idx === state.theaterIndex ? "active" : ""}" data-scene-idx="${idx}">
        <span style="opacity:0.75;">第 ${idx + 1} 幕</span>
        <strong>${s.title}</strong>
      </button>
    `).join("");

    $$(".scene-step-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.sceneIdx);
        loadTheaterScene(idx, true);
      });
    });
  }

  function clearDanmakuTimers() {
    state.danmakuTimers.forEach((t) => clearTimeout(t));
    state.danmakuTimers = [];
  }

  function spawnDanmaku(text, topPercent = null) {
    if (!state.danmakuOn) return;
    const layer = $("#danmakuLayer");
    const el = document.createElement("div");
    el.className = "danmaku-item";
    el.textContent = text;
    el.style.top = (topPercent ?? (14 + Math.random() * 48)) + "%";
    el.style.animationDuration = (8.5 + Math.random() * 3.5) + "s";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 12500);
  }

  function fireSceneDanmaku(scene) {
    clearDanmakuTimers();
    if (!state.danmakuOn || !scene.danmaku) return;
    scene.danmaku.forEach((msg, i) => {
      const t = setTimeout(() => spawnDanmaku(msg, 16 + i * 11), i * 1200 + 250);
      state.danmakuTimers.push(t);
    });
  }

  function triggerSfx(name) {
    if (name === "gong") AUDIO.playGong();
    else if (name === "hooves") AUDIO.playHooves();
    else if (name === "glissando") AUDIO.playGlissando();
    else if (name === "boing") AUDIO.playComicBoing();
    else if (name === "chime") AUDIO.playSuccessChime();
  }

  function loadTheaterScene(idx, autoSpeak = false) {
    state.theaterIndex = (idx + DATA.theaterScenes.length) % DATA.theaterScenes.length;
    const scene = DATA.theaterScenes[state.theaterIndex];

    $("#theaterHeaderTitle").textContent = `${scene.actLabel}｜${scene.title}`;
    $("#theaterActBadge").textContent = scene.actLabel;
    $("#theaterImg").src = scene.image;
    $("#theaterSubOrig").textContent = scene.original;
    $("#theaterSubFunny").textContent = scene.funnySub;

    $$(".scene-step-btn").forEach((b, i) => b.classList.toggle("active", i === state.theaterIndex));

    fireSceneDanmaku(scene);

    if (autoSpeak) {
      triggerSfx(scene.sfx);
      const script = state.voiceMode === "humor" ? scene.narrationHumor : scene.narrationClassic;
      $("#theaterStage").classList.add("playing");
      AUDIO.speak(script, {
        rate: state.speeds[state.speedIndex],
        onEnd: () => {
          if (state.theaterPlaying) {
            if (state.theaterIndex < DATA.theaterScenes.length - 1) {
              setTimeout(() => {
                if (state.theaterPlaying) loadTheaterScene(state.theaterIndex + 1, true);
              }, 700);
            } else {
              stopTheater();
            }
          } else {
            $("#theaterStage").classList.remove("playing");
          }
        }
      });
    }
  }

  function startTheaterSequence(startIdx = state.theaterIndex) {
    state.theaterPlaying = true;
    $("#btnTheaterPlay").textContent = "⏸ 暫停劇場播放";
    $("#theaterStage").classList.add("playing");
    loadTheaterScene(startIdx, true);
  }

  function stopTheater() {
    state.theaterPlaying = false;
    AUDIO.stopSpeak();
    $("#btnTheaterPlay").textContent = "▶ 播放全劇（8幕連播）";
    $("#theaterStage").classList.remove("playing");
  }

  function initTheater() {
    renderTheaterTimeline();
    loadTheaterScene(0, false);

    $("#btnTheaterPlay").addEventListener("click", () => {
      if (state.theaterPlaying) {
        stopTheater();
      } else {
        startTheaterSequence(state.theaterIndex);
      }
    });

    $("#btnPrevScene").addEventListener("click", () => {
      loadTheaterScene(state.theaterIndex - 1, state.theaterPlaying);
    });

    $("#btnNextScene").addEventListener("click", () => {
      loadTheaterScene(state.theaterIndex + 1, state.theaterPlaying);
    });

    $$("[data-voice-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.voiceMode = btn.dataset.voiceMode;
        $$("[data-voice-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        if (state.theaterPlaying) {
          loadTheaterScene(state.theaterIndex, true);
        }
      });
    });

    $("#btnToggleDanmaku").addEventListener("click", (e) => {
      state.danmakuOn = !state.danmakuOn;
      e.currentTarget.classList.toggle("active", state.danmakuOn);
      e.currentTarget.textContent = state.danmakuOn ? "💬 課堂彈幕：開" : "💬 課堂彈幕：關";
      if (!state.danmakuOn) {
        clearDanmakuTimers();
        $("#danmakuLayer").innerHTML = "";
      } else {
        fireSceneDanmaku(DATA.theaterScenes[state.theaterIndex]);
      }
    });

    $("#btnFireDanmaku").addEventListener("click", () => {
      const bonus = [
        "👏 秦羅敷這波操作我給 100 分！",
        "🤣 五馬太守尷尬到腳趾摳出三房兩廳",
        "🔥 老師這節公開觀課超神！",
        "📌 筆記：但坐＝只因為、千餘騎念ㄐㄧˋ！",
        "✨ 漢代最帥氣的語言防身術！"
      ];
      const pick = bonus[Math.floor(Math.random() * bonus.length)];
      if (!state.danmakuOn) {
        state.danmakuOn = true;
        $("#btnToggleDanmaku").classList.add("active");
        $("#btnToggleDanmaku").textContent = "💬 課堂彈幕：開";
      }
      spawnDanmaku(pick);
      AUDIO.playSuccessChime();
    });

    $("#btnSpeedCycle").addEventListener("click", (e) => {
      state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
      const spd = state.speeds[state.speedIndex];
      AUDIO.speechRate = spd;
      e.currentTarget.textContent = `⚡ 語速：${spd.toFixed(1)}x`;
    });

    $$(".sfx-btn").forEach((btn) => {
      btn.addEventListener("click", () => triggerSfx(btn.dataset.sfx));
    });

    // 延伸外部影音資源卡片
    $("#externalMediaGrid").innerHTML = DATA.externalMedia.map((m) => `
      <div class="media-card">
        <div>
          <span class="pill pill-gold" style="margin-bottom:0.5rem;">${m.badge}</span>
          <h4>${m.title}</h4>
          <p>${m.desc}</p>
        </div>
        <a class="media-link" href="${m.url}" target="_blank" rel="noopener noreferrer">前往 YouTube 影音探索 ↗</a>
      </div>
    `).join("");
  }

  // ---------- 3. 全文三解幽默精解 & 專屬互動模組 ----------
  function showVocabToast(key) {
    const item = DATA.vocab[key];
    if (!item) return;
    $("#vtWord").textContent = `${item.word}（${item.zhuyin}）${item.trap ? " ⚠️ 段考陷阱" : ""}`;
    $("#vtMeaning").textContent = `釋義：${item.meaning}`;
    $("#vtTip").textContent = item.tip;
    $("#vocabToast").classList.add("show");
    AUDIO.pluckString(587.33, 0.5, 0.16);
  }

  function renderVerseCard(v) {
    return `
      <article class="verse-card" data-verse-id="${v.id}">
        <div class="verse-top">
          <div class="verse-original">${v.html}</div>
          <button class="verse-read-btn" data-read-raw="${v.raw}" data-card-id="${v.id}">🔊 朗讀</button>
        </div>
        <div class="verse-layers">
          ${state.showTrans ? `<div class="layer-box layer-trans"><span class="layer-tag">💬 精準語譯</span>${v.trans}</div>` : ""}
          ${state.showHumor ? `<div class="layer-box layer-humor"><span class="layer-tag">🤣 幽默梗翻譯</span>${v.humor}</div>` : ""}
          ${state.showTech ? `<div class="layer-box layer-tech"><span class="layer-tag">🎯 寫作技法</span>${v.tech}</div>` : ""}
        </div>
      </article>
    `;
  }

  function renderAct1Module() {
    return `
      <div class="special-module">
        <div class="module-head">
          <div>
            <span class="pill pill-purple">👗 第一解圖文彩蛋</span>
            <h3 style="margin:0.35rem 0 0;">羅敷漢代高訂 OOTD 裝備開箱</h3>
          </div>
          <span style="font-size:0.84rem; color:var(--ink-muted);">點擊各件單品，看看漢代採桑女穿搭含金量！</span>
        </div>
        <div class="ootd-grid">
          ${DATA.ootdItems.map((it, i) => `
            <div class="ootd-card ${i === 0 ? "selected" : ""}" data-ootd-idx="${i}">
              <div class="ootd-icon">${it.icon}</div>
              <h4>${it.name}</h4>
              <p style="margin:0; font-size:0.86rem; color:var(--ink-body);">${it.desc}</p>
              <span class="ootd-modern">${it.modern}</span>
            </div>
          `).join("")}
        </div>

        <div class="module-head" style="margin-top:2rem;">
          <div>
            <span class="pill pill-red">📡 側面烘托儀表板</span>
            <h3 style="margin:0.35rem 0 0;">路人集體降智現場：暈船指數實測</h3>
          </div>
        </div>
        <div class="reaction-grid">
          ${DATA.reactions.map((r) => `
            <div class="reaction-card">
              <strong>${r.role}</strong>
              <div style="font-family:var(--font-serif); color:var(--vermilion); font-weight:800; margin:0.2rem 0;">「${r.quote}」</div>
              <p style="font-size:0.84rem; margin:0.25rem 0;">${r.action}</p>
              <div class="stun-meter"><div class="stun-fill" style="width:${r.stun}%"></div></div>
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--ink-muted);">
                <span>降智指數</span><strong>${r.stun}%</strong>
              </div>
              <p style="font-size:0.8rem; color:var(--jade-deep); font-weight:700; margin:0.45rem 0 0;">💬 ${r.comment}</p>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderAct2Module() {
    const visibleMsgs = DATA.chatScript.slice(0, state.chatVisibleCount);
    const hasMore = state.chatVisibleCount < DATA.chatScript.length;
    return `
      <div class="special-module">
        <div class="module-head">
          <div>
            <span class="pill pill-red">📱 第二解爆笑劇場</span>
            <h3 style="margin:0.35rem 0 0;">漢代 LINE 現場直擊：五馬太守搭訕翻車群組</h3>
          </div>
          <span style="font-size:0.84rem; color:var(--ink-muted);">課堂點擊「下一則訊息」逐步揭曉翻車名場面！</span>
        </div>

        <div class="chat-phone">
          <div class="chat-header">
            <span>💬 城南桑園即時群組 (3)</span>
            <span style="font-size:0.78rem; color:#E8BE67;">${state.chatVisibleCount} / ${DATA.chatScript.length} 則訊息</span>
          </div>
          <div class="chat-body" id="chatBody">
            ${visibleMsgs.map((m) => `
              <div class="chat-msg ${m.side}">
                <div class="chat-avatar">${m.avatar}</div>
                <div class="chat-bubble-wrap">
                  <div class="chat-name">${m.name}</div>
                  <div class="chat-bubble">
                    <span class="orig">${m.orig}</span>
                    <small style="opacity:0.78;">${m.modern}</small>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="chat-footer">
            <button class="tool-btn" id="btnChatReset">↺ 重頭重播</button>
            <button class="btn btn-primary" id="btnChatNext" style="padding:0.5rem 1.1rem; font-size:0.88rem;" ${hasMore ? "" : "disabled"}>
              ${hasMore ? "📩 接收下一則對話" : "✅ 太守已社會性死亡（已讀不回）"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderAct3Module() {
    const total = Math.max(1, state.pollVotes.real + state.pollVotes.fake);
    const realPct = Math.round((state.pollVotes.real / total) * 100);
    const fakePct = 100 - realPct;
    return `
      <div class="special-module">
        <div class="module-head">
          <div>
            <span class="pill pill-gold">👑 第三解凡爾賽開箱</span>
            <h3 style="margin:0.35rem 0 0;">傳說中「霸總夫婿」神級升遷履歷表</h3>
          </div>
          <span style="font-size:0.84rem; color:var(--ink-muted);">層遞修辭：15 → 20 → 30 → 40 歲一路開掛！</span>
        </div>

        <div class="career-timeline">
          <div class="career-node">
            <span class="career-age">15 歲</span>
            <h4>府小史</h4>
            <p>別人還在讀國中，他已進郡府大廠當實習菁英！</p>
          </div>
          <div class="career-node">
            <span class="career-age">20 歲</span>
            <h4>朝大夫</h4>
            <p>大學都還沒畢業年齡，直接空降朝廷中央高管（ㄉㄚˋ ㄈㄨ）！</p>
          </div>
          <div class="career-node">
            <span class="career-age">30 歲</span>
            <h4>侍中郎</h4>
            <p>三十而立，升任皇帝貼身近臣，真正的核心權力圈紅人！</p>
          </div>
          <div class="career-node" style="border-color:var(--vermilion); background:var(--vermilion-soft);">
            <span class="career-age" style="background:var(--vermilion);">40 歲</span>
            <h4>專城居</h4>
            <p>獨自掌管一座大城的超級 CEO，官階氣場把五馬太守按在地上摩擦！</p>
          </div>
        </div>

        <div class="poll-box">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span class="pill pill-gold">🗳️ 公開觀課全班即時辯論投票</span>
              <h4 style="margin-top:0.45rem; font-size:1.2rem;">千古懸案：羅敷口中的 40 歲霸總老公，到底是真的還是臨時編的？</h4>
            </div>
            <button class="dark-chip" id="btnResetPoll">↺ 票數歸零（現場重投）</button>
          </div>

          <div class="poll-options">
            <button class="poll-btn" id="voteRealBtn">
              <strong>💍 派別 A：已婚真愛護夫派（點擊 +1 票）</strong>
              <p style="margin:0.3rem 0 0; font-size:0.84rem; opacity:0.9;">古代確實有少女嫁高官，羅敷只是驕傲介紹真實老公讓太守知難而退！</p>
              <div class="poll-bar-bg"><div class="poll-bar-fill" style="width:${realPct}%"></div></div>
              <div style="margin-top:0.35rem; font-size:0.84rem;">目前 <strong>${state.pollVotes.real} 票（${realPct}%）</strong></div>
            </button>

            <button class="poll-btn" id="voteFakeBtn">
              <strong>🧠 派別 B：單身急智嘴砲編劇派（點擊 +1 票）</strong>
              <p style="margin:0.3rem 0 0; font-size:0.84rem; opacity:0.9;">她才 17 歲還在採桑，老公卻 40 歲專城居＋千萬名劍？絕對是現場即興編劇嚇退色狼！</p>
              <div class="poll-bar-bg"><div class="poll-bar-fill" style="width:${fakePct}%"></div></div>
              <div style="margin-top:0.35rem; font-size:0.84rem;">目前 <strong>${state.pollVotes.fake} 票（${fakePct}%）</strong></div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderDecoder() {
    const container = $("#decoderContent");
    container.classList.toggle("hide-zhuyin", !state.showZhuyin);

    if (state.activeAct === "all") {
      container.innerHTML = DATA.acts.map((act) => `
        <div style="margin-bottom:2rem;">
          <h3 style="color:var(--jade-deep); border-bottom:2px solid var(--jade-light); padding-bottom:0.4rem;">${act.title}</h3>
          <div class="verse-list">
            ${act.verses.map(renderVerseCard).join("")}
          </div>
        </div>
      `).join("");
    } else {
      const act = DATA.acts.find((a) => a.id === state.activeAct);
      let extraHtml = "";
      if (act.id === "act1") extraHtml = renderAct1Module();
      if (act.id === "act2") extraHtml = renderAct2Module();
      if (act.id === "act3") extraHtml = renderAct3Module();

      container.innerHTML = `
        <div class="act-banner">
          <div>
            <div class="section-kicker" style="margin-bottom:0.3rem;">${act.kicker}</div>
            <h3 style="font-size:1.45rem; margin-bottom:0.5rem;">${act.title}</h3>
            <p style="margin:0; color:var(--ink-body);">${act.summary}</p>
          </div>
          <div class="act-banner-img">
            <img src="${act.image}" alt="${act.title}" />
          </div>
        </div>
        <div class="verse-list">
          ${act.verses.map(renderVerseCard).join("")}
        </div>
        ${extraHtml}
      `;
    }

    bindDecoderEvents();
  }

  function bindDecoderEvents() {
    // 點擊難字看考點
    $$(".vocab-word").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showVocabToast(el.dataset.vocab);
      });
    });

    // 單句朗讀
    $$(".verse-read-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.dataset.readRaw;
        const cardId = btn.dataset.cardId;
        $$(".verse-card").forEach((c) => c.classList.remove("speaking"));
        const card = document.querySelector(`[data-verse-id="${cardId}"]`);
        if (card) card.classList.add("speaking");
        AUDIO.speak(raw, {
          onEnd: () => card && card.classList.remove("speaking")
        });
      });
    });

    // Act 1 OOTD cards
    $$(".ootd-card").forEach((card) => {
      card.addEventListener("click", () => {
        $$(".ootd-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        AUDIO.pluckString(659.25, 0.5, 0.16);
      });
    });

    // Act 2 Chat simulator
    const btnChatNext = $("#btnChatNext");
    if (btnChatNext) {
      btnChatNext.addEventListener("click", () => {
        if (state.chatVisibleCount < DATA.chatScript.length) {
          state.chatVisibleCount++;
          if (state.chatVisibleCount === 6) AUDIO.playGong();
          else AUDIO.pluckString(587.33, 0.4, 0.14);
          renderDecoder();
          const body = $("#chatBody");
          if (body) body.scrollTop = body.scrollHeight;
        }
      });
    }
    const btnChatReset = $("#btnChatReset");
    if (btnChatReset) {
      btnChatReset.addEventListener("click", () => {
        state.chatVisibleCount = 1;
        renderDecoder();
      });
    }

    // Act 3 Poll
    const voteReal = $("#voteRealBtn");
    const voteFake = $("#voteFakeBtn");
    const resetPoll = $("#btnResetPoll");
    if (voteReal) {
      voteReal.addEventListener("click", () => {
        state.pollVotes.real++;
        AUDIO.playSuccessChime();
        renderDecoder();
      });
    }
    if (voteFake) {
      voteFake.addEventListener("click", () => {
        state.pollVotes.fake++;
        AUDIO.playSuccessChime();
        renderDecoder();
      });
    }
    if (resetPoll) {
      resetPoll.addEventListener("click", () => {
        state.pollVotes.real = 0;
        state.pollVotes.fake = 0;
        renderDecoder();
      });
    }
  }

  function initDecoder() {
    $$("#actTabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeAct = btn.dataset.act;
        $$("#actTabs .tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        renderDecoder();
      });
    });

    const wireToggle = (id, key) => {
      $(id).addEventListener("click", (e) => {
        state[key] = !state[key];
        e.currentTarget.classList.toggle("active", state[key]);
        renderDecoder();
      });
    };
    wireToggle("#toggleZhuyin", "showZhuyin");
    wireToggle("#toggleTrans", "showTrans");
    wireToggle("#toggleHumor", "showHumor");
    wireToggle("#toggleTech", "showTech");

    $("#btnReadCurrentAct").addEventListener("click", () => {
      const verses = state.activeAct === "all"
        ? DATA.acts.flatMap((a) => a.verses)
        : DATA.acts.find((a) => a.id === state.activeAct).verses;
      const fullText = verses.map((v) => v.raw).join(" ");
      AUDIO.speak(fullText);
    });

    $("#btnStopRead").addEventListener("click", () => {
      AUDIO.stopSpeak();
      $$(".verse-card").forEach((c) => c.classList.remove("speaking"));
    });

    $("#vtClose").addEventListener("click", () => {
      $("#vocabToast").classList.remove("show");
    });

    renderDecoder();
  }

  // ---------- 4. 技高四大群科跨域視角 ----------
  function renderVocational() {
    $("#trackMenu").innerHTML = DATA.vocationalTracks.map((t) => `
      <button class="track-btn ${t.id === state.activeTrack ? "active" : ""}" data-track="${t.id}">
        <span style="font-size:1.35rem;">${t.icon}</span>
        <span>${t.name}</span>
      </button>
    `).join("");

    const active = DATA.vocationalTracks.find((t) => t.id === state.activeTrack);
    $("#trackPanel").innerHTML = `
      <span class="pill pill-jade">${active.icon} ${active.name}專屬視角</span>
      <h3 style="font-size:1.45rem; margin:0.65rem 0 0.9rem;">${active.headline}</h3>
      <ul style="padding-left:1.25rem; display:grid; gap:0.65rem; margin:0;">
        ${active.points.map((p) => `<li>${p}</li>`).join("")}
      </ul>
      <div class="spec-versus">
        <div>
          <strong style="color:var(--ink-muted); font-size:0.86rem;">❌ ${active.leftLabel}</strong>
          <p style="margin:0.35rem 0 0; font-size:0.9rem;">${active.leftDesc}</p>
        </div>
        <div class="vs-badge">VS</div>
        <div>
          <strong style="color:var(--jade-deep); font-size:0.86rem;">✅ ${active.rightLabel}</strong>
          <p style="margin:0.35rem 0 0; font-size:0.9rem; font-weight:600;">${active.rightDesc}</p>
        </div>
      </div>
    `;

    $$(".track-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeTrack = btn.dataset.track;
        AUDIO.pluckString(523.25, 0.35, 0.14);
        renderVocational();
      });
    });
  }

  // ---------- 5. 互動遊戲 A：如果我是羅敷 ----------
  function renderStory() {
    const node = DATA.storyNodes[state.storyNode];
    const container = $("#storyContainer");

    if (node.ending) {
      state.collectedEndings.add(state.storyNode);
      $("#endingCounter").textContent = `已收集結局：${state.collectedEndings.size} / 5`;

      container.innerHTML = `
        <div class="story-prompt" style="border-left-color:${node.good ? "var(--jade-main)" : "var(--vermilion)"}; background:${node.good ? "var(--jade-light)" : "var(--vermilion-soft)"};">
          <div style="font-weight:800; color:${node.good ? "var(--jade-deep)" : "var(--vermilion)"}; margin-bottom:0.35rem;">${node.badge}</div>
          <h4 style="margin-bottom:0.4rem;">${node.title}</h4>
          <p style="margin:0;">${node.text}</p>
        </div>
        <button class="btn btn-secondary" id="btnStoryRestart" style="width:100%;">↺ 重新挑戰其他爆笑路線</button>
      `;
      $("#btnStoryRestart").addEventListener("click", () => {
        state.storyNode = "start";
        renderStory();
      });
    } else {
      container.innerHTML = `
        <div class="story-prompt">
          <div style="font-size:0.82rem; font-weight:800; color:var(--gold-deep); margin-bottom:0.3rem;">${node.stage}</div>
          <p style="margin:0;">${node.text}</p>
        </div>
        <div class="choice-list">
          ${node.choices.map((c, idx) => `
            <button class="choice-btn" data-next-node="${c.next}">${c.label}</button>
          `).join("")}
        </div>
      `;
      $$("[data-next-node]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const next = btn.dataset.nextNode;
          state.storyNode = next;
          const target = DATA.storyNodes[next];
          if (target.ending) {
            if (target.good) AUDIO.playSuccessChime();
            else AUDIO.playComicBoing();
          } else {
            AUDIO.playGong();
          }
          renderStory();
        });
      });
    }
  }

  // ---------- 6. 互動遊戲 B：樂府段考＆素養搶答 ----------
  function renderQuiz() {
    const container = $("#quizContainer");
    $("#quizScoreBadge").textContent = `得分：${state.quizScore * 10}｜連勝：${state.quizStreak} 🔥`;

    if (state.quizIdx >= DATA.quizQuestions.length) {
      const pct = Math.round((state.quizScore / DATA.quizQuestions.length) * 100);
      const rank = pct >= 90 ? "👑 漢代嘴砲宗師（秦羅敷認證！）"
        : pct >= 70 ? "🎖️ 城南採桑優等生"
        : "🐴 五馬太守見習生（再看一次陷阱字吧！）";

      container.innerHTML = `
        <div class="story-prompt" style="text-align:center; border-left-color:var(--jade-main);">
          <div style="font-size:2.2rem; font-weight:900; color:var(--vermilion);">${pct} 分</div>
          <h4 style="margin:0.4rem 0;">${rank}</h4>
          <p style="margin:0; font-size:0.9rem;">答對 ${state.quizScore} / ${DATA.quizQuestions.length} 題！</p>
        </div>
        <button class="btn btn-primary" id="btnQuizRestart" style="width:100%;">🔄 再挑戰一輪搶答</button>
      `;
      $("#btnQuizRestart").addEventListener("click", () => {
        state.quizIdx = 0;
        state.quizScore = 0;
        state.quizStreak = 0;
        state.quizAnswered = false;
        renderQuiz();
      });
      return;
    }

    const q = DATA.quizQuestions[state.quizIdx];
    container.innerHTML = `
      <div class="story-prompt" style="border-left-color:var(--vermilion);">
        <strong>${q.q}</strong>
      </div>
      <div class="choice-list">
        ${q.options.map((opt, idx) => `
          <button class="choice-btn" data-opt-idx="${idx}">${String.fromCharCode(65 + idx)}. ${opt}</button>
        `).join("")}
      </div>
      <div class="quiz-feedback" id="quizFeedback"></div>
      <div style="margin-top:0.9rem; text-align:right;">
        <button class="btn btn-secondary" id="btnNextQuiz" style="display:none; padding:0.55rem 1.15rem; font-size:0.88rem;">下一題 ➔</button>
      </div>
    `;

    state.quizAnswered = false;
    $$("[data-opt-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.quizAnswered) return;
        state.quizAnswered = true;
        const chosen = Number(btn.dataset.optIdx);
        const isCorrect = chosen === q.answer;
        const fb = $("#quizFeedback");

        $$("[data-opt-idx]").forEach((b, i) => {
          b.disabled = true;
          if (i === q.answer) b.classList.add("correct");
          else if (i === chosen && !isCorrect) b.classList.add("wrong");
        });

        if (isCorrect) {
          state.quizScore++;
          state.quizStreak++;
          fb.className = "quiz-feedback show good";
          fb.innerHTML = `<strong>🎉 答對了！</strong> ${q.explain}`;
          AUDIO.playSuccessChime();
        } else {
          state.quizStreak = 0;
          fb.className = "quiz-feedback show bad";
          fb.innerHTML = `<strong>😅 差一點點！</strong> ${q.explain}`;
          AUDIO.playComicBoing();
        }

        $("#quizScoreBadge").textContent = `得分：${state.quizScore * 10}｜連勝：${state.quizStreak} 🔥`;
        $("#btnNextQuiz").style.display = "inline-flex";
      });
    });

    $("#btnNextQuiz").addEventListener("click", () => {
      state.quizIdx++;
      renderQuiz();
    });
  }

  // ---------- 7. 公開觀課教案表格與列印 ----------
  function initObservationHub() {
    $("#lessonTimelineBody").innerHTML = DATA.lessonTimeline.map((row) => `
      <tr>
        <td><strong>${row.time}</strong></td>
        <td><span class="pill pill-jade" style="font-size:0.74rem;">${row.phase}</span></td>
        <td>${row.activity}</td>
        <td style="font-weight:700; color:var(--vermilion);">${row.strategy}</td>
      </tr>
    `).join("");

    $("#btnPrintWorksheet").addEventListener("click", () => {
      window.print();
    });
  }

  // ---------- 8. 教室小工具 Modals (計時器 + 抽座號器) ----------
  function initClassroomModals() {
    const openModal = (id) => $(`#${id}`).classList.add("open");
    const closeModal = (id) => $(`#${id}`).classList.remove("open");

    $("#btnOpenTimer").addEventListener("click", () => openModal("timerModal"));
    $("#btnOpenPicker").addEventListener("click", () => openModal("pickerModal"));

    $$("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    $$(".modal-backdrop").forEach((bg) => {
      bg.addEventListener("click", (e) => {
        if (e.target === bg) bg.classList.remove("open");
      });
    });

    // Timer logic
    const formatTime = (sec) => {
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      return `${m}:${s}`;
    };

    const updateTimerUI = () => {
      $("#timerDisplay").textContent = formatTime(state.timerSeconds);
      $("#btnTimerToggle").textContent = state.timerRunning ? "⏸ 暫停計時" : "▶ 開始計時";
    };

    const stopTimer = () => {
      state.timerRunning = false;
      if (state.timerHandle) {
        clearInterval(state.timerHandle);
        state.timerHandle = null;
      }
      updateTimerUI();
    };

    $$("[data-timer-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        stopTimer();
        state.timerSeconds = Number(btn.dataset.timerPreset);
        updateTimerUI();
      });
    });

    $("#btnTimerToggle").addEventListener("click", () => {
      if (state.timerRunning) {
        stopTimer();
      } else {
        if (state.timerSeconds <= 0) state.timerSeconds = 180;
        state.timerRunning = true;
        updateTimerUI();
        state.timerHandle = setInterval(() => {
          state.timerSeconds--;
          updateTimerUI();
          if (state.timerSeconds <= 0) {
            stopTimer();
            AUDIO.playBell();
            $("#timerDisplay").textContent = "時間到！";
          }
        }, 1000);
      }
    });

    $("#btnTimerReset").addEventListener("click", () => {
      stopTimer();
      state.timerSeconds = 180;
      updateTimerUI();
    });

    // Random Student Seat Picker logic
    const remarks = [
      "🌟 恭喜中選！請發揮秦羅敷的機智回答！",
      "🐎 五馬車已停在你座位旁邊，請作答！",
      "✨ 全班數千人（好啦全班同學）都看著你！",
      "🎯 天選之人誕生！答對直接加分！"
    ];

    $("#btnPickStudent").addEventListener("click", () => {
      const max = Math.max(5, Math.min(60, Number($("#classSizeInput").value) || 36));
      const pool = [];
      for (let i = 1; i <= max; i++) {
        if (!state.pickedNumbers.includes(i)) pool.push(i);
      }
      if (pool.length === 0) {
        $("#pickerRemark").textContent = "全班都抽過一輪啦！請按「清空已抽名單」重新開始～";
        return;
      }

      const btn = $("#btnPickStudent");
      btn.disabled = true;
      let ticks = 0;
      const roll = setInterval(() => {
        const preview = pool[Math.floor(Math.random() * pool.length)];
        $("#pickerDisplay").textContent = `${preview} 號`;
        AUDIO.pluckString(440 + (ticks % 5) * 65, 0.15, 0.12);
        ticks++;
        if (ticks >= 14) {
          clearInterval(roll);
          const winner = pool[Math.floor(Math.random() * pool.length)];
          state.pickedNumbers.push(winner);
          $("#pickerDisplay").textContent = `${winner} 號`;
          $("#pickerRemark").textContent = remarks[Math.floor(Math.random() * remarks.length)];
          $("#pickedHistory").textContent = `已抽過座號：${state.pickedNumbers.join("、")}`;
          AUDIO.playSuccessChime();
          btn.disabled = false;
        }
      }, 65);
    });

    $("#btnResetPicker").addEventListener("click", () => {
      state.pickedNumbers = [];
      $("#pickerDisplay").textContent = "? 號";
      $("#pickerRemark").textContent = "";
      $("#pickedHistory").textContent = "已抽過座號：無";
    });
  }

  // ---------- 啟動全站 ----------
  document.addEventListener("DOMContentLoaded", () => {
    initHeaderTools();
    initTheater();
    initDecoder();
    renderVocational();
    renderStory();
    renderQuiz();
    initObservationHub();
    initClassroomModals();
  });
})();
