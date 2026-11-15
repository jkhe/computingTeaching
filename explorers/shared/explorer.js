/* Shared behaviour for all KS3 Computing explorers.
   No storage, no network calls, no tracking.

   VERSION 2 (three screens: Start, Explore, Finished). Copy template.html.
   A page supplies only its own visual and control, then calls:

     Explorer.setup({
       success:     function () { return true/false; },  // the real goal state
       successText: "All lined up.",        // optional green line on success
       hint:        "Try ..." or function,  // one short piece of guidance
       hintAfter:   60,                     // seconds without success (default 60)
       pulse:       "#control",             // selector: pulses until first use
       onShow:      function () {},         // Explore screen has just appeared
       onReset:     function () {},         // put the page back to its start
       challenge: {                         // optional second step
         text:    "The challenge sentence.",
         start:   function () {},           // switch the page to the challenge
         success: function () { return true/false; },
         successText: "", hint: "", pulse: ""   // same meaning as above
       }
     });

     Explorer.used();              // call after every change the pupil makes
     Explorer.status(text, kind);  // the ONE feedback line. kind: "" or "good"
     Explorer.hint(text);          // show one piece of guidance in that line
     Explorer.success(text);       // only if you detect success yourself
     Explorer.step()               // 1 = goal, 2 = challenge

   VERSION 1 (Explorer.init / track / unlock / reset) is kept at the bottom
   for pages that have not been converted yet. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  /* ================= Version 2 ================= */

  var HINT_HOLD = 6000;     // a hint stays at least this long (ms)
  var SUCCESS_HOLD = 2500;  // so does the success line
  var CHOICE_DELAY = 1000;  // success line first, then the choice

  var cfg = null;
  var el = {};              // the shared elements
  var step = 1;             // 1 = goal, 2 = challenge
  var solved = false;       // the current step's success has been reached
  var usedYet = false;      // the control has been used in this step
  var run = 0;              // goes up on every reset, so old timers do nothing
  var hintTimer = null;
  var holdUntil = 0;        // the status line is held until this time
  var waiting = null;       // a status that arrived during a hold

  function part() { return step === 2 ? cfg.challenge : cfg; }

  /* ----- Screens: only one is ever visible ----- */
  function show(name) {
    ["start", "explore", "finished"].forEach(function (n) {
      if (el[n]) el[n].hidden = n !== name;
    });
    if (name === "explore") {
      if (cfg.onShow) cfg.onShow();
      armHint();
    } else {
      clearTimeout(hintTimer);
    }
    if (name === "finished") el.finishedTitle.focus();
  }

  /* ----- The one feedback line ----- */
  function paint(text, kind) {
    if (el.status.textContent !== text) el.status.textContent = text;
    el.status.className = "ex-status" + (kind ? " " + kind : "");
  }
  function status(text, kind) {
    if (Date.now() < holdUntil) { waiting = [text, kind]; return; }
    paint(text || "", kind);
  }
  /* Show a line and keep it for a while, even if the page posts a new
     status. The page's newest status is shown when the hold ends. */
  function hold(text, kind, ms) {
    var mine = run;
    paint(text, kind);
    waiting = null;
    holdUntil = Date.now() + ms;
    setTimeout(function () {
      if (mine === run && waiting && Date.now() >= holdUntil) paint(waiting[0], waiting[1]);
    }, ms + 20);
  }

  function hint(text) { if (text) hold(text, "hint", HINT_HOLD); }

  /* ----- Timed hint: one piece of guidance, never "wrong" ----- */
  function armHint() {
    clearTimeout(hintTimer);
    if (solved || !part().hint) return;
    hintTimer = setTimeout(function () {
      if (solved || el.explore.hidden) return;
      var h = part().hint;
      hint(typeof h === "function" ? h() : h);
      armHint();
    }, (cfg.hintAfter || 60) * 1000);
  }

  /* ----- Pulse until first use ----- */
  function setPulse(on) {
    var old = document.querySelectorAll(".ex-pulse");
    for (var i = 0; i < old.length; i++) old[i].classList.remove("ex-pulse");
    if (!on || !part().pulse) return;
    var now = document.querySelectorAll(part().pulse);
    for (var j = 0; j < now.length; j++) now[j].classList.add("ex-pulse");
  }

  function used() {
    if (!usedYet) { usedYet = true; setPulse(false); }
    if (!solved && part().success && part().success()) success();
  }

  /* ----- Success: feedback first, then the choice in the same place ----- */
  function success(text) {
    if (solved) return;
    solved = true;
    clearTimeout(hintTimer);
    text = text || part().successText;
    if (text) hold(text, "good", SUCCESS_HOLD);
    var mine = run, at = step;
    setTimeout(function () {
      if (mine === run && at === step) showChoice();
    }, text || step === 1 ? CHOICE_DELAY : 0);
  }

  function showChoice() {
    /* Step 1: the choice replaces the instruction. Step 2: "I'm finished"
       sits beside the challenge sentence. */
    el.instruction.hidden = step === 1;
    el.tryBtn.hidden = step !== 1 || !cfg.challenge;
    el.choice.hidden = false;
  }

  function startStep(n) {
    step = n;
    solved = false;
    usedYet = false;
    holdUntil = 0;
    waiting = null;
    el.choice.hidden = true;
    el.instruction.hidden = false;
    el.instruction.textContent = n === 2 ? cfg.challenge.text : el.goalText;
    var dots = el.steps ? el.steps.children : [];
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i === n - 1);
    paint("", "");
  }

  function startChallenge() {
    run += 1;
    startStep(2);
    if (cfg.challenge.start) cfg.challenge.start();
    setPulse(true);
    armHint();
  }

  /* Start again: back to the first step, in its starting state. */
  function restart() {
    run += 1;
    startStep(1);
    if (cfg.onReset) cfg.onReset();
    setPulse(true);
    show("explore");
  }

  function button(cls, text, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }

  /* The parts that are the same on every page are built here. */
  function build() {
    el.start = $("ex-start");
    el.explore = $("ex-explore");
    el.instruction = $("ex-instruction");
    el.steps = $("ex-steps");
    el.status = $("ex-status");
    el.goalText = el.instruction.textContent;

    el.choice = document.createElement("div");
    el.choice.className = "ex-choice";
    el.choice.hidden = true;
    el.tryBtn = button("ex-btn primary", "Try the challenge", startChallenge);
    el.choice.appendChild(el.tryBtn);
    el.choice.appendChild(button("ex-btn", "I’m finished", function () { show("finished"); }));
    el.instruction.parentNode.insertBefore(el.choice, el.instruction.nextSibling);

    /* Inside Nearpod the page is in a frame, so there is no tab to close. */
    var framed = true;
    try { framed = window.self !== window.top; } catch (e) { /* blocked = framed */ }

    var f = document.createElement("section");
    f.className = "ex-screen ex-finished";
    f.id = "ex-finished";
    f.hidden = true;
    f.innerHTML =
      '<svg class="ex-tick" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="56" fill="#15803D"/>' +
      '<path d="M34 62l18 18 34-38" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<h1 tabindex="-1">Finished.</h1><p></p>';
    f.querySelector("p").textContent = framed ?
      "Lower your screen and wait for the question." :
      "Close this tab and go back to Nearpod.";
    f.appendChild(button("ex-quiet", "Look again", function () { show("explore"); }));
    document.body.appendChild(f);
    el.finished = f;
    el.finishedTitle = f.querySelector("h1");

    $("ex-go").addEventListener("click", function () { show("explore"); });
    $("ex-reset").addEventListener("click", restart);
  }

  function setup(options) {
    cfg = options || {};
    build();
    startStep(1);
    setPulse(true);
  }

  /* ================= Version 1 (old pages) =================
     Explorer.init({ unlockAfter: 6, onReset: fn }); Explorer.track();
     The "Next challenge" card (#ex-next) appears after `unlockAfter` changes. */

  var state = { count: 0, unlockAfter: 6, onReset: null, unlocked: false };

  function nextCard() { return $("ex-next"); }

  function unlock() {
    var card = nextCard();
    if (card && !state.unlocked) {
      state.unlocked = true;
      card.classList.add("show");
    }
  }

  function track() {
    state.count += 1;
    if (state.count >= state.unlockAfter) unlock();
  }

  function reset() {
    if (cfg) { restart(); return; }
    state.count = 0;
    state.unlocked = false;
    var card = nextCard();
    if (card) card.classList.remove("show");
    if (typeof state.onReset === "function") state.onReset();
  }

  function init(opts) {
    opts = opts || {};
    if (typeof opts.unlockAfter === "number") state.unlockAfter = opts.unlockAfter;
    state.onReset = opts.onReset || null;
    var btn = $("ex-reset");
    if (btn) btn.addEventListener("click", reset);
  }

  window.Explorer = {
    /* version 2 */
    setup: setup, used: used, status: status, hint: hint, success: success,
    step: function () { return step; },
    /* version 1 */
    init: init, track: track, unlock: unlock, reset: reset
  };
})();
